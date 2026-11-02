import { getSource, upstreamStreamUrl, sourceReady } from './source';
import { findChannel } from './catalogue';
import { verifyLine, checkDevice } from './lines';
import { clientIp, rateLimit, sealUrl } from './security';
import { fetchPublic, looksLikePlaylist, mediaTypeOk } from '../tvProxy';

// IPTV GATEWAY — asli stream ka handler (dono routes isi ko bulate hain):
//   /api/gw/stream?...      (query form)
//   /api/gw/x/live/u/p/f    (path form — next.config rewrites isi par bhejte hain)
// Upstream address callback mein kabhi nahi jata: playlist ke andar har piece /api/gw/s?t=<sealed>.

const bad = (m, s = 400) => new Response(m, { status: s, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });

function baseOf(req) {
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'mizanora.vercel.app';
  return `${proto}://${host}`;
}

function rewrite(text, baseUrl, base) {
  const abs = (v) => { try { return new URL(v, baseUrl).href; } catch { return ''; } };
  return String(text).split(/\r?\n/).map((line) => {
    const t = line.trim();
    if (!t) return line;
    if (t.startsWith('#')) {
      return line.replace(/URI="([^"]+)"/gi, (m, v) => {
        const a = abs(v);
        return a && /^https?:/i.test(a) ? `URI="${base}/api/gw/s?t=${sealUrl(a)}"` : m;
      });
    }
    const a = abs(t);
    return a && /^https?:/i.test(a) ? `${base}/api/gw/s?t=${sealUrl(a)}` : line;
  }).join('\n');
}

/** @param {{ kind?: string, username: string, password: string, file: string }} p */
export async function handleStream(req, p) {
  const kind = ['live', 'movie', 'series'].includes(String(p.kind)) ? String(p.kind) : 'live';
  const username = p.username || '';
  const password = p.password || '';
  const file = String(p.file || '');

  if (!rateLimit(clientIp(req), 'gw-stream', 240, 60_000)) return bad('Too many requests', 429);

  const m = file.match(/^([^/]+?)(?:\.([a-z0-9]{2,5}))?$/i);
  if (!m) return bad('Bad stream address');
  const id = decodeURIComponent(m[1]);
  const ext = (m[2] || 'ts').toLowerCase();

  const v = await verifyLine(username, password);
  if (!v.ok) return bad(v.error, v.status);

  const dev = await checkDevice(v.line, req);
  if (!dev.ok) return bad('Too many connections — kisi doosre device par line band karein.', 403);

  const source = await getSource();
  if (!sourceReady(source)) return bad('Channel source set nahi hua', 503);

  let upstream = '';
  if (source.mode === 'xtream') {
    upstream = upstreamStreamUrl(source, kind, id, ext);
  } else {
    const ch = await findChannel(id);
    if (!ch || !ch.url) return bad('Channel not found', 404);
    upstream = ch.url;
  }
  if (!/^https?:\/\//i.test(upstream)) return bad('Channel not found', 404);

  const base = baseOf(req);
  try {
    const headers = {};
    const range = req.headers.get('range');
    if (range) headers.Range = range;

    const { res, finalUrl } = await fetchPublic(upstream, { headers, timeout: 20000, signal: req.signal });
    if (!res.ok && res.status !== 206) {
      try { res.body && res.body.cancel(); } catch { /* ignore */ }
      return bad(`Channel offline (${res.status})`, res.status === 404 ? 404 : 502);
    }

    const type = res.headers.get('content-type') || '';
    if (looksLikePlaylist(finalUrl, type)) {
      const text = (await res.text()).slice(0, 2_000_000);
      if (!/^#EXTM3U/i.test(text.trimStart())) return bad('Not a playlist', 415);
      return new Response(rewrite(text, finalUrl, base), {
        status: 200,
        headers: { 'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    if (!mediaTypeOk(type)) {
      try { res.body && res.body.cancel(); } catch { /* ignore */ }
      return bad('Not a media stream', 415);
    }

    const h = { 'Content-Type': type || 'video/mp2t', 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };
    for (const k of ['content-length', 'content-range']) { const val = res.headers.get(k); if (val) h[k] = val; }
    return new Response(res.body, { status: res.status, headers: h });
  } catch (e) {
    console.error('gw stream:', e.message);
    return bad('Channel could not be reached', 502);
  }
}
