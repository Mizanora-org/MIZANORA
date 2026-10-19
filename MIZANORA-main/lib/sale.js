// Real flash-sale logic: while the sale runs the customer pays `price`. When the end time passes, the shop goes back to the
// original price (the "compare" price) automatically, on the website and in orders, so a countdown is never fake.
export function effective(price, comparePrice, endsMs, now = Date.now()) {
  const p = Number(price) || 0;
  const c = Number(comparePrice) || 0;
  const e = Number(endsMs) || 0;
  if (e && now >= e && c > p) return { price: c, comparePrice: 0, endsMs: 0, ended: true };
  return { price: p, comparePrice: c, endsMs: e && e > now ? e : 0, ended: false };
}
