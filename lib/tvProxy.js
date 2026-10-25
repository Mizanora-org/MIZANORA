import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';

// v26: the stream relay. Many playlists (iptv-org and others) hold plain http:// streams, or servers that refuse other websites (CORS).
// A browser cannot play those on an https page. The relay (app/api/tv/p/route.js) downloads the playlist for the visitor, rewrites every
// address inside it so the pieces also come through the relay, and passes the video pieces on.
// SAFETY: (1) the first address must be one of the channels the admin saved; every other address comes from a playlist we rewrote and
// carries a signature (HMAC) so nobody can use the relay for arbitrary links; (2) private / local addresses are refused (the server's own
// network stays unreachable); (3) HTML and other non-media answers are refused; (4) redirects are followed by hand and checked each time.

const secret = () => process.env.TV_PROXY_SECRET || process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_SERVICE_ACCOUNT || `mz-tv-${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'local'}`;
export const signUrl = (u) => crypto.createHmac('sha256', secret()).update(String(u)).digest('base64url').slice(0, 22);
export const checkSig = (u, s) => { const a = Buffer.from(signUrl(u)); const b = Buffer.from(String(s || '')); return a.length === b.length && crypto.timingSafeEqual(a, b); };
export const relayUrl = (abs) => `/api/tv/p?u=${encodeURIComponent(abs)}&s=${signUrl(abs)}`;

export function isPrivateIp(ip) {
  if (net.isIPv4(ip)) { const [a, b] = ip.split('.').map(Number); return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224; }
  if (net.isIPv6(ip)) { const l = ip.toLowerCase(); return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:'); }
  return true;
}
const okHosts = new Map(); // host -> time it was checked (5 minutes), so one stream does not repeat the DNS lookup for every video piece
export async function assertPublicHost(host) {
  const t = okHosts.get(host);
  if (t && Date.now() - t < 5 * 60e3) return;
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some((x) => isPrivateIp(x.address))) throw new Error('private address');
  okHosts.set(host, Date.now());
  if (okHosts.size > 500) okHosts.clear();
}

// fetch with hand-made redirects (max 4), each hop checked. Returns the Response (body not read) and the final address.
export async function fetchPublic(url, { headers = {}, timeout = 10000, signal } = {}) {
  let cur = url;
  // v28: keep the timeout even when the caller passes the browser's disconnect signal. AbortSignal.any
  // cancels an upstream request as soon as the viewer leaves, instead of leaving it running for 12 s.
  const timeoutSignal = AbortSignal.timeout(timeout);
  const abortSignal = signal && typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  for (let hop = 0; hop < 5; hop++) {
    const u = new URL(cur);
    if (!/^https?:$/.test(u.protocol)) throw new Error('bad protocol');
    await assertPublicHost(u.hostname);
    const r = await fetch(u.href, { redirect: 'manual', signal: abortSignal, headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36', Accept: '*/*', ...headers } });
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) { try { r.body && r.body.cancel(); } catch { /* ignore */ } cur = new URL(r.headers.get('location'), u).href; continue; }
    return { res: r, finalUrl: u.href };
  }
  throw new Error('too many redirects');
}

// Rewrite a playlist: every address (segments, sub-playlists, keys, init files) becomes a signed relay address on our own website.
export function rewriteM3U(text, baseUrl, toRelay = relayUrl) {
  const abs = (v) => { try { return new URL(v, baseUrl).href; } catch { return ''; } };
  return String(text).split(/\r?\n/).map((line) => {
    const t = line.trim();
    if (!t) return line;
    if (t.startsWith('#')) return line.replace(/URI="([^"]+)"/gi, (m, v) => { const a = abs(v); return a && /^https?:/i.test(a) ? `URI="${toRelay(a)}"` : m; });
    const a = abs(t);
    return a && /^https?:/i.test(a) ? toRelay(a) : line;
  }).join('\n');
}
export const looksLikePlaylist = (url, type, head = '') => /mpegurl|m3u/i.test(type || '') || /\.m3u8?(\?|$)/i.test(url) || /^#EXTM3U/.test(String(head).trimStart());
// What the relay may pass on: video, audio, playlists and plain binary pieces. Never web pages, scripts or data files.
export const mediaTypeOk = (type) => !type || /^(video|audio)\//i.test(type) || /(mpegurl|m3u|octet-stream|mp2t|mp4|mpeg|aac|binary)/i.test(type) || /^text\/plain/i.test(type);
