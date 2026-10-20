// Wishlist: kept on the shopper's own device, and (v21) copied to the account when the shopper is signed in, so it follows them to every phone.
// It works even when the browser blocks storage (Facebook / Instagram in-app browsers): then the list lives in memory for that visit.
const KEY = 'mz_wish';
let mem = null; // used only when localStorage is blocked
const clean = (a) => [...new Set((Array.isArray(a) ? a : []).map((x) => String(x)).filter(Boolean))].slice(0, 100);

export function getWish() {
  try { return clean(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { return mem ? clean(mem) : []; }
}
export function setWish(list, silent = false) {
  const next = clean(list);
  try { localStorage.setItem(KEY, JSON.stringify(next)); mem = null; } catch { mem = next; }
  if (!silent) { try { window.dispatchEvent(new Event('mz-wish')); } catch (_) { /* ignore */ } }
  return next;
}
export function toggleWish(id) {
  const cur = getWish();
  const key = String(id);
  const on = cur.includes(key);
  setWish(on ? cur.filter((x) => x !== key) : [key, ...cur]);
  return !on;
}
