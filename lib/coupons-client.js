'use client';
import { doc, increment, writeBatch } from 'firebase/firestore';
import { dbClient } from './firebase-client';

// When the admin cancels an order (or brings a cancelled one back), the promo code's counters follow,
// so the numbers in Admin > Promo codes always match the real, valid orders.
export async function setOrderStatus(order, status, extra = {}) {
  const db = dbClient();
  const batch = writeBatch(db);
  batch.update(doc(db, 'orders', order.orderId), { status, [`${status.toLowerCase()}At`]: Date.now(), ...extra });
  const was = order.status === 'Cancelled';
  const will = status === 'Cancelled';
  if (order.couponCode && was !== will) {
    const sign = will ? -1 : 1;
    const data = { used: increment(sign) };
    if (order.couponTracked) { // orders placed before promo tracking existed have no revenue numbers to adjust
      data.revenue = increment(sign * ((Number(order.couponBase) || 0) - (Number(order.discount) || 0)));
      data.discountTotal = increment(sign * (Number(order.discount) || 0));
      const byProduct = {};
      for (const l of order.couponLines || []) byProduct[l.id] = { qty: increment(sign * l.qty), amount: increment(sign * l.amount) };
      data.byProduct = byProduct;
    }
    batch.set(doc(db, 'coupons', order.couponCode), data, { merge: true });
  }
  await batch.commit();
}
