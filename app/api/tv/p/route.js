import { getTvConfig } from '@/lib/liveTvServer';
import { isChannelSourceAllowed } from '@/lib/liveTv';
import { checkSig, fetchPublic, looksLikePlaylist, mediaTypeOk, rewriteM3U } from '@/lib/tvProxy';
import { readLimited } from '@/lib/safeFetch';
import { securityIp, logSecurityEvent } from '@/lib/securityControl';
import { limitRequest } from '@/lib/requestRate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// GET /api/tv/p?u=<stream address>[&s=<signature>]  (the stream relay, see lib/tvProxy.js)
// No signature: the address must be one of the channels the admin saved (this is how a channel starts).
// With a signature: the address came out of a playlist this relay rewrote.
const bad = (m, s = 400) => new Response(m, { status: s, headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' } });

export async function GET(req) {
  const q = new URL(req.url).searchParams;
  const target = String(q.get('u') || '').trim();
  if (!/^https?:\/\/[^\s<>"']{4,2000}$/i.test(target)) {
    await logSecurityEvent(req, 'tv-relay-invalid', { reason: 'bad-target', severity: 'medium' });
    return bad('Bad address');
  }
  const sig = q.get('s');
  const rate = limitRequest(sig ? 'tv-segment' : 'tv-channel', securityIp(req.headers), sig ? 600 : 60);
  if (!rate.allowed) {
    await logSecurityEvent(req, 'rate-limit', { reason: 'tv-relay', severity: 'high' });
    return new Response('Too many stream requests', { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': String(rate.retryAfter) } });
  }
  if (sig) {
    if (!checkSig(target, sig)) { await logSecurityEvent(req, 'tv-relay-invalid', { reason: 'bad-signature', severity: 'high' }); return bad('Bad signature', 403); }
  } else {
    const cfg = await getTvConfig();
    if (!isChannelSourceAllowed(cfg, target)) return bad('This channel is not on the shop', 403);
  }
  try {
    const fwd = {}; const range = req.headers.get('range'); if (range) fwd.Range = range;
    const { res, finalUrl } = await fetchPublic(target, { headers: fwd, timeout: 12000, signal: req.signal });
    if (!res.ok && res.status !== 206) { try { res.body && res.body.cancel(); } catch { /* ignore */ } return bad(`Stream server answered ${res.status}`, res.status === 404 ? 404 : 502); }
    const type = res.headers.get('content-type') || '';
    if (!mediaTypeOk(type)) { try { res.body && res.body.cancel(); } catch { /* ignore */ } return bad('Not a media stream', 415); }
    if (looksLikePlaylist(finalUrl, type)) {
      const text = (await readLimited(res, 1_500_000)).toString('utf8');
      if (!/^#EXTM3U/.test(text.trimStart())) return bad('Not a playlist', 415);
      return new Response(rewriteM3U(text, finalUrl), { status: 200, headers: { 'Content-Type': 'application/vnd.apple.mpegurl', 'Cache-Control': 'public, max-age=1, s-maxage=1' } });
    }
    const h = { 'Content-Type': type || 'application/octet-stream', 'Cache-Control': 'public, max-age=60, s-maxage=60', 'Accept-Ranges': 'bytes' };
    for (const k of ['content-length', 'content-range']) { const v = res.headers.get(k); if (v) h[k] = v; }
    return new Response(res.body, { status: res.status, headers: h });
  } catch (e) {
    if (/private address|bad protocol|bad public URL|host not allowed/i.test(String(e.message || e))) {
      await logSecurityEvent(req, 'tv-relay-invalid', { reason: 'blocked-target', severity: 'high' });
    }
    return bad('Stream could not be reached', 502);
  }
}
