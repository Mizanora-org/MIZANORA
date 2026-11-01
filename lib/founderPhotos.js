// v36: THE FOUNDER'S OWN PHOTOS, SELF-HOSTED.  (server only - it reads a file from disk)
//
// Before v36 the only pictures of Muaaz Iqbal were two links to a third-party image host.
// Those links can rot, they send a referrer, they can be hotlink-blocked, and Google sees them
// as somebody else's images. The shop now keeps its own copies in `public/img/muaaz/`:
//
//   /img/muaaz/muaaz-iqbal-01.jpg        full  (max 1200px)  gallery + Open Graph
//   /img/muaaz/muaaz-iqbal-01-thumb.jpg  thumb (max  480px)  cards and grids
//   /img/muaaz/muaaz-iqbal-01-sq.jpg     square 512x512      avatars and round bubbles
//
// `data/muaaz-photos.json` is the manifest written by `scripts/muaaz-photos.mjs`. It holds the
// real width/height (so the browser reserves space and the page does not jump) and the alt text
// (which is how Google Images and screen readers understand a picture). Edit the alt text there.
//
// Everything degrades quietly: no manifest, empty manifest or a damaged file all return [].
// The pages then fall back to the old remote links, and then to the founder's initials.

import fs from 'fs';
import path from 'path';

const FILE = () => path.join(process.cwd(), 'data', 'muaaz-photos.json');

const str = (v, max = 400) => String(v ?? '').trim().slice(0, max);
const num = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n) : 0; };

// A manifest entry is trusted only if it points at a file the shop actually serves.
const cleanPhoto = (raw = {}, i = 0) => {
  const id = str(raw.id, 60) || `muaaz-${i + 1}`;
  const src = str(raw.src, 300);
  if (!src.startsWith('/img/') && !src.startsWith('http')) return null;
  const local = src.startsWith('/');
  if (local && !/^https?:$/.test(src)) {
    // no directory tricks: only simple /img/... paths are ever rendered
    if (/\.\.|%2e%2e/i.test(src)) return null;
  }
  return {
    id,
    src,
    thumb: str(raw.thumb, 300) || src,
    square: str(raw.square, 300) || src,
    width: num(raw.width),
    height: num(raw.height),
    title: str(raw.title, 140),
    alt: str(raw.alt, 300) || 'Muaaz Iqbal, founder and developer of Mizanora',
    caption: str(raw.caption, 300),
    group: str(raw.group, 30) || 'muaaz',
    atMs: num(raw.atMs) || 0,
    local,
  };
};

let cache;

/** Every photo of the founder that ships with the site (never throws). */
export function getFounderPhotos() {
  if (cache) return cache;
  cache = [];
  try {
    const p = FILE();
    if (!fs.existsSync(p)) return cache;
    const json = JSON.parse(fs.readFileSync(p, 'utf8'));
    const list = Array.isArray(json) ? json : Array.isArray(json?.photos) ? json.photos : [];
    cache = list.map(cleanPhoto).filter(Boolean);
  } catch (e) {
    console.error('founderPhotos: could not read the photo manifest -', e.message);
    cache = [];
  }
  return cache;
}

/** Newest first, so a newly added picture leads the gallery. */
export const sortedFounderPhotos = () => [...getFounderPhotos()].sort((a, b) => b.atMs - a.atMs);

/** Avatar links for <FounderPhoto>: own square files first, then any remote fallbacks. */
export const founderAvatarPhotos = (fallback = []) => [
  ...sortedFounderPhotos().map((p) => p.square),
  ...(Array.isArray(fallback) ? fallback : []).filter((u) => typeof u === 'string' && /^https?:\/\//.test(u)),
];

/** The single best picture for Open Graph / Twitter cards / the default image. */
export const founderHeroPhoto = (fallback = '/img/hero-banner.jpg') => {
  const p = sortedFounderPhotos().find((x) => x.local && x.width >= 600);
  return p ? p.src : fallback;
};

/** ImageObject rows for structured data, so Google can index each picture properly. */
export const founderPhotoJsonLd = (baseUrl = '') => {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  const abs = (p) => (p.src.startsWith('http') ? p.src : `${base}${p.src}`);
  return sortedFounderPhotos().map((p) => {
    const row = { '@type': 'ImageObject', url: abs(p), contentUrl: abs(p), caption: p.caption || p.alt, name: p.title || p.alt };
    if (p.width && p.height) { row.width = `${p.width}`; row.height = `${p.height}`; }
    return row;
  });
};

/**
 * Absolute URLs for the image sitemap (Google Images).
 * A sitemap must contain absolute URLs - and the base is usually passed in as `absUrl('/')`,
 * which already ends in a slash, so it is trimmed here. Otherwise the sitemap ships
 * `https://mizanora.vercel.app//img/...` and Google rejects the entry.
 */
export const founderPhotoUrls = (baseUrl = '') => {
  const base = String(baseUrl || '').replace(/\/+$/, '');
  return sortedFounderPhotos().map((p) => (p.src.startsWith('http') ? p.src : `${base}${p.src}`));
};

/** True when the shop has its own pictures (used by tests and by the admin notice). */
export const hasLocalFounderPhotos = () => getFounderPhotos().some((p) => p.local);
