// A product can sit in SEVERAL categories (for example "Footwear" and "Winter wear").
// In the database: `category` = the main category (kept for older data), `categories` = every category (main one first).
const key = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

// Clean list of category names from a product document: main category first, no blanks, no duplicates.
export function catsOf(x) {
  const raw = [x && x.category, ...(Array.isArray(x && x.categories) ? x.categories : [])];
  const seen = new Set();
  const out = [];
  for (const c of raw) {
    const name = String(c || '').trim().replace(/\s+/g, ' ');
    if (!name || seen.has(key(name))) continue;
    seen.add(key(name));
    out.push(name);
  }
  return out;
}

// "Footwear, Winter wear" -> ['Footwear', 'Winter wear']
export const splitCats = (text) => catsOf({ categories: String(text || '').split(/[,\n]/) });

// Is this (shaped) product in that category?
export const inCategory = (p, name) => {
  const k = key(name);
  return (p.categories && p.categories.length ? p.categories : catsOf(p)).some((c) => key(c) === k);
};
