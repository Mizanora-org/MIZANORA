import { NextResponse } from 'next/server';
import { FieldPath } from 'firebase-admin/firestore';
import { verifyAdmin } from '@/lib/adminAuth';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { checkImages } from '@/lib/imageCheck';
import { inspectProduct, refreshShop } from '@/lib/imageErrors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const json = (b, s = 200) => NextResponse.json(b, { status: s });

// Admin only.
//  { action:'urls', urls:[...] }                    -> state of each photo link (used by the CSV import before anything goes live)
//  { action:'recheck', slug }                       -> check one product again; a product that was hidden only for photos comes back when its photos work
//  { action:'scan', cursor:'', limit:40, all:false } -> check the next batch of products (first photo only unless all:true); broken ones are hidden + listed
export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  let b;
  try { b = await req.json(); } catch { return json({ ok: false, error: 'Bad request' }, 400); }

  if (b.action === 'urls') {
    const urls = (Array.isArray(b.urls) ? b.urls : []).map(String).slice(0, 40);
    return json({ ok: true, results: await checkImages(urls, 10) });
  }
  if (!adminReady()) return json({ ok: false, error: 'Firebase Admin is not set up (FIREBASE_SERVICE_ACCOUNT in Vercel).' }, 503);
  const db = adminDb();

  if (b.action === 'recheck') {
    const slug = String(b.slug || '').slice(0, 120);
    const ref = db.collection('products').doc(slug);
    const doc = await ref.get();
    if (!doc.exists) { await db.collection('imageErrors').doc(slug).delete().catch(() => {}); return json({ ok: true, state: 'gone' }); }
    const x = doc.data();
    const images = (x.images || []).filter(Boolean).slice(0, 8);
    if (!images.length) return json({ ok: true, state: 'bad', why: 'no photo' });
    const res = await checkImages(images);
    const good = res.filter((r) => r.state !== 'bad').map((r) => r.url);
    if (good.length && x.hiddenReason === 'image') {
      await ref.set({ images: good, active: true, hiddenReason: null, updatedAt: Date.now() }, { merge: true });
      await db.collection('imageErrors').doc(slug).delete().catch(() => {});
      refreshShop(slug);
      return json({ ok: true, state: 'restored' });
    }
    return json({ ok: true, state: good.length ? 'ok' : 'bad', why: (res.find((r) => r.state === 'bad') || {}).why || '' });
  }

  if (b.action === 'scan') {
    const limit = Math.max(5, Math.min(60, Number(b.limit) || 40));
    let q = db.collection('products').orderBy(FieldPath.documentId()).limit(limit);
    if (b.cursor) q = q.startAfter(String(b.cursor));
    const snap = await q.get();
    const stats = { scanned: 0, hidden: 0, trimmed: 0, unknown: 0, ok: 0 };
    let next = 0;
    const docs = snap.docs.filter((d) => d.data().active !== false);
    const worker = async () => {
      while (next < docs.length) {
        const d = docs[next++];
        try { const r = await inspectProduct(d.id, { source: 'scan', all: Boolean(b.all), snap: d }); stats.scanned++; if (r.state === 'hidden') stats.hidden++; else if (r.state === 'trimmed') stats.trimmed++; else if (r.state === 'unknown') stats.unknown++; else stats.ok++; } catch (e) { console.error('scan', d.id, e.message); stats.unknown++; }
      }
    };
    await Promise.all(Array.from({ length: Math.min(8, docs.length) }, worker));
    return json({ ok: true, ...stats, total: snap.size, next: snap.size === limit ? snap.docs[snap.docs.length - 1].id : '' });
  }
  return json({ ok: false, error: 'Unknown action' }, 400);
}
