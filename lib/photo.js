// v60 — ONE PLACE FOR "MAKE THIS PHOTO SMALL".
//
// The shop's photos live on supplier CDNs (the catalogue's 21,974 products all point at one
// DigitalOcean Space). Those files are uploaded at full size: 800-2000 px JPEGs of 150-500 KB.
// A product card is 200 px wide, a phone needs ~400 px (2x), so every card used to download
// 10-30x more pixels than it can show. That is what kept the mobile PageSpeed score at 8:
// the largest picture alone could take 10+ seconds on a 4G phone.
//
// Now every remote photo is asked from OUR OWN address, resized and converted to WebP:
//
//   https://cdn.example.com/a/big-photo.jpg  ->  /api/photo?u=...&w=400   (~12-20 KB)
//
// The answer is cached at the edge for a year (the URL contains the width), so the work is done
// once per picture and size — and the visitor's phone downloads a fraction of the bytes.
//
// A picture that is already local (/icons/..., /img/...) or that is not http(s) is left alone.
// Set NEXT_PHOTO_RESIZE=0 in Vercel to switch the whole thing off (the shop then loads the
// original links, exactly as before). Set NEXT_PHOTO_HOSTS="a.com,b.com" to allow only some hosts.

export const PHOTO_RESIZE = process.env.NEXT_PUBLIC_PHOTO_RESIZE !== '0';

// Card (≈200 px on a phone) -> 400 = 2x. Hero/gallery -> wider. Keep this list short: every
// width is one more cached variant on the edge.
export const W = { card: 320, card2x: 640, thumb: 96, hero: 900, wide: 1280 };

export function isRemote(src) {
  return /^https?:\/\//i.test(String(src || '').trim());
}

// -> "/api/photo?u=<encoded>&w=400" (or the original link when there is nothing to do)
export function photoUrl(src, width = W.card2x) {
  const s = String(src || '').trim();
  if (!s || !PHOTO_RESIZE || !isRemote(s)) return s;
  const w = Math.max(32, Math.min(2000, Math.round(Number(width) || W.card2x)));
  return `/api/photo?u=${encodeURIComponent(s)}&w=${w}`;
}

// Responsive candidates for the common 1x/2x phone+desktop case.
export function photoSrcSet(src, width = W.card2x) {
  const s = String(src || '').trim();
  if (!s || !PHOTO_RESIZE || !isRemote(s)) return undefined;
  const w = Math.max(32, Math.min(2000, Math.round(Number(width) || W.card2x)));
  return `${photoUrl(s, w)} 1x, ${photoUrl(s, Math.min(2000, w * 2))} 2x`;
}

// A short, stable ETag-ish id for logging / admin diagnostics.
export function photoKey(src, width) {
  const s = String(src || '');
  let h = 7;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `${h.toString(36)}-${width}`;
}
