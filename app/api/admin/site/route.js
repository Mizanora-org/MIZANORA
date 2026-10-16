import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyAdmin } from '@/lib/adminAuth';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { FEATURES, cleanStatus, getSiteStatus, refreshStatus, rememberStatus } from '@/lib/siteGate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const json = (b, s = 200) => NextResponse.json(b, { status: s });
const today = () => new Date().toISOString().slice(0, 10);
const sinceOf = (b) => {
  const n = Math.max(1, Math.min(3650, Number(b.amount) || 1));
  return Date.now() - n * (b.unit === 'hours' ? 3600e3 : 86400e3);
};

// Admin only. Site status + Firebase tools.
//  get                           -> current status (+ today's delete counter)
//  set {mode, reason, backAt, features}
//  countRecent {amount, unit}    -> how many products were added in the last N hours/days (cheap count query)
//  backupRecent {amount, unit}   -> up to 400 of them as JSON (to download before deleting)
//  deleteRecent {amount, unit, withCosts, confirm:'DELETE'}  -> deletes up to 200 per call (the page repeats)
//  deleteHidden {confirm:'DELETE'}   -> deletes products hidden because of photo problems (up to 200 per call)
export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  let b; try { b = await req.json(); } catch { return json({ ok: false, error: 'Bad request' }, 400); }
  if (!adminReady()) return json({ ok: false, error: 'Firebase Admin is not set up (FIREBASE_SERVICE_ACCOUNT in Vercel).' }, 503);
  const db = adminDb();
  const act = String(b.action || '');
  const statusRef = db.collection('siteMeta').doc('status');
  const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '';

  try {
    if (act === 'get') {
      const s = await getSiteStatus();
      let del = 0;
      try { const d = await statusRef.get(); if (d.exists && d.data().delDay === today()) del = Number(d.data().delCount) || 0; } catch { /* counter unavailable */ }
      return json({ ok: true, status: s, deletedToday: del, project, envOverride: Boolean(process.env.SITE_MODE) });
    }

    if (act === 'set') {
      const old = await getSiteStatus();
      const s = cleanStatus({ mode: b.mode, reason: b.reason, backAt: b.backAt, features: b.features, since: Date.now(), by: a.email || a.uid || '' });
      if (s.mode === 'down' && !s.reason) s.reason = 'We are doing important work on the shop. Please come back soon.';
      await statusRef.set({ ...s }, { merge: true });
      rememberStatus(s);
      refreshStatus();
      if (old.mode !== 'normal' && s.mode === 'normal') { try { revalidateTag('catalog'); } catch { /* ignore */ } } // coming back: refresh the shop data once
      return json({ ok: true, status: s });
    }

    if (act === 'countRecent') {
      const c = await db.collection('products').where('createdAt', '>=', sinceOf(b)).count().get();
      return json({ ok: true, count: Number(c.data().count) || 0 });
    }

    if (act === 'backupRecent') {
      const snap = await db.collection('products').where('createdAt', '>=', sinceOf(b)).orderBy('createdAt', 'desc').limit(400).get();
      return json({ ok: true, count: snap.size, docs: snap.docs.map((d) => ({ id: d.id, data: JSON.parse(JSON.stringify(d.data())) })) });
    }

    if (act === 'deleteRecent' || act === 'deleteHidden') {
      if (b.confirm !== 'DELETE') return json({ ok: false, error: 'Type DELETE to confirm.' }, 400);
      const q = act === 'deleteRecent'
        ? db.collection('products').where('createdAt', '>=', sinceOf(b)).orderBy('createdAt', 'desc').limit(200)
        : db.collection('products').where('active', '==', false).limit(200);
      const snap = await q.get();
      if (snap.empty) return json({ ok: true, deleted: 0, writes: 0, done: true });
      const batch = db.batch();
      let writes = 0;
      for (const d of snap.docs) {
        batch.delete(d.ref); writes++;
        if (b.withCosts !== false) { batch.delete(db.collection('productCosts').doc(d.id)); writes++; }
        batch.delete(db.collection('imageErrors').doc(d.id)); writes++;
      }
      await batch.commit();
      const day = today();
      const cur = await statusRef.get();
      const same = cur.exists && cur.data().delDay === day;
      await statusRef.set({ delDay: day, delCount: same ? FieldValue.increment(writes) : writes }, { merge: true });
      try { revalidateTag('catalog'); } catch { /* ignore */ }
      return json({ ok: true, deleted: snap.size, writes, done: snap.size < 200 });
    }
    return json({ ok: false, error: 'Unknown action' }, 400);
  } catch (e) {
    console.error('site control failed:', act, e.message);
    return json({ ok: false, error: /RESOURCE_EXHAUSTED|quota/i.test(String(e.message)) ? 'Firebase free quota is used up for today, so this could not run. Use the SITE_MODE variable in Vercel for an emergency shutdown.' : e.message }, 500);
  }
}
