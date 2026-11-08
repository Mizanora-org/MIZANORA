import crypto from 'node:crypto';
import { safePublicFetch } from './safeFetch.js';
export { isPrivateIp, assertPublicHost } from './safeFetch.js';

// v26: the stream relay. Many playlists (iptv-org and others) hold plain http:// streams, or servers that refuse other websites (CORS).
// A browser cannot play those on an https page. The relay (app/api/tv/p/route.js) downloads the playlist for the visitor, rewrites every
// address inside it so the pieces also come through the relay, and passes the video pieces on.
// SAFETY: (1) the first address must be one of the channels the admin saved; every other address comes from a playlist we rewrote and
// carries a signature (HMAC) so nobody can use the relay for arbitrary links; (2) private / local addresses are refused (the server's own
// network stays unreachable); (3) HTML and other non-media answers are refused; (4) redirects are followed by hand and checked each time.

// Never sign arbitrary relay URLs with a guessable public project ID. In demo/local mode
// use an ephemeral random secret; production instances should share TV_PROXY_SECRET or Firebase credentials.
const ephemeralSecret = crypto.randomBytes(32);
const secret = () => process.env.TV_PROXY_SECRET || process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_SERVICE_ACCOUNT || ephemeralSecret;
export const signUrl = (u) => crypto.createHmac('sha256', secret()).update(String(u)).digest('base64url').slice(0, 22);
export const checkSig = (u, s) => { const a = Buffer.from(signUrl(u)); const b = Buffer.from(String(s || '')); return a.length === b.length && crypto.timingSafeEqual(a, b); };
export const relayUrl = (abs) => `/api/tv/p?u=${encodeURIComponent(abs)}&s=${signUrl(abs)}`;

// Fetch with pinned DNS resolution and checked redirects. Never use an unpinned global fetch
// after a DNS pre-check: a rebind between lookup and connection could reach a private service.
export const fetchPublic = (url, { headers = {}, timeout = 10000, signal } = {}) => safePublicFetch(url, {
  headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36', Accept: '*/*', ...headers },
  timeout, signal,
});

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
