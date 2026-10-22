// DEAL GROUPS (v23.1): the admin names a group of products ("Shirts", "Men's shoes", "Watches") by words, and gives it ONE rate:
// either a percent off or a fixed price. Pure code, shared by the admin page, the server action and the tests.
import { slugify } from './format.js';

export const GROUP_LIMIT = 24;
const stem = (w) => {
  const t = String(w || '').toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, '');
  if (/ies$/.test(t) && t.length > 4) return `${t.slice(0, -3)}y`;
  if (/(ss|x|ch|sh)es$/.test(t)) return t.slice(0, -2);
  if (/[^s]s$/.test(t)) return t.slice(0, -1);
  return t;
};
export const tokensOf = (text) => String(text || '').toLowerCase().split(/[^a-z0-9؀-ۿ]+/).map(stem).filter((w) => w.length >= 2);
const wordList = (v) => (Array.isArray(v) ? v : String(v || '').split(/[,\n;]+/)).map((s) => String(s).replace(/[<>]/g, '').trim().slice(0, 40)).filter(Boolean).slice(0, 20);

export function cleanGroup(x = {}) {
  const pct = Math.min(80, Math.max(0, Math.floor(Number(x.pct)) || 0));
  const price = Math.max(0, Math.floor(Number(x.price)) || 0);
  const name = String(x.name || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (!name) return null;
  return { id: slugify(x.id || name).slice(0, 40) || 'group', name, words: wordList(x.words), exclude: wordList(x.exclude), pct: price ? 0 : pct, price, on: x.on !== false };
}
export function cleanGroups(list) {
  const seen = new Set();
  const out = [];
  for (const g of Array.isArray(list) ? list : []) {
    const c = cleanGroup(g);
    if (!c || seen.has(c.id)) continue;
    seen.add(c.id); out.push(c);
    if (out.length >= GROUP_LIMIT) break;
  }
  return out;
}

// Does this product belong to the group? A product matches when ANY group word is one of its words (name, category, tags),
// and none of the "not" words is. Words match whole words ("men" does not match "women"; "shirt" matches "shirts").
export function productWords(p) {
  const cats = [].concat(p.categories || [], p.category || [], p.tags || []);
  return new Set(tokensOf(`${p.name || ''} ${cats.join(' ')}`));
}
export function matchesGroup(p, g) {
  if (!g || !g.words || !g.words.length) return false;
  const have = productWords(p);
  const hit = g.words.some((w) => { const t = tokensOf(w); return t.length > 0 && t.every((x) => have.has(x)); });
  if (!hit) return false;
  return !(g.exclude || []).some((w) => { const t = tokensOf(w); return t.length > 0 && t.every((x) => have.has(x)); });
}

// New price: a fixed rate (only if it is really lower) or a percent off, rounded to a clean 10 (never under Rs 10).
export function groupPrice(base, g) {
  const b = Number(base) || 0;
  if (!(b > 0)) return 0;
  if (g.price > 0) return g.price < b ? g.price : 0;
  if (!(g.pct > 0)) return 0;
  const np = Math.max(10, Math.round((b * (100 - g.pct)) / 100 / 10) * 10);
  return np < b ? np : 0;
}
