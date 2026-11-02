import { openUrl, clientIp, rateLimit, sealUrl } from '@/lib/gateway/security';
import { fetchPublic, looksLikePlaylist, mediaTypeOk } from '@/lib/tvProxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Sealed piece proxy: /api/gw/s?t=<token>
// Browser ko sirf yeh address dikhta hai — andar ka asli link AES-GCM se bandha hua hai
// aur 3 ghante mein khud exp ho jata hai. Token ke baghair koi is route ko use nahi kar sakta.

const bad = (m, s = 400) => new Response(m, { status: s, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });

function baseOf(req) {
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'mizanora.vercel.app';
  return `${proto}://${host}`;
}

export async function GET(req) {
  const url = new URL(req.url);
  const token = url.searchParams.get('t') || '';
  if (!rateLimit(clientIp(req), 'gw-seg', 900, 60_000)) return bad('Too many requests', 429);

  const target = openUrl(token);
  if (!target || !/^https?:\/\//i.test(target)) return bad('Bad or expired link', 403);

  try {
    const headers = {};
    const range = req.headers.get('range');
    if (range) headers.Range = range;

    const { res, finalUrl } = await fetchPublic(target, { headers, timeout: 20000, signal: req.signal });
    if (!res.ok && res.status !== 206) {
      try { res.body && res.body.cancel(); } catch { /* ignore */ }
      return bad(`Piece unavailable (${res.status})`, res.status === 404 ? 404 : 502);
    }

    const type = res.headers.get('content-type') || '';
    if (looksLikePlaylist(finalUrl, type)) {
      const text = (await res.text()).slice(0, 2_000_000);
      if (!/^#EXTM3U/i.test(text.trimStart())) return bad('Not a playlist', 415);
      const base = baseOf(req);
      const abs = (v) => { try { return new URL(v, finalUrl).href; } catch { return ''; } };
      const out = text.split(/\r?\n/).map((line) => {
        const t = line.trim();
        if (!t) return line;
        if (t.startsWith('#')) return line.replace(/URI="([^"]+)"/gi, (mm, v) => { const a = abs(v); return a && /^https?:/i.test(a) ? `URI="${base}/api/gw/s?t=${sealUrl(a)}"` : mm; });
        const a = abs(t);
        return a && /^https?:/i.test(a) ? `${base}/api/gw/s?t=${sealUrl(a)}` : line;
      }).join('\n');
      return new Response(out, { status: 200, headers: { 'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8', 'Cache-Control': 'no-store' } });
    }

    if (!mediaTypeOk(type)) {
      try { res.body && res.body.cancel(); } catch { /* ignore */ }
      return bad('Not media', 415);
    }

    const h = { 'Content-Type': type || 'application/octet-stream', 'Cache-Control': 'private, max-age=30', 'Accept-Ranges': 'bytes' };
    for (const k of ['content-length', 'content-range']) { const val = res.headers.get(k); if (val) h[k] = val; }
    return new Response(res.body, { status: res.status, headers: h });
  } catch (e) {
    console.error('gw segment:', e.message);
    return bad('Piece could not be reached', 502);
  }
}
