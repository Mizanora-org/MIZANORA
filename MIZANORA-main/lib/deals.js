// DEALS PAGE (v23): ONE link (/deals) that gathers every product with a real discount (a price lower than its old price).
// Pure code shared by the admin page, the server and the browser.
import { discountPct, slugify } from './format.js';

export const DEALS_DOC = { collection: 'siteMeta', id: 'deals' };
export const DEALS_DEFAULT = {
  enabled: true,
  title: 'Mizanora Deals',
  subtitle: 'Sab se bari bachat ek hi jagah. Asli purani qeemat, asli kam qeemat.',
  minPct: 5,          // a product needs at least this % off to be listed
  endsAtMs: 0,        // optional "deals end" countdown (0 = none)
  pinned: [],         // product slugs shown first, even without a discount ("Hot picks")
  badge: 'Limited time',
};
export const MIN_PCT_CHOICES = [5, 10, 20, 30, 50];
export const SORTS = [['pct', 'Biggest % off'], ['saved', 'Biggest Rs saved'], ['low', 'Price: low to high'], ['high', 'Price: high to low'], ['new', 'Newest']];

const txt = (v, n, d = '') => String(v == null ? d : v).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
export function cleanDeals(x = {}) {
  const d = DEALS_DEFAULT;
  const pinned = [...new Set((Array.isArray(x.pinned) ? x.pinned : String(x.pinned || '').split(/[\s,]+/)).map((s) => slugify(s)).filter(Boolean))].slice(0, 24);
  return {
    enabled: x.enabled !== false,
    title: txt(x.title, 60, d.title) || d.title,
    subtitle: txt(x.subtitle, 160, d.subtitle),
    minPct: Math.min(90, Math.max(1, Math.floor(Number(x.minPct)) || d.minPct)),
    endsAtMs: Math.max(0, Number(x.endsAtMs) || 0),
    pinned,
    badge: txt(x.badge, 24, d.badge),
  };
}

export const savedOf = (c) => Math.max(0, (Number(c.comparePrice) || 0) - (Number(c.price) || 0));
export const pctOf = (c) => discountPct(c.price, c.comparePrice);

// Sorts and filters a list of product cards into the deals list. `pinned` slugs come first (in the admin's order).
export function dealList(cards, { minPct = 5, sort = 'pct', cat = '', pinned = [] } = {}) {
  const inCat = (c) => !cat || (c.categories || [c.category]).some((n) => slugify(n) === cat);
  const real = cards.filter((c) => c && c.inStock !== false && pctOf(c) >= minPct && inCat(c));
  const by = {
    pct: (a, b) => pctOf(b) - pctOf(a) || savedOf(b) - savedOf(a),
    saved: (a, b) => savedOf(b) - savedOf(a),
    low: (a, b) => a.price - b.price,
    high: (a, b) => b.price - a.price,
    new: (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
  }[sort] || ((a, b) => pctOf(b) - pctOf(a));
  const order = new Map(pinned.map((s, i) => [s, i]));
  const hot = cards.filter((c) => c && c.inStock !== false && order.has(c.slug) && inCat(c)).sort((a, b) => order.get(a.slug) - order.get(b.slug));
  const hotIds = new Set(hot.map((c) => c.id));
  return [...hot, ...real.filter((c) => !hotIds.has(c.id)).sort(by)];
}

// Category chips for the deals page, built from the deals themselves.
export function dealChips(cards, minPct = 5) {
  const m = new Map();
  for (const c of cards) {
    if (!c || pctOf(c) < minPct) continue;
    for (const name of (c.categories && c.categories.length ? c.categories : [c.category]).filter(Boolean)) {
      const slug = slugify(name);
      const e = m.get(slug) || { slug, name, count: 0 };
      e.count += 1; m.set(slug, e);
    }
  }
  return [...m.values()].sort((a, b) => b.count - a.count).slice(0, 14);
}
