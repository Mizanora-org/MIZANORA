import fs from 'node:fs/promises';
import path from 'node:path';
import { rowToCard } from './archiveFormat.js';
import { slugify } from './format';
import { normText, parseQuery, smartSearch, stem, wordGroup } from './search';

// READ SIDE of the product archive (server only). Old products live as JSON files in the repository (data/catalog), not in Firebase:
// no reads, no writes, no quota. The slim "cards" of all parts are loaded once per server instance and indexed in memory; the full
// product (description, all photos) is read from its part file only when ONE product is opened, a few parts are kept for speed.
const DIR = path.join(process.cwd(), 'data', 'catalog');
const read = async (f) => JSON.parse(await fs.readFile(path.join(DIR, f), 'utf8'));

let manifestP = null;
export function archiveManifest() {
  if (!manifestP) manifestP = read('manifest.json').then((m) => ({ parts: Array.isArray(m.parts) ? m.parts : [], total: Number(m.total) || 0 })).catch(() => ({ parts: [], total: 0 }));
  return manifestP;
}

let cardsP = null;
// -> { list: [card], byId: Map, byCat: Map(slug -> [index]), inv: Map(word -> [index]), cats: [{name,slug,count,image}] }
export function archiveCards() {
  if (!cardsP) {
    cardsP = (async () => {
      const m = await archiveManifest();
      // A product that appears in several parts counts once: the NEWEST part wins (that is how a re-imported product replaces the old one).
      const rows = [];
      for (const part of m.parts) {
        try { for (const r of await read(part.cards)) rows.push(rowToCard(r, part.n)); } catch (e) { console.error(`archive cards ${part.cards}:`, e.message); }
      }
      const seenIds = new Set();
      const list = [];
      for (let i = rows.length - 1; i >= 0; i--) {
        const r = rows[i];
        if (seenIds.has(r.id)) continue;
        seenIds.add(r.id);
        if (r.x === 0) continue; // hidden by the admin: kept in the file, not in the shop
        list.push(r);
      }
      list.reverse();
      const byId = new Map(), byCat = new Map(), inv = new Map(), cats = new Map();
      list.forEach((c, i) => {
        byId.set(c.id, i);
        for (const name of c.categories) {
          const s = slugify(name);
          if (!s) continue;
          (byCat.get(s) || byCat.set(s, []).get(s)).push(i);
          const x = cats.get(s) || { name, slug: s, count: 0, image: '' };
          x.count += 1; if (!x.image && c.images[0]) x.image = c.images[0]; cats.set(s, x);
        }
        const words = new Set(`${c.name} ${c.categories.join(' ')}`.split(/[^a-z0-9\u0600-\u06ff]+/i).map((w) => stem(w.toLowerCase())).filter((w) => w.length >= 2));
        for (const w of words) (inv.get(w) || inv.set(w, []).get(w)).push(i);
      });
      return { list, byId, byCat, inv, cats: [...cats.values()].sort((a, b) => b.count - a.count) };
    })();
  }
  return cardsP;
}
export const archiveTotal = async () => (await archiveManifest()).total;

// Full products (a few part files are remembered).
const parts = new Map();
async function partMap(n) {
  if (parts.has(n)) { const v = parts.get(n); parts.delete(n); parts.set(n, v); return v; }
  const m = await archiveManifest();
  const meta = m.parts.find((p) => p.n === n);
  if (!meta) return null;
  const arr = await read(meta.file);
  const map = new Map(arr.map((d) => [String(d.id), d]));
  parts.set(n, map);
  if (parts.size > 4) parts.delete(parts.keys().next().value);
  return map;
}
// The raw product document of an archived product ({ id, data }) or null.
export async function archiveProduct(id) {
  const A = await archiveCards();
  const i = A.byId.get(String(id));
  if (i === undefined) return null;
  const map = await partMap(A.list[i].part);
  const d = map && map.get(String(id));
  if (!d) return null;
  const { id: _id, ...data } = d;
  return { id: String(id), data };
}
// Several at once (orders): { id: data } for the ids that are archived.
export async function archiveDocs(ids) {
  const out = {};
  for (const id of ids) { const p = await archiveProduct(id); if (p) out[id] = p.data; }
  return out;
}

// ---- search / browse inside the archive ---------------------------------------------------------------------------------
const sortFns = { low: (a, b) => a.price - b.price, high: (a, b) => b.price - a.price, new: (a, b) => b.createdAt - a.createdAt };
const MAX_CANDIDATES = 4000;

export async function searchArchive(q, { intent, cat = '', min = 0, max = 0, sort = '', limit = 300 } = {}) {
  const A = await archiveCards();
  if (!A.list.length) return { results: [], exact: false };
  const i = { ...parseQuery(q), ...(intent || {}) };
  const words = (i.words || []).slice(0, 4);
  let idx = null;
  if (words.length) {
    const score = new Map();
    for (const w of words) {
      const seen = new Set();
      for (const t of wordGroup(w)) for (const n of A.inv.get(t) || []) if (!seen.has(n)) { seen.add(n); score.set(n, (score.get(n) || 0) + 1); }
    }
    idx = [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_CANDIDATES).map(([n]) => n);
  }
  let list;
  if (idx && idx.length) list = idx.map((n) => A.list[n]);
  else if (!words.length) list = (i.colors || []).length ? A.list.slice(0, 20000) : [];
  else list = A.list; // nothing matched exactly (typo / half word): slower full scan
  if (cat) { const allowed = new Set(A.byCat.get(cat) || []); list = list.filter((c) => allowed.has(A.byId.get(c.id))); }
  const r = smartSearch(list, q, { limit, intent: { ...i, min: min || i.min || 0, max: max || i.max || 0, sort: sort || i.sort || '' } });
  return { results: r.results, exact: r.exact };
}

export async function archiveBrowseList({ cat = '' } = {}) {
  const A = await archiveCards();
  if (!cat) return A.list;
  return (A.byCat.get(cat) || []).map((n) => A.list[n]);
}
export { sortFns, normText };
