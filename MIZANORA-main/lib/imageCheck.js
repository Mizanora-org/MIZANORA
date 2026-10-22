// Server-side photo check. A photo is "bad" only when we are SURE it cannot be shown (not found, not an image, empty).
// Slow servers, blocks and temporary errors are "unknown": the product is left alone, so a hiccup never hides a good product.
const UA = 'Mozilla/5.0 (compatible; MizanoraPhotoCheck/1.0)';

// Stops this check being used to reach private addresses.
function safeUrl(u) {
  try {
    const x = new URL(String(u));
    if (!/^https?:$/.test(x.protocol)) return null;
    const h = x.hostname.toLowerCase();
    if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return null;
    if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h === '::1' || h.startsWith('[')) return null;
    return x.toString();
  } catch { return null; }
}

const looksLikeImage = (b) => {
  if (!b || b.length < 4) return false;
  if (b[0] === 0xff && b[1] === 0xd8) return true;                                   // jpeg
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return true; // png
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return true;                  // gif
  if (b.length >= 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return true; // webp
  if (b.length >= 12 && b.toString('ascii', 4, 8) === 'ftyp') return true;           // avif / heic
  if (b[0] === 0x42 && b[1] === 0x4d) return true;                                   // bmp
  if (b.toString('utf8', 0, 200).trimStart().startsWith('<svg') || b.toString('utf8', 0, 200).includes('<svg')) return true;
  return false;
};

// -> { state: 'ok' | 'bad' | 'unknown', why }
export async function checkImage(url, timeoutMs = 7000) {
  const u = safeUrl(url);
  if (!u) return { state: 'bad', why: 'not a valid photo link' };
  try {
    const res = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'image/*,*/*;q=0.5', Range: 'bytes=0-2047' }, redirect: 'follow', signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' });
    const status = res.status;
    if (status === 404 || status === 410) { try { await res.body?.cancel(); } catch { /* ignore */ } return { state: 'bad', why: `photo not found (${status})` }; }
    if (status !== 200 && status !== 206) { try { await res.body?.cancel(); } catch { /* ignore */ } return { state: 'unknown', why: `HTTP ${status}` }; }
    const type = (res.headers.get('content-type') || '').toLowerCase();
    let head = Buffer.alloc(0);
    try {
      const reader = res.body.getReader();
      const { value } = await reader.read();
      head = Buffer.from(value || []);
      try { await reader.cancel(); } catch { /* ignore */ }
    } catch { /* body unreadable */ }
    if (type.startsWith('text/') || type.includes('json') || type.includes('html')) return { state: 'bad', why: 'link opens a web page, not a photo' };
    if (head.length < 8) return { state: 'bad', why: 'empty photo' };
    if (type.startsWith('image/') || looksLikeImage(head)) return looksLikeImage(head) || type.startsWith('image/') ? { state: 'ok', why: '' } : { state: 'bad', why: 'not an image' };
    return { state: 'bad', why: 'not an image' };
  } catch (e) {
    const m = String((e && (e.cause && e.cause.code)) || (e && e.message) || '');
    if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|CERT|certificate/i.test(m)) return { state: 'bad', why: 'photo server not reachable' };
    return { state: 'unknown', why: /abort|timeout/i.test(m) ? 'timed out' : m.slice(0, 60) };
  }
}

// Checks a list with a few at a time. Returns [{ url, state, why }] in the same order.
export async function checkImages(urls, concurrency = 8) {
  const out = new Array(urls.length);
  let next = 0;
  const worker = async () => { while (next < urls.length) { const i = next++; out[i] = { url: urls[i], ...(await checkImage(urls[i])) }; } };
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  return out;
}
