// Orders placed on this device (also works for shoppers without an account).
const KEY = 'mz_orders';
export const localOrders = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
export function rememberOrder(o) {
  try {
    const rest = localOrders().filter((x) => x.orderId !== o.orderId);
    localStorage.setItem(KEY, JSON.stringify([o, ...rest].slice(0, 20)));
  } catch (_) {}
}
