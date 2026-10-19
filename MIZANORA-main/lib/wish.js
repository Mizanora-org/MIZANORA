// Wishlist kept on the shopper's own device (works without an account).
const KEY = 'mz_wish';
export const getWish = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
export function toggleWish(id) {
  const cur = getWish();
  const on = cur.includes(id);
  const next = on ? cur.filter((x) => x !== id) : [id, ...cur].slice(0, 100);
  try { localStorage.setItem(KEY, JSON.stringify(next)); window.dispatchEvent(new Event('mz-wish')); } catch (_) {}
  return !on;
}
