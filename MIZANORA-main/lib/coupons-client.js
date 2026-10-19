'use client';
import { doc, getDoc, increment, updateDoc, writeBatch } from 'firebase/firestore';
import { dbClient } from './firebase-client';
import { DEFAULT_SETTINGS, commissionState, earnedTier } from './workers';

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

  // Worker program: the commission follows the order (Delivered = payable, Cancelled/Returned = cancelled) and the worker's numbers update.
  if (order.workerId && order.status !== status) {
    const cref = doc(db, 'commissions', order.orderId);
    const cs = await getDoc(cref);
    const next = commissionState(status);
    if (cs.exists() && !['requested', 'paid'].includes(cs.data().status) && cs.data().status !== next) {
      let days = DEFAULT_SETTINGS.holdDays;
      try { const st = await getDoc(doc(db, 'workerSettings', 'main')); if (st.exists() && Number(st.data().holdDays) >= 0) days = Number(st.data().holdDays); } catch { /* default */ }
      const now = Date.now();
      batch.update(cref, { status: next, updatedAtMs: now, ...(next === 'holding' ? { deliveredAtMs: now, releaseAtMs: now + days * 864e5 } : {}) });
    }
    const d = (key, from, to) => { const n = (order.status === from ? -1 : 0) + (status === to ? 1 : 0); return n ? { [`stats.${key}`]: increment(n) } : {}; };
    const stat = { ...d('delivered', 'Delivered', 'Delivered'), ...d('returned', 'Returned', 'Returned'), ...d('cancelled', 'Cancelled', 'Cancelled') };
    if (Object.keys(stat).length) batch.update(doc(db, 'workers', order.workerId), stat);
  }
  await batch.commit();
  if (order.workerId) await refreshWorkerTier(order.workerId).catch(() => {});
}

// Moves a worker up when the real numbers allow it (never down by itself; admin can change it any time). Skipped when admin locked the level.
export async function refreshWorkerTier(workerId) {
  const ref = doc(dbClient(), 'workers', workerId);
  const s = await getDoc(ref);
  if (!s.exists()) return;
  const w = s.data();
  if (w.tierLock || w.status !== 'approved') return;
  const t = earnedTier(w.stats || {});
  const order = ['starter', 'silver', 'gold', 'platinum', 'elite'];
  if (order.indexOf(t.key) !== order.indexOf(w.tierKey || 'starter')) await updateDoc(ref, { tierKey: t.key });
}
