// SHARED ADMIN SEARCH (works in the browser and on the server; no imports, so it is safe everywhere).
// One query box in the admin panel filters every list that uses it (products, orders, archive, workers...).
// Rules that match how a shopkeeper actually searches:
//   * case-insensitive, every word must be found (AND) - "silk kurti" finds "Kurti - Silk"
//   * phone numbers with or without dashes: "0300 1234567", "03001234567" and "3001234567" all hit the same order
//   * a hit inside the URL slug, SKU or price counts as well
//   * Urdu/Arabic letters are kept (the diacritics are stripped) so Urdu product names can be typed as they are
const SPLIT = /[^a-z0-9\u0600-\u06ff]+/i;
const DIACRITICS = /[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06dc\u06df-\u06e8\u06ea-\u06ed\u200c-\u200f]/g;

export const normText = (s) => String(s == null ? '' : s).toLowerCase().replace(DIACRITICS, '').replace(/\s+/g, ' ').trim();

// "silk kurti" -> ["silk", "kurti"] ; anything longer than 40 words is cut (a paste of a whole page must not hang the browser)
export const tokensOf = (q) => normText(q).split(SPLIT).filter(Boolean).slice(0, 40);

const digitsOf = (s) => String(s || '').replace(/\D/g, '');

// True when EVERY word of the query is found in the text (or in its digits).
export function adminHit(q, text) {
  const words = tokensOf(q);
  if (!words.length) return true;
  const hay = normText(text);
  const hayDigits = digitsOf(hay);
  return words.every((w) => hay.includes(w) || (/^\d+$/.test(w) && w.length >= 3 && hayDigits.includes(w)));
}

// Higher = better match. Used to put the most likely product on top of the admin list.
export function adminScore(q, text, name = '') {
  const words = tokensOf(q);
  if (!words.length) return 0;
  const hay = normText(text);
  const n = normText(name || text);
  let s = 0;
  for (const w of words) {
    if (n.startsWith(w)) s += 30;
    else if (n.includes(w)) s += 20;
    else if (hay.includes(w)) s += 8;
    else if (/^\d+$/.test(w) && digitsOf(hay).includes(w)) s += 6;
  }
  if (n === normText(q)) s += 60;      // exact name typed
  return s;
}

// Sort helper: best match first, then by the given date (newest first).
export const byAdminScore = (q, nameOf, dateOf) => (a, b) =>
  adminScore(q, typeof nameOf === 'function' ? nameOf(b) : b[nameOf], typeof nameOf === 'function' ? nameOf(a) : a[nameOf]) -
  adminScore(q, typeof nameOf === 'function' ? nameOf(a) : a[nameOf], typeof nameOf === 'function' ? nameOf(b) : b[nameOf]) ||
  (Number(dateOf ? dateOf(b) : 0) || 0) - (Number(dateOf ? dateOf(a) : 0) || 0);

// "03001234567" -> "+92 300 1234567" for showing a phone number the Pakistani way.
export function prettyPhone(v) {
  const d = digitsOf(v);
  if (d.length === 11 && d.startsWith('0')) return `+92 ${d.slice(1, 4)} ${d.slice(4)}`;
  if (d.length === 12 && d.startsWith('92')) return `+${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`;
  return String(v || '');
}
