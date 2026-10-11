// Server-side promo code check. Promo codes live in Firestore "coupons/{CODE}" (admin-only), so shoppers cannot invent discounts.
//
// A promo code belongs to a PARTNER (the `owner`: an influencer, a friend, a reseller...). The admin can:
//   - give every code its own discount (percent or flat), minimum order and maximum discount
//   - limit a code to chosen products (`productIds`; empty = the whole shop), so each product can have its own code
//   - see exactly who ordered with it (orders store couponCode + couponOwner) and how much the partner earned (`commissionPct`)
//   - allow only one order per phone number (`oncePerPhone`)

export const cleanCode = (raw) => String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 30);

// items: [{ id, price, qty, name? }]  (prices must come from the database, never from the browser)
// opts.phoneLocal: the customer's normalized phone (only known at order time) for the one-order-per-phone rule
export async function priceCoupon(db, rawCode, items, opts = {}) {
  const code = cleanCode(rawCode);
  if (!code) return { ok: false, error: 'Enter a promo code.' };
  const snap = await db.collection('coupons').doc(code).get();
  if (!snap.exists) return { ok: false, error: 'This promo code is not valid.' };
  const c = snap.data();
  if (c.active === false) return { ok: false, error: 'This promo code is no longer active.' };
  if (c.expiresAtMs && Date.now() > Number(c.expiresAtMs)) return { ok: false, error: 'This promo code has expired.' };
  if (c.usageLimit && Number(c.used || 0) >= Number(c.usageLimit)) return { ok: false, error: 'This promo code has been fully used.' };

  const scope = Array.isArray(c.productIds) ? c.productIds.map(String).filter(Boolean) : [];
  const lines = (items || []).filter((i) => !scope.length || scope.includes(String(i.id)));
  if (!lines.length) return { ok: false, error: 'This promo code is not valid for the products in your cart.' };
  const base = lines.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 0), 0);

  const min = Number(c.minOrder) || 0;
  if (base < min) return { ok: false, error: `This promo code needs ${scope.length ? 'its products worth' : 'an order of'} at least Rs. ${min}.` };

  if (c.oncePerPhone && opts.phoneLocal) {
    const used = await db.collection('coupons').doc(code).collection('redeemed').doc(String(opts.phoneLocal)).get();
    if (used.exists) return { ok: false, error: 'This promo code can be used only once per phone number.' };
  }

  const value = Number(c.value) || 0;
  let discount = c.type === 'percent' ? Math.floor((base * Math.min(value, 90)) / 100) : Math.floor(value);
  if (c.maxDiscount) discount = Math.min(discount, Number(c.maxDiscount));
  discount = Math.max(0, Math.min(discount, base));
  if (!discount) return { ok: false, error: 'This promo code gives no discount on your cart.' };

  const label = c.type === 'percent' ? `${Math.min(value, 90)}% off` : `Rs. ${Math.floor(value)} off`;
  return {
    ok: true, code, discount, label,
    owner: String(c.owner || ''),
    base,
    // which cart lines the discount applies to (stored on the order so the admin can report per product)
    lines: lines.map((i) => ({ id: String(i.id), qty: Number(i.qty) || 0, amount: (Number(i.price) || 0) * (Number(i.qty) || 0) })),
    scoped: scope.length > 0,
    appliesTo: scope.length ? lines.map((i) => i.name).filter(Boolean) : [],
  };
}
