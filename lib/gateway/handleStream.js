import { findChannel, findVodItem } from './catalogue';
import { verifyLine, checkDevice } from './lines';
import { clientIp, rateLimit, sealUrl } from './security';
import { touchSession, trackEvent } from './track';
import { fetchPublic, looksLikePlaylist, mediaTypeOk } from '../tvProxy';

// IPTV GATEWAY — asli stream. Dono routes isi ko bulate hain:
//   /api/gw/stream?kind=live&u=..&p=..&f=12.m3u8
//   /api/gw/x/live/u/p/12.m3u8        (next.config rewrites)
//
// Channel ki asli URL sirf server ke paas hai. HLS playlist ke andar har piece
// /api/gw/s?t=<sealed> ban jata hai — client ko upstream kabhi nahi dikhta.

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

/** @param {{ kind?: 'live'|'movie'|'series', username: string, password: string, file: string }} p */
export async function handleStream(req, p) {
  const kind = ['live', 'movie', 'series'].includes(String(p.kind)) ? String(p.kind) : 'live';
  const file = String(p.file || '');

  if (!rateLimit(clientIp(req), 'gw-stream', 240, 60_000)) return bad('Too many requests', 429);

  const m = file.match(/^([^/]+?)(?:\.([a-z0-9]{2,5}))?$/i);
  if (!m) return bad('Bad stream address');
  const id = decodeURIComponent(m[1]);
  const ext = (m[2] || 'ts').toLowerCase();

  const v = await verifyLine(p.username, p.password);
  if (!v.ok) return bad(v.error, v.status);

  const dev = await checkDevice(v.line, req);
  if (!dev.ok) return bad('Too many connections — kisi doosre device par line band karein.', 403);

  // Channel ya VOD item hamare apne catalogue se.
  let target = '';
  let label = '';
  if (kind === 'live') {
    const ch = await findChannel(id);
    if (!ch || !ch.url) return bad('Channel not found', 404);
    target = ch.url;
    label = ch.name;
  } else {
    const item = await findVodItem(kind, id);
    if (!item || !item.url) return bad('Not found', 404);
    target = item.url;
    label = item.name;
  }
  if (!/^https?:\/\//i.test(target)) return bad('Not found', 404);

  touchSession(v.line, req, { channel: label, kind, force: false });
  trackEvent('stream_start', v.line, req, { channel: label, kind });

  const base = baseOf(req);
  try {
    const headers = {};
    const range = req.headers.get('range');
    if (range) headers.Range = range;

    const { res, finalUrl } = await fetchPublic(target, { headers, timeout: 20000, signal: req.signal });
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

    const h = { 'Content-Type': type || (ext === 'ts' ? 'video/mp2t' : 'video/mp4'), 'Cache-Control': 'no-store', 'Accept-Ranges': 'bytes' };
    for (const k of ['content-length', 'content-range']) { const val = res.headers.get(k); if (val) h[k] = val; }
    return new Response(res.body, { status: res.status, headers: h });
  } catch (e) {
    console.error('gw stream:', e.message);
    return bad('Channel could not be reached', 502);
  }
}
