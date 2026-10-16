import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { adminDb, adminReady } from './firebase-admin';
import { FieldPath } from 'firebase-admin/firestore';
import { restGet, restListPage, restReady } from './firestore-rest';
import { archiveCards, archiveProduct, archiveTotal } from './archive';
import { optionsOf, specsOf } from './options';
import { parseVideo } from './video';
import { slugify } from './format';
import { catsOf } from './cats';

export function shape(d) {
  const x = d.data;
  return {
    id: d.id,
    slug: d.id,
    name: x.name || '',
    price: Number(x.price) || 0,
    comparePrice: Number(x.comparePrice) || 0,
    description: x.description || '',
    images: Array.isArray(x.images) ? x.images.filter(Boolean) : [],
    options: optionsOf(x),
    specs: specsOf(x),
    sizes: optionsOf(x).flatMap((o) => o.values), // non-empty means "shopper must choose options"
    videos: Array.isArray(x.videos) ? x.videos.filter(Boolean) : [],
    category: catsOf(x)[0] || '',
    categories: catsOf(x),
    inStock: x.inStock !== false,
    affOn: x.affOn !== false,
    affRate: Number(x.affRate) || 0,
    featured: Boolean(x.featured),
    dealRoom: x.dealRoom === undefined || x.dealRoom === null ? null : Number(x.dealRoom),
    active: x.active !== false,
    createdAt: Number(x.createdAt) || 0,
    updatedAt: Number(x.updatedAt) || 0,
  };
}

// ---------------------------------------------------------------------------------------------
// FIRESTORE READ SAVER
// Every page (and the layout) needs the product list. Before, each page re-read the WHOLE collection
// from Firestore every time it refreshed, so a few visitors / Google bots burned the 50K daily read quota.
// Now the collection is read ONCE and shared by all pages through Next's data cache (tag "catalog").
// It refreshes only when (a) the admin saves something (/api/revalidate clears the tag) or
// (b) CATALOG_TTL seconds (12 hours by default) have passed as a safety net. Visitors never cause Firestore reads.
// ---------------------------------------------------------------------------------------------
const CATALOG_TTL = Number(process.env.CATALOG_CACHE_SECONDS) || 12 * 60 * 60;

// SIZE-SAFE CACHE: Next's data cache refuses entries over 2 MB. A big catalogue (hundreds of products with photos,
// options and descriptions) can pass that limit, and then EVERY visit would re-read the whole collection from Firestore.
// So the collection is read and cached in small pages (PAGE docs each). Each page is its own cache entry.
const PAGE = 100;

// STORE WINDOW (for catalogues of tens of thousands to lakhs of products).
// The shop pages (home, search suggestions, feeds, sitemap) keep the NEWEST `STORE_WINDOW` products in memory (default 2500).
// Everything older is still on the shop: product pages open it directly, and /products + category pages load the rest from
// Firestore page by page (see lib/catalogQuery.js). A small shop (under the window) works exactly as before.
export const STORE_WINDOW = Math.max(200, Number(process.env.STORE_WINDOW) || 2500);

// One page. Cursor is '' (first page), 'a:<docId>' (Admin SDK, id order), 'n:<createdAt>:<docId>' (Admin SDK, newest first) or 'r:<token>' (public REST).
// THROWS when every source fails, so that a failure is never stored in the cache.
async function fetchPage(name, cursor) {
  const useRest = cursor.startsWith('r:');
  if (!useRest && adminReady()) {
    try {
      const newest = name === 'products' && (cursor === '' || cursor.startsWith('n:'));
      let q = newest
        ? adminDb().collection(name).orderBy('createdAt', 'desc').orderBy(FieldPath.documentId(), 'desc').limit(PAGE)
        : adminDb().collection(name).orderBy(FieldPath.documentId()).limit(PAGE);
      if (cursor.startsWith('n:')) { const [, at, ...id] = cursor.split(':'); q = q.startAfter(Number(at), id.join(':')); }
      else if (cursor.startsWith('a:')) q = q.startAfter(cursor.slice(2));
      const snap = await q.get();
      if (newest && cursor === '' && snap.empty) return fetchPage(name, 'a:'); // old products without createdAt: plain listing
      const docs = snap.docs.map((d) => ({ id: d.id, data: JSON.parse(JSON.stringify(d.data())) }));
      const last = snap.docs[snap.docs.length - 1];
      const nextCur = snap.docs.length < PAGE ? '' : newest ? `n:${Number(last.data().createdAt) || 0}:${last.id}` : `a:${last.id}`;
      return { docs, next: nextCur };
    } catch (e) {
      console.error(`Admin SDK read of ${name} failed (${e.message}); trying public REST.`);
      if (cursor) throw e; // never mix cursor types in the middle of a listing
    }
  }
  if (restReady()) {
    const r = await restListPage(name, PAGE, useRest ? cursor.slice(2) : '');
    return { docs: r.docs, next: r.next ? `r:${r.next}` : '' };
  }
  throw new Error(`No Firestore access configured for ${name}`);
}

const cachedPage = unstable_cache(fetchPage, ['mz-docs-v4'], { revalidate: CATALOG_TTL, tags: ['catalog'] });

// If a refresh fails (quota, network), keep showing the last good copy instead of an empty shop.
const lastGood = new Map();

// Never throws: on failure the site still builds (with the last good list, or an empty one) and the reason is logged.
// `max` stops after that many documents (the store window); collections other than products are small and read completely.
async function listDocs(name, max = Infinity) {
  try {
    const all = [];
    let cursor = '';
    for (let i = 0; i < 400; i++) {
      const r = await cachedPage(name, cursor);
      all.push(...r.docs);
      if (!r.next || all.length >= max) break;
      cursor = r.next;
    }
    lastGood.set(name, all);
    return all;
  } catch (e) { console.error(e.message); return lastGood.get(name) || []; }
}

// True when the window is full, i.e. the shop probably has MORE products than the list holds (counted on raw documents, hidden ones included).
export const windowFull = () => (lastGood.get('products') || []).length >= STORE_WINDOW;

export const getProducts = cache(async function getProducts() {
  const docs = await listDocs('products', STORE_WINDOW);
  return docs.map(shape).filter((p) => p.active && p.name).sort((a, b) => b.createdAt - a.createdAt);
});

// How many products the shop really has (one cheap count query, cached). Falls back to the window size when the count is unavailable.
const countProducts = unstable_cache(async () => {
  if (!adminReady()) throw new Error('count needs the Admin SDK');
  const r = await adminDb().collection('products').count().get();
  return Number(r.data().count) || 0;
}, ['mz-count-v1'], { revalidate: 6 * 60 * 60, tags: ['catalog'] });
export const getTotalCount = cache(async function getTotalCount() {
  let live;
  try { live = await countProducts(); } catch { live = (await getProducts()).length; }
  return live + (await archiveTotal());
});

// The shop is "large" when it has archived products or more live products than the window holds: the products page then loads
// page by page from the server instead of holding everything in the browser.
export async function isLargeShop() {
  await getProducts();
  return windowFull() || (await archiveTotal()) > 0;
}

// One product by slug. Newest products come from the shared list; any other product (lakhs of them can exist) is read directly,
// ONE document, and cached.
const oneDoc = unstable_cache(async (slug) => {
  if (adminReady()) {
    const d = await adminDb().collection('products').doc(slug).get();
    return d.exists ? { id: d.id, data: JSON.parse(JSON.stringify(d.data())) } : null;
  }
  if (restReady()) return restGet('products', slug);
  throw new Error('No Firestore access configured');
}, ['mz-one-v2'], { revalidate: CATALOG_TTL, tags: ['catalog'] });

export async function getProduct(slug) {
  if (!slug) return null;
  const all = await getProducts();
  const hit = all.find((p) => p.slug === slug);
  if (hit) return hit;
  if (windowFull()) { // more live products than the list holds: read this one document
    try {
      const d = await oneDoc(String(slug).slice(0, 120));
      const p = d ? shape(d) : null;
      if (p && p.active && p.name) return p;
    } catch (e) { console.error('product read failed:', e.message); }
  }
  try { // old products live in the archive files
    const a = await archiveProduct(String(slug).slice(0, 120));
    const p = a ? shape(a) : null;
    return p && p.active && p.name ? p : null;
  } catch (e) { console.error('archive read failed:', e.message); return null; }
}

// Several products by id (promo codes, worker tools): from the live list, else the archive. -> Map(id -> product)
export async function getProductsByIds(ids) {
  const out = new Map();
  const all = await getProducts();
  const have = new Map(all.map((p) => [p.id, p]));
  for (const id of [...new Set(ids.map(String))].slice(0, 30)) {
    const p = have.get(id) || await getProduct(id);
    if (p) out.set(id, p);
  }
  return out;
}

// Categories are built from the products' category field (so there is nothing extra to manage).
export function buildCategories(products) {
  const map = new Map();
  for (const p of products) {
    for (const raw of p.categories && p.categories.length ? p.categories : [p.category]) {
      const name = (raw || '').trim();
      if (!name) continue;
      const slug = slugify(name);
      if (!slug) continue;
      const c = map.get(slug) || { name, slug, count: 0, image: '' };
      c.count += 1;
      if (!c.image && p.images[0]) c.image = p.images[0];
      map.set(slug, c);
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

// Categories of the WHOLE shop: live products + archived products.
export const getCategories = cache(async function getCategories() {
  const live = buildCategories(await getProducts());
  let arch = [];
  try { arch = (await archiveCards()).cats; } catch { /* no archive */ }
  if (!arch.length) return live;
  const m = new Map(live.map((c) => [c.slug, { ...c }]));
  for (const c of arch) { const x = m.get(c.slug); if (x) { x.count += c.count; } else m.set(c.slug, { ...c }); }
  return [...m.values()].sort((a, b) => b.count - a.count);
});

export const getBanners = cache(async function getBanners() {
  const docs = await listDocs('banners');
  return docs
    .map(({ id, data: x }) => ({ id, image: x.image || '', title: x.title || '', subtitle: x.subtitle || '', link: x.link || '/products', cta: x.cta || 'Shop now', order: Number(x.order) || 0, active: x.active !== false }))
    .filter((b) => b.active && b.image)
    .sort((a, b) => a.order - b.order);
});

// Reels: videos you add in /admin/reels (YouTube / Facebook / Instagram / TikTok / .mp4 links), each with a Shop now link.
// Product videos are included automatically, so reels are never empty once a product has a video.
export const getReels = cache(async function getReels() {
  const [docs, products] = await Promise.all([listDocs('reels'), getProducts()]);
  const bySlug = Object.fromEntries(products.map((p) => [p.slug, p]));
  const curated = docs
    .map(({ id, data: x }) => ({ id, url: x.url || '', title: x.title || '', productSlug: x.productSlug || '', link: x.link || '', order: Number(x.order) || 0, active: x.active !== false }))
    .filter((r) => r.active && parseVideo(r.url))
    .sort((a, b) => a.order - b.order)
    .map((r) => {
      const p = bySlug[r.productSlug];
      return { id: `r-${r.id}`, url: r.url, title: r.title || (p && p.name) || 'Watch and shop', href: p ? `/product/${p.slug}` : (r.link || '/products'), price: p ? p.price : 0, image: p ? p.images[0] || '' : '' };
    });
  const seen = new Set(curated.map((r) => r.url));
  const fromProducts = products.flatMap((p) => (p.videos || []).filter((u) => parseVideo(u) && !seen.has(u)).slice(0, 1)
    .map((u) => ({ id: `p-${p.id}`, url: u, title: p.name, href: `/product/${p.slug}`, price: p.price, image: p.images[0] || '' })));
  return [...curated, ...fromProducts].slice(0, 30);
});
