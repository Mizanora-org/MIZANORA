import { NextResponse } from 'next/server';
import { denyIf } from '@/lib/siteGate';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { normalizePhone } from '@/lib/validate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const hits = new Map();
const limited = (ip) => {
  const now = Date.now();
  const a = (hits.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000); a.push(now); hits.set(ip, a);
  if (hits.size > 5000) hits.clear();
  return a.length > 12;
};

// Guests can look up an order with the order ID AND the phone number used on the order.
export async function POST(req) {
  const closed = await denyIf('tracking');
  if (closed) return closed;
  if (!adminReady()) return NextResponse.json({ ok: false, error: 'Tracking is not available right now.' }, { status: 503 });
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) return NextResponse.json({ ok: false, error: 'Too many tries. Please wait a few minutes.' }, { status: 429 });
  let b; try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 }); }
  const id = String(b.orderId || '').trim().toUpperCase();
  const ph = normalizePhone(b.phone);
  const notFound = NextResponse.json({ ok: false, error: 'We could not find an order with this ID and phone number. Check both and try again.' }, { status: 404 });
  if (!/^MZ-[A-F0-9]{8}$/.test(id) || !ph) return notFound;
  try {
    const snap = await adminDb().collection('orders').doc(id).get();
    if (!snap.exists) return notFound;
    const o = snap.data();
    const op = normalizePhone(o.customer && o.customer.phone);
    if (!op || op.local !== ph.local) return notFound;
    return NextResponse.json({ ok: true, order: {
      orderId: id, status: o.status, trackingId: o.trackingId || '', createdAtMs: o.createdAtMs, items: o.items, subtotal: o.subtotal,
      discount: o.discount || 0, couponCode: o.couponCode || '', shipping: o.shipping, total: o.total, customer: o.customer,
    } });
  } catch (e) {
    console.error('track failed', e.message);
    return NextResponse.json({ ok: false, error: 'Could not look up the order. Try again.' }, { status: 500 });
  }
}
