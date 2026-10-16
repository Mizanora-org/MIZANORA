// The JSON FILE FORMAT of the product archive (data/catalog). No imports from the server side, so the admin panel (browser)
// and the server build exactly the same files.
//   data/catalog/manifest.json      { version, total, parts:[{ n, file, cards, count, at }] }
//   data/catalog/part-0001.json     full products [{ id, ...product fields }]       (opened only when ONE product is needed)
//   data/catalog/cards-0001.json    slim rows for lists + search                    (loaded together, 250 bytes per product)
// Supplier cost and profit are NEVER written to these files (the repository may be public).
import { catsOf } from './cats.js';
import { optionsOf } from './options.js';
import { isVideoUrl, splitMedia } from './media.js';

export const PART_SIZE = 500;
export const partFile = (n) => `part-${String(n).padStart(4, '0')}.json`;
export const cardsFile = (n) => `cards-${String(n).padStart(4, '0')}.json`;
export const MANIFEST_PATH = 'data/catalog/manifest.json';

const PRIVATE = ['kw', 'catSlugs', 'hiddenReason', 'cost', 'profit', 'supplierSku', 'sourceUrl'];
export function cleanDoc(id, data) {
  const d = { ...data };
  PRIVATE.forEach((k) => delete d[k]);
  const m = splitMedia(d.images, d.videos); // a video link can never sit in the photos of an archive file
  return { id: String(id), ...d, images: m.images, videos: m.videos };
}

// Slim row for lists and search. Short keys on purpose (50,000 products stay around 15 MB).
export function cardRow(doc) {
  const cats = catsOf(doc);
  const opts = optionsOf(doc).slice(0, 3).map((o) => [o.name, o.values.slice(0, 10)]);
  // Video links are separated from photos here, so a card NEVER points at a video as if it were a picture.
  const media = splitMedia(doc.images, doc.videos);
  const row = {
    id: String(doc.id), n: String(doc.name || '').slice(0, 140), p: Number(doc.price) || 0, c: Number(doc.comparePrice) || 0,
    i: media.images[0] || '', k: cats, t: Number(doc.createdAt) || 0,
  };
  if (media.videos.length) row.v = media.videos[0]; // first video (used by the reels feed + the card fallback)
  if (doc.inStock === false) row.s = 0;
  if (doc.active === false) row.x = 0; // hidden by the admin (Archive catalogue page); the shop must not list it
  if (optionsOf(doc).length) row.o = 1;
  if (opts.length) row.q = opts;
  if (doc.featured) row.f = 1;
  if (doc.affOn === false) row.a = 0;
  if (Number(doc.affRate) > 0) row.r = Number(doc.affRate);
  const d = String(doc.description || '').replace(/\s+/g, ' ').slice(0, 90);
  if (d) row.d = d;
  return row;
}

// Rows -> the same shape the shop's product cards use.
// Old cards (written before the media split) may still hold a video link in "i" - that is fixed here on read, so the whole
// existing catalogue (50,000 products in data/catalog) is repaired without re-importing anything.
export function rowToCard(r, part = 0) {
  let image = r.i ? String(r.i) : '';
  let video = r.v ? String(r.v) : '';
  if (image && isVideoUrl(image)) {
    const m = splitMedia([image], []);
    if (m.videos.length) video = video || m.videos[0];
    image = m.images[0] || '';
  }
  return {
    id: r.id, slug: r.id, name: r.n, price: r.p, comparePrice: r.c || 0, images: image ? [image] : [], videos: video ? [video] : [],
    hasOptions: Boolean(r.o), inStock: r.s !== 0, active: r.x !== 0,
    category: (r.k && r.k[0]) || '', categories: r.k || [], description: r.d || '', options: (r.q || []).map(([name, values]) => ({ name, values })), specs: [],
    createdAt: r.t || 0, featured: Boolean(r.f), affOn: r.a !== 0, affRate: r.r || 0, part,
  };
}

// The files of ONE part from product documents [{ id, data }]. Pure (works in the browser and on the server).
export function buildPartFiles(docs, n) {
  const full = docs.map((d) => cleanDoc(d.id, d.data));
  return {
    part: JSON.stringify(full), cards: JSON.stringify(full.map(cardRow)),
    meta: { n, file: partFile(n), cards: cardsFile(n), count: full.length, at: Date.now() },
    ids: full.map((d) => d.id),
  };
}
