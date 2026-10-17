import { NextResponse } from 'next/server';
import { denyIf } from '@/lib/siteGate';
import { adminDb } from '@/lib/firebase-admin';
import { verifyWorker } from '@/lib/workerAuth';
import { getProduct } from '@/lib/products';
import { bandPct, maxMarkupFor } from '@/lib/workers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (b, s = 200) => NextResponse.json(b, { status: s });

// A worker sets, per product:
//   sell   = the price their customers pay (shop price up to shop price + the band limit: 10% / 15% / 20%)
//   market = the "market rate" shown struck through (what other markets charge). Optional. 0 removes it.
// The old field `markup` (Rs on top of the shop price) is still accepted.
export async function POST(req) {
  const closed = await denyIf('workers');
  if (closed) return closed;
  const a = await verifyWorker(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  let b; try { b = await req.json(); } catch { return json({ ok: false, error: 'Invalid request' }, 400); }
  const p = await getProduct(String(b.productId || ''));
  if (!p) return json({ ok: false, error: 'Product not found.' }, 404);
  const max = maxMarkupFor(p.price);
  const mk = b.sell !== undefined && b.sell !== '' ? Math.floor(Number(b.sell) || 0) - p.price : Math.floor(Number(b.markup) || 0);
  if (mk < 0 || mk > max) return json({ ok: false, error: `Your selling price for this product can be Rs. ${p.price} to Rs. ${p.price + max} (profit up to ${bandPct(p.price)}%).` }, 400);
  const market = Math.max(0, Math.floor(Number(b.market) || 0));
  if (market > p.price * 5) return json({ ok: false, error: 'That market rate looks too high. Please check it.' }, 400);
  await adminDb().collection('workers').doc(a.uid).set({ markups: { [p.id]: mk }, market: { [p.id]: market } }, { merge: true });
  return json({ ok: true, markup: mk, market, max, sell: p.price + mk });
}
