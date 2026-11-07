// v60 — the actual picture math of /api/photo, kept in one place so it can be tested without a browser.
import { W } from './photo.js';

// Widths are rounded up to one of these steps, so a page asking for 401 px and one asking for 400 px
// share ONE cached file at the edge instead of creating two.
export const WIDTH_STEPS = [96, 160, 240, 320, 400, 480, 640, 800, 900, 1200, 1280, 1600];

export function cleanWidth(raw) {
  const n = Math.round(Number(raw) || 0);
  if (!n) return W.card2x;
  return WIDTH_STEPS.find((s) => n <= s) || WIDTH_STEPS[WIDTH_STEPS.length - 1];
}

// -> { buf, type, resized }
// Never throws: when sharp is missing or cannot read the file, the caller gets the original bytes
// back and serves them unchanged (a picture that is a little too big always beats an empty card).
export async function resizeToWebp(input, width, quality = 74) {
  const w = cleanWidth(width);
  try {
    const sharp = (await import('sharp')).default;
    const meta = await sharp(input, { failOn: 'none', limitInputPixels: 50_000_000 }).metadata();
    if (!meta || !meta.width) throw new Error('not a picture');
    // Already small enough and already compressed: no point re-encoding (keeps the sharpest pixels).
    if (meta.width <= w * 1.15 && ['webp', 'jpeg', 'png'].includes(meta.format) && meta.size && meta.size < 60_000) {
      return { buf: input, type: meta.format === 'png' ? 'image/png' : meta.format === 'webp' ? 'image/webp' : 'image/jpeg', resized: false };
    }
    const buf = await sharp(input, { failOn: 'none', limitInputPixels: 50_000_000 })
      .rotate() // honour EXIF orientation (phone photos)
      .resize({ width: w, height: w, fit: 'inside', withoutEnlargement: true })
      .webp({ quality, effort: 3 })
      .toBuffer();
    return { buf, type: 'image/webp', resized: true };
  } catch {
    return { buf: input, type: '', resized: false };
  }
}


// ---------------------------------------------------------------- the request itself
// Kept here (not in the route file) so the whole decision - allow, fetch, resize, cache, fall back -
// can be tested with plain Node and a fake fetch, without a Next server.
const MAX_BYTES = 10 * 1024 * 1024;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

export const OK_HEADERS = {
  'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, stale-while-revalidate=604800, immutable',
  'X-Content-Type-Options': 'nosniff',
  'Access-Control-Allow-Origin': '*',
};
export const MISS_HEADERS = { 'Cache-Control': 'public, max-age=60, s-maxage=300' };

export function privateHost(host) {
  const h = String(host || '').toLowerCase();
  if (!h) return true;
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.localhost')) return true;
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (h === '::1' || h.startsWith('[')) return true;
  return false;
}

export function safeUrl(raw, allow = process.env.NEXT_PHOTO_HOSTS || '') {
  let x;
  try { x = new URL(String(raw || '').trim()); } catch { return null; }
  if (x.protocol !== 'https:') return null;
  if (privateHost(x.hostname)) return null;
  const list = String(allow || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (list.length) {
    const host = x.hostname.toLowerCase();
    const ok = list.some((d) => (d.startsWith('*.') ? host.endsWith(d.slice(1)) : host === d || host.endsWith(`.${d}`)));
    if (!ok) return null;
  }
  return x;
}

/**
 * -> { status, headers, body }  (body is a Buffer, or a string for the error/redirect cases)
 * Never throws: a caller always gets an answer it can send.
 */
export async function handlePhoto(rawUrl, rawWidth, { fetchImpl } = {}) {
  const target = safeUrl(rawUrl);
  if (!target) return { status: 400, headers: MISS_HEADERS, body: 'bad photo link' };
  const width = cleanWidth(rawWidth);
  const doFetch = fetchImpl || fetch;

  let res;
  try {
    res = await doFetch(target.toString(), {
      redirect: 'follow',
      signal: AbortSignal.timeout(9000),
      headers: {
        'User-Agent': UA,
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        Referer: `${target.origin}/`,
      },
    });
  } catch {
    return { status: 504, headers: MISS_HEADERS, body: 'photo host not reachable' };
  }
  if (!res || !res.ok) return { status: 502, headers: MISS_HEADERS, body: `photo host said ${res ? res.status : 'nothing'}` };
  if (res.url && !safeUrl(res.url)) return { status: 400, headers: MISS_HEADERS, body: 'bad redirect' };

  const type = String(res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!type.startsWith('image/')) return { status: 415, headers: MISS_HEADERS, body: 'not an image' };
  const len = Number(res.headers.get('content-length') || 0);
  if (len > MAX_BYTES) return { status: 307, headers: MISS_HEADERS, redirect: target.toString() };

  let buf;
  try { buf = Buffer.from(await res.arrayBuffer()); } catch { return { status: 502, headers: MISS_HEADERS, body: 'photo download failed' }; }
  if (!buf.length) return { status: 502, headers: MISS_HEADERS, body: 'empty photo' };
  if (buf.length > MAX_BYTES) return { status: 307, headers: MISS_HEADERS, redirect: target.toString() };

  // Vector / animated files are already tiny or must stay untouched.
  if (/svg|gif/.test(type)) {
    return { status: 200, headers: { ...OK_HEADERS, 'Content-Type': type, 'X-Photo': 'original' }, body: buf };
  }

  const out = await resizeToWebp(buf, width);
  if (!out.type) {
    // sharp is missing or could not read this file: the original bytes, from our own domain.
    return { status: 200, headers: { ...OK_HEADERS, 'Content-Type': type, 'X-Photo': 'original' }, body: buf };
  }
  return {
    status: 200,
    headers: { ...OK_HEADERS, 'Content-Type': out.type, 'X-Photo': out.resized ? `webp-${width}` : 'original-size' },
    body: out.buf,
  };
}
