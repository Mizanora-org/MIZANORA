import { NextResponse } from 'next/server';
import { adminRtdb } from './firebase-admin';
import { getProductsByIds } from './products';
import { shippingFor } from './config';
import { DEAL_MAX_QTY, dealOff } from './deal';
import { optionsOf, validVariant } from './options';
import { cleanPayRef, payMethod, prepaidOff } from './payments';
import { cleanWorkerCode } from './workers';
import { bump, dayKey, rtdbOn } from './rtdb';

// ORDER BACKUP. When Firestore refuses an order (free quota used up), the order is still taken: prices are checked against the shop's
// own product data, the order is saved in the Realtime Database (a separate quota) and the customer gets the normal confirmation.
// Admin > Dashboard lists these orders and moves them into the normal orders list with one click once Firestore works again.
const fail = (msg, status = 400) => NextResponse.json({ ok: false, error: msg }, { status });
const newId = () => `MZ-${[...crypto.getRandomValues(new Uint8Array(4))].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()}`;

export const isQuotaError = (e) => /RESOURCE_EXHAUSTED|Quota exceeded|quota/i.test(String((e && e.message) || e || ''));

// -> NextResponse, or null when the backup is not possible (then the normal error message is shown)
export async function backupOrder({ body, clean, rawItems }) {
  if (!rtdbOn()) return null;
  try {
    if (body.coupon) return fail('Promo codes cannot be checked for a few minutes. Please place the order without the code, or try again later.', 503);
    const ids = [...new Set(rawItems.map((i) => String(i.id || '')))].filter(Boolean);
    const byId = await getProductsByIds(ids);
    const items = [];
    for (const r of rawItems) {
      const p = byId.get(String(r.id));
      const qty = Math.floor(Number(r.qty));
      if (!p || p.active === false) return fail('One of the products is no longer available. Please refresh your cart.');
      if (p.inStock === false) return fail(`${p.name} is currently sold out.`);
      if (!(qty >= 1 && qty <= 10)) return fail('Invalid quantity.');
      const size = String(r.size || '');
      if (!validVariant(optionsOf(p), size)) return fail(`Please choose the options (for example colour and size) for ${p.name} again.`);
      const off = r.deal ? dealOff(r.deal, String(r.id)) : 0;
      if (r.deal && !off) return fail(`The special price for ${p.name} has expired. Please remove it from the cart and add it again.`);
      if (off && qty > DEAL_MAX_QTY) return fail(`The special price for ${p.name} is valid for up to ${DEAL_MAX_QTY} pieces.`);
      const price = Math.max(1, (Number(p.price) || 0) - off);
      items.push({ id: String(r.id), slug: String(r.id), name: off ? `${p.name} (special price, Rs ${off} off)` : p.name, dealOff: off, price, shopPrice: price, markup: 0, qty, size, image: (p.images && p.images[0]) || '' });
    }
    const pm = payMethod(body.payMethod || 'COD');
    if (!pm) return fail('That payment method is not available. Please choose another one.');
    const payRef = pm.prepaid ? cleanPayRef(body.payRef) : '';
    if (pm.prepaid && !payRef) return fail('Please enter the transaction ID of your payment (at least 6 characters).');
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const shipping = shippingFor(subtotal);
    const prepaidDiscount = prepaidOff(subtotal, pm.id);
    const total = subtotal - prepaidDiscount + shipping;
    const orderId = newId();
    const now = Date.now();
    const order = { orderId, status: 'Pending', customer: clean, items, subtotal, discount: 0, couponCode: '', shipping, total, paymentMethod: pm.id, paymentRef: payRef, paymentStatus: pm.prepaid ? 'awaiting-verification' : 'cod', prepaidDiscount, createdAtMs: now, trackingId: '', workerRef: cleanWorkerCode(body.ref) || '', source: 'backup' };
    await adminRtdb().ref(`ordersBackup/${orderId}`).set(order);
    const d = dayKey(now);
    await bump([[`d/${d}/orders`, 1], [`d/${d}/sales`, total], [`ev/${d}/order`, 1]]);
    try { await adminRtdb().ref(`liveOrders/${orderId}`).set({ t: now, total, city: String(clean.city || '').slice(0, 40), n: items.reduce((s, i) => s + i.qty, 0), b: 1 }); } catch { /* feed only */ }
    return NextResponse.json({ ok: true, order: { orderId, createdAtMs: now, status: 'Pending', customer: clean, items, subtotal, discount: 0, couponCode: '', shipping, total, paymentMethod: pm.id, prepaidDiscount } });
  } catch (e) {
    console.error('order backup failed:', e.message);
    return null;
  }
}

// Counters and the live feed for a normally saved order (best effort).
export async function recordOrder({ orderId, total, city, qty }) {
  if (!rtdbOn()) return;
  const d = dayKey();
  await bump([[`d/${d}/orders`, 1], [`d/${d}/sales`, total], [`d/${d}/items`, qty], [`ev/${d}/order`, 1]]);
  try { await adminRtdb().ref(`liveOrders/${orderId}`).set({ t: Date.now(), total, city: String(city || '').slice(0, 40), n: qty }); } catch { /* feed only */ }
}
