import { getProducts } from './products';
import { archiveBrowseList, searchArchive, sortFns } from './archive';
import { parseQuery, smartSearch } from './search';
import { toCard } from './cardData';
import { slugify } from './format';
import { dealChips, dealList, pctOf } from './deals';

// SEARCH AND BROWSING FOR A BIG SHOP (live products from Firebase + archived products from the JSON files).
// Everything happens in server memory: ZERO Firestore reads per search, so thousands of searches a day never touch the free quota.
// A live product always wins over an archived product with the same id (that is how an edited old product overrides its archive copy).
const liveCards = async () => (await getProducts()).map(toCard).filter(hasPhoto);
const inCat = (c, cat) => !cat || (c.categories || []).some((n) => slugify(n) === cat);

// A product needs SOMETHING the shop can show: a photo, or a video (a video card is a real, beautiful card - see
// components/CardMedia.js). A product with neither is not sellable and never appears in a list, search result or feed.
// Hidden products (active:false) are refused here as a second safety net.
export const hasPhoto = (c) => Boolean(c && ((c.images && c.images[0]) || c.image || (c.videos && c.videos.length) || c.video)) && c.active !== false;

export async function searchRemote(q, { intent, cat = '', sort = '', min = 0, max = 0, limit = 60 } = {}) {
  const i = { ...parseQuery(q), ...(intent || {}) };
  const opts = { ...i, min: min || i.min || 0, max: max || i.max || 0, sort: sort || i.sort || '' };
  const live = (await liveCards()).filter((c) => inCat(c, cat));
  const liveIds = new Set(live.map((c) => c.id));
  const a = await searchArchive(q, { intent: opts, cat, min: opts.min, max: opts.max, sort: opts.sort, limit: 300 });
  const l = smartSearch(live, q, { limit: 300, intent: opts });
  const pool = [...l.results, ...a.results.filter((c) => !liveIds.has(c.id))].filter(hasPhoto);
  if (!pool.length) return { items: [], ok: true, exact: false };
  const r = smartSearch(pool, q, { limit, intent: opts });
  return { items: r.results.map((c) => ({ ...c, description: (c.description || '').slice(0, 120) })), ok: true, exact: r.exact };
}

// Merged, sorted list for one (category, sort, budget): remembered for 2 minutes.
const lists = new Map();
async function merged(cat, sort, min, max) {
  const live = await getProducts();
  const stamp = `${live.length}:${live.reduce((m, p) => Math.max(m, p.updatedAt || 0), 0)}`;
  const key = `${cat}|${sort}|${min}|${max}|${stamp}`;
  const hit = lists.get(key);
  if (hit && Date.now() - hit.t < 120e3) return hit.v;
  const liveC = live.map(toCard).filter((c) => inCat(c, cat)).filter(hasPhoto);
  const liveIds = new Set(live.map((p) => p.id));
  let all = [...liveC, ...(await archiveBrowseList({ cat })).filter((c) => !liveIds.has(c.id) && hasPhoto(c))];
  if (min) all = all.filter((c) => c.price >= min);
  if (max) all = all.filter((c) => c.price <= max);
  all = [...all].sort(sortFns[sort] || sortFns.low);
  if (lists.size > 40) lists.clear();
  lists.set(key, { t: Date.now(), v: all });
  return all;
}

export async function browseRemote({ cat = '', sort = 'low', min = 0, max = 0, cursor = '', size = 48 } = {}) {
  const s = ['low', 'high', 'new'].includes(sort) ? sort : 'low';
  const all = await merged(String(cat).slice(0, 80), s, Math.max(0, Number(min) || 0), Math.max(0, Number(max) || 0));
  const from = cursor.startsWith('i:') ? Math.max(0, Number(cursor.slice(2)) || 0) : 0;
  const items = all.slice(from, from + size).map((c) => ({ ...c, description: (c.description || '').slice(0, 120) }));
  return { items, next: from + size < all.length ? `i:${from + size}` : '', ok: true, total: all.length };
}

// v23 DEALS: every in-stock product whose price is under its old price (live + archived), best deal first. Same 2-minute list cache as browsing,
// so the deals page and its "load more" cost no database reads.
export async function dealsRemote({ minPct = 5, cat = '', sort = 'pct', cursor = '', size = 48, pinned = [] } = {}) {
  const all = await merged('', 'low', 0, 0);
  const list = dealList(all, { minPct: Math.max(1, Number(minPct) || 5), sort, cat: String(cat || '').slice(0, 80), pinned });
  const from = String(cursor).startsWith('i:') ? Math.max(0, Number(String(cursor).slice(2)) || 0) : 0;
  const items = list.slice(from, from + size).map((c) => ({ ...c, description: (c.description || '').slice(0, 120) }));
  return { items, next: from + size < list.length ? `i:${from + size}` : '', total: list.length, chips: from ? undefined : dealChips(all, Math.max(1, Number(minPct) || 5)), maxPct: list.reduce((m, c) => Math.max(m, pctOf(c)), 0), ok: true };
}

// For the sitemap / feeds: every card (live first, then archived).
export async function allCards() {
  const live = await getProducts();
  const ids = new Set(live.map((p) => p.id));
  return { live: live.filter((p) => (p.images || [])[0]), archived: (await archiveBrowseList({})).filter((c) => !ids.has(c.id) && hasPhoto(c)) };
}
