// Deals the assistant gave this shopper (kept in this browser for up to 3 hours).
// Any "Add to cart" (card, product page, assistant) automatically uses the deal price if one is active for that product.
const KEY = 'mz_deals_v1';

function read() {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || '{}');
    const now = Date.now();
    return Object.fromEntries(Object.entries(o).filter(([, d]) => d && d.exp > now));
  } catch { return {}; }
}
export const getDeal = (id) => (typeof window === 'undefined' ? null : read()[id] || null);
export function saveDeal(id, off, token) {
  try {
    const o = read();
    o[id] = { off, token, exp: Date.now() + 3 * 60 * 60 * 1000 - 60000 };
    localStorage.setItem(KEY, JSON.stringify(o));
    window.dispatchEvent(new Event('mz-deal'));
  } catch { /* storage blocked */ }
}
