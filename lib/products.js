import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { adminDb, adminReady } from './firebase-admin';
import { FieldPath } from 'firebase-admin/firestore';
import { restListPage, restReady } from './firestore-rest';
import { optionsOf, specsOf } from './options';
import { parseVideo } from './video';
import { slugify } from './format';
import { catsOf } from './cats';

function shape(d) {
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

// One page. Cursor is '' (first page), 'a:<docId>' (Admin SDK) or 'r:<token>' (public REST).
// THROWS when every source fails, so that a failure is never stored in the cache.
async function fetchPage(name, cursor) {
  const useRest = cursor.startsWith('r:');
  if (!useRest && adminReady()) {
    try {
      let q = adminDb().collection(name).orderBy(FieldPath.documentId()).limit(PAGE);
      if (cursor.startsWith('a:')) q = q.startAfter(cursor.slice(2));
      const snap = await q.get();
      const docs = snap.docs.map((d) => ({ id: d.id, data: JSON.parse(JSON.stringify(d.data())) }));
      return { docs, next: snap.docs.length === PAGE ? `a:${snap.docs[snap.docs.length - 1].id}` : '' };
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

const cachedPage = unstable_cache(fetchPage, ['mz-docs-v3'], { revalidate: CATALOG_TTL, tags: ['catalog'] });

// If a refresh fails (quota, network), keep showing the last good copy instead of an empty shop.
const lastGood = new Map();

// Never throws: on failure the site still builds (with the last good list, or an empty one) and the reason is logged.
async function listDocs(name) {
  try {
    const all = [];
    let cursor = '';
    for (let i = 0; i < 100; i++) {
      const r = await cachedPage(name, cursor);
      all.push(...r.docs);
      if (!r.next) break;
      cursor = r.next;
    }
    lastGood.set(name, all);
    return all;
  } catch (e) { console.error(e.message); return lastGood.get(name) || []; }
}

export const getProducts = cache(async function getProducts() {
  const docs = await listDocs('products');
  return docs.map(shape).filter((p) => p.active && p.name).sort((a, b) => b.createdAt - a.createdAt);
});

// One product, taken from the shared cached list (no extra Firestore read per product page).
export async function getProduct(slug) {
  if (!slug) return null;
  const all = await getProducts();
  return all.find((p) => p.slug === slug) || null;
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

export const getCategories = cache(async function getCategories() {
  return buildCategories(await getProducts());
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
