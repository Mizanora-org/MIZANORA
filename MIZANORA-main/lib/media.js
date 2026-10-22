import { parseVideo } from './video.js';

// ONE RULE FOR THE WHOLE SHOP: a video link is never a photo.
// Supplier CSVs often put a Facebook / Instagram / TikTok / YouTube / .mp4 link in the "images" column. Before, the shop
// tried to draw it as a picture, the photo never loaded, and the product looked broken. Now every product's media is
// split once, in one place, and a YouTube video even gives us a real thumbnail to use as the product photo.
export const isVideoUrl = (u) => Boolean(parseVideo(u));

export function splitMedia(images, videos) {
  const imgs = [];
  const vids = [];
  for (const raw of Array.isArray(images) ? images : []) {
    const u = String(raw || '').trim();
    if (!u) continue;
    if (isVideoUrl(u)) { if (!vids.includes(u)) vids.push(u); }
    else if (!imgs.includes(u)) imgs.push(u);
  }
  for (const raw of Array.isArray(videos) ? videos : []) {
    const u = String(raw || '').trim();
    if (u && !vids.includes(u)) vids.push(u);
  }
  // A YouTube link carries a free, always-working photo: use it so the product card shows a picture.
  for (const v of vids) {
    const p = parseVideo(v);
    if (p && p.type === 'youtube' && p.thumb && !imgs.includes(p.thumb)) imgs.unshift(p.thumb);
  }
  return { images: imgs.slice(0, 8), videos: vids.slice(0, 6) };
}

// Does this product have something the shop can actually display? A photo, or a video card (see components/CardMedia).
export const hasMedia = (p) => Boolean(p && (((p.images || [])[0]) || p.image || (p.videos || []).length || p.video));

// The first video of a product (for the card fallback and the reels feed).
export const firstVideo = (p) => ((p && p.videos) || [])[0] || (p && p.video) || '';
