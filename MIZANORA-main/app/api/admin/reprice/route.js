import { NextResponse } from 'next/server';
import { FieldPath } from 'firebase-admin/firestore';
import { verifyAdmin } from '@/lib/adminAuth';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { PROFIT_TIERS, clampProfit, profitFor, safeAffRate, shopPrice } from '@/lib/importProducts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Admin only. Applies the profit table to LIVE products that have a saved supplier cost (collection productCosts):
// price = supplier cost + profit. { cursor, limit, tiers:[[upTo,profit]], minProfit, dryRun }  -> { scanned, changed, next }
// Each batch reads `limit` costs + `limit` products and writes only the products whose price really changes.
export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });
  if (!adminReady()) return NextResponse.json({ ok: false, error: 'Firebase Admin is not set up.' }, { status: 503 });
  let b; try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Bad request' }, { status: 400 }); }
  const min = Math.max(0, Math.min(500, Number(b.minProfit) || 2));
  const tiers = Array.isArray(b.tiers) && b.tiers.length ? b.tiers.map(([u, p]) => [u === null || u === 'Infinity' ? Infinity : Number(u), clampProfit(p, min)]) : PROFIT_TIERS;
  const limit = Math.max(20, Math.min(240, Number(b.limit) || 200)); // 2 writes per changed product, 500 per batch
  const db = adminDb();
  let q = db.collection('productCosts').orderBy(FieldPath.documentId()).limit(limit);
  if (b.cursor) q = q.startAfter(String(b.cursor));
  const costs = await q.get();
  const rows = costs.docs.filter((d) => Number(d.data().cost) > 0);
  const products = rows.length ? await db.getAll(...rows.map((d) => db.collection('products').doc(d.id))) : [];
  const batch = db.batch();
  let changed = 0, sample = [];
  products.forEach((s, i) => {
    if (!s.exists) return;
    const cost = Number(rows[i].data().cost);
    const profit = profitFor(cost, tiers, min);
    const price = shopPrice(cost, profit, min);
    const cur = s.data();
    if (Number(cur.price) === price) return;
    changed++;
    if (sample.length < 5) sample.push({ id: s.id, from: Number(cur.price), to: price });
    if (!b.dryRun) {
      batch.update(s.ref, { price, affRate: safeAffRate(price, price - cost), dealRoom: Math.max(0, price - cost - 50), updatedAt: Date.now() });
      batch.set(rows[i].ref, { profit: price - cost }, { merge: true });
    }
  });
  if (changed && !b.dryRun) await batch.commit();
  return NextResponse.json({ ok: true, scanned: rows.length, changed, sample, next: costs.size === limit ? costs.docs[costs.docs.length - 1].id : '' });
}
