import { NextResponse } from 'next/server';
import { denyIf } from '@/lib/siteGate';
import { adminDb, adminReady, adminRtdb } from '@/lib/firebase-admin';
import { normalizePhone } from '@/lib/validate';
import { isQuotaError } from '@/lib/orderFallback';
import { noteFirestoreError, quotaTripped } from '@/lib/quota';
import { rtdbOn } from '@/lib/rtdb';
import { securityIp, logSecurityEvent } from '@/lib/securityControl';
import { limitRequest } from '@/lib/requestRate';
import { readLimitedJson } from '@/lib/readLimitedJson';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (b, status = 200) => NextResponse.json(b, { status, headers: { 'Cache-Control': 'no-store' } });
const unavailable = () => json({ ok: false, error: 'Tracking is temporarily unavailable. Please try later or contact support.' }, 503);
const notFound = () => json({ ok: false, error: 'We could not find an order with this ID and phone number. Check both and try again.' }, 404);

const result = (o, id) => json({ ok: true, order: {
  orderId: id, status: o.status, trackingId: o.trackingId || '', createdAtMs: o.createdAtMs, items: o.items, subtotal: o.subtotal,
  discount: o.discount || 0, couponCode: o.couponCode || '', shipping: o.shipping, total: o.total, customer: o.customer,
} });

// A customer may read ONLY an order matching BOTH their order ID and delivery phone.
// RTDB ordersBackup also holds orders placed when Firestore's quota was exhausted.
export async function POST(req) {
  const closed = await denyIf('tracking');
  if (closed) return closed;
  if (!adminReady()) return unavailable();
  const ip = securityIp(req.headers) || 'unknown';
  if (!limitRequest('order-track', ip, 12, 10 * 60_000).allowed) {
    void logSecurityEvent(req, 'rate-limit', { reason: 'order-track', severity: 'medium' });
    return json({ ok: false, error: 'Too many tries. Please wait a few minutes.' }, 429);
  }
  let b; try { b = await readLimitedJson(req, 2048); } catch { return json({ ok: false, error: 'Invalid request' }, 400); }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return json({ ok: false, error: 'Invalid request' }, 400);
  const id = String(b.orderId || '').trim().toUpperCase();
  const ph = normalizePhone(b.phone);
  if (!/^MZ-[A-F0-9]{8}$/.test(id) || !ph) return notFound();

  const backup = async () => {
    if (!rtdbOn()) return null;
    const o = (await adminRtdb().ref(`ordersBackup/${id}`).get()).val();
    if (!o) return null;
    const op = normalizePhone(o.customer && o.customer.phone);
    return op && op.local === ph.local ? result(o, id) : notFound();
  };

  if (quotaTripped()) {
    try { return (await backup()) || unavailable(); } catch { return unavailable(); }
  }
  try {
    const snap = await adminDb().collection('orders').doc(id).get();
    if (snap.exists) {
      const o = snap.data();
      const op = normalizePhone(o.customer && o.customer.phone);
      return op && op.local === ph.local ? result(o, id) : notFound();
    }
    return (await backup()) || notFound();
  } catch (e) {
    noteFirestoreError(e);
    if (isQuotaError(e)) { try { return (await backup()) || unavailable(); } catch { return unavailable(); } }
    console.error('track failed', e.message);
    return unavailable();
  }
}
