import { NextResponse } from 'next/server';
import { denyIf } from '@/lib/siteGate';
import { adminDb } from '@/lib/firebase-admin';
import { verifyWorker } from '@/lib/workerAuth';
import { getProduct } from '@/lib/products';
import { effectiveTier, maxMarkupFor } from '@/lib/workers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (b, s = 200) => NextResponse.json(b, { status: s });

// Elite workers set their own profit (markup, in Rs per piece) on a product. Customers who come through their link pay shop price + markup.
export async function POST(req) {
  const closed = await denyIf('workers');
  if (closed) return closed;
  const a = await verifyWorker(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  if (!effectiveTier(a.worker).custom) return json({ ok: false, error: 'Custom pricing unlocks at the Elite level.' }, 403);
  let b; try { b = await req.json(); } catch { return json({ ok: false, error: 'Invalid request' }, 400); }
  const p = await getProduct(String(b.productId || ''));
  if (!p) return json({ ok: false, error: 'Product not found.' }, 404);
  const mk = Math.floor(Number(b.markup) || 0);
  const max = maxMarkupFor(p.price);
  if (mk < 0 || mk > max) return json({ ok: false, error: `Your profit on this product can be Rs. 0 to Rs. ${max}.` }, 400);
  await adminDb().collection('workers').doc(a.uid).set({ markups: { [p.id]: mk } }, { merge: true });
  return json({ ok: true, markup: mk, max });
}
