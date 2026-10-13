import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyWorker } from '@/lib/workerAuth';
import { MIN_PAYOUT } from '@/lib/workers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (b, s = 200) => NextResponse.json(b, { status: s });

// Worker asks for the money of all APPROVED (delivered) commissions. Admin pays it and marks it paid.
export async function POST(req) {
  const a = await verifyWorker(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  const db = adminDb();
  const open = await db.collection('payouts').where('workerId', '==', a.uid).where('status', '==', 'requested').limit(1).get();
  if (!open.empty) return json({ ok: false, error: 'You already have a payout request waiting. We will pay it soon.' }, 409);
  const q = await db.collection('commissions').where('workerId', '==', a.uid).where('status', '==', 'approved').get();
  const docs = q.docs.slice(0, 400);
  const amount = docs.reduce((s, d) => s + (Number(d.data().amount) || 0), 0);
  if (amount < MIN_PAYOUT) return json({ ok: false, error: `Minimum payout is Rs. ${MIN_PAYOUT}. You have Rs. ${amount} ready.` }, 400);
  const ref = db.collection('payouts').doc();
  const batch = db.batch();
  batch.set(ref, { workerId: a.uid, workerName: a.worker.name, code: a.worker.code, amount, payout: a.worker.payout || {}, commissionIds: docs.map((d) => d.id), status: 'requested', requestedAtMs: Date.now() });
  docs.forEach((d) => batch.update(d.ref, { status: 'requested', payoutId: ref.id }));
  await batch.commit();
  return json({ ok: true, amount });
}
