import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyAdmin } from '@/lib/adminAuth';
import { adminDb, adminRtdb } from '@/lib/firebase-admin';
import { rtdbOn } from '@/lib/rtdb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Admin only. Orders that were taken while Firestore's free quota was used up are kept in the Realtime Database.
//  { action:'list' }            -> the waiting orders
//  { action:'move', id }        -> copy one into the normal orders list (Firestore), then remove it from the backup
//  { action:'dismiss', id }     -> remove one from the backup without copying it
const json = (b, s = 200) => NextResponse.json(b, { status: s });

export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  if (!rtdbOn()) return json({ ok: false, error: 'Realtime Database is not set up.' }, 503);
  let b = {}; try { b = await req.json(); } catch { /* defaults */ }
  const id = String(b.id || '').replace(/[^A-Z0-9-]/gi, '').slice(0, 20);
  try {
    if (b.action === 'list') {
      const s = await adminRtdb().ref('ordersBackup').get();
      const v = s.val() || {};
      return json({ ok: true, orders: Object.values(v).sort((x, y) => y.createdAtMs - x.createdAtMs) });
    }
    if (!id) return json({ ok: false, error: 'No order id.' }, 400);
    const ref = adminRtdb().ref(`ordersBackup/${id}`);
    if (b.action === 'dismiss') { await ref.remove(); return json({ ok: true }); }
    if (b.action === 'move') {
      const o = (await ref.get()).val();
      if (!o) return json({ ok: false, error: 'Order not found (already moved?).' }, 404);
      const { source, workerRef, ...rest } = o;
      await adminDb().collection('orders').doc(id).create({ ...rest, uid: '', email: '', createdAt: FieldValue.serverTimestamp(), movedFromBackup: true, workerRef: workerRef || '' });
      await ref.remove();
      return json({ ok: true });
    }
    return json({ ok: false, error: 'Unknown action' }, 400);
  } catch (e) {
    const exists = /ALREADY_EXISTS|already exists/i.test(String(e.message));
    if (exists) { try { await adminRtdb().ref(`ordersBackup/${id}`).remove(); } catch { /* ignore */ } return json({ ok: true, note: 'It was already in the orders list.' }); }
    return json({ ok: false, error: /RESOURCE_EXHAUSTED|quota/i.test(String(e.message)) ? 'Firestore quota is still used up. Try again after it resets.' : e.message }, 500);
  }
}
