import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { IPTV, lineState } from '@/lib/iptv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });
const DAY = 86400e3;

// Admin API for the IPTV section.
//   { action: 'list' }                 -> trials, lines, collection, kpis
//   { action: 'approve', id }          -> a trial request becomes a 24h trial line
//   { action: 'extend', id, days }     -> push the expiry forward
//   { action: 'suspend', id }          -> stop the line at once
//
// With no database configured the list is answered with clearly-labelled demo rows, so the
// panel is never a dead screen; every WRITE refuses and says what to set up.
export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);

  let b;
  try { b = await req.json(); } catch { return json({ ok: false, error: 'Bad request' }, 400); }
  const action = String(b.action || 'list');

  if (!adminReady()) {
    if (action === 'list') return json({ ok: true, demo: true, ...demo() });
    return json({ ok: false, error: 'Firestore connect karein (FIREBASE_SERVICE_ACCOUNT) — phir ye action chalega.' }, 503);
  }

  const db = adminDb();

  try {
    if (action === 'list') {
      const [trialsSnap, linesSnap, resSnap] = await Promise.all([
        db.collection('iptvTrials').where('status', '==', 'new').limit(50).get().catch(() => null),
        db.collection('iptvLines').limit(200).get().catch(() => null),
        db.collection('iptvResellers').limit(100).get().catch(() => null),
      ]);

      const trials = (trialsSnap?.docs || []).map((d) => ({ id: d.id, ...d.data() }))
        .sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0));

      const lines = (linesSnap?.docs || []).map((d) => ({ id: d.id, ...d.data() }));

      const collection = (resSnap?.docs || []).map((d) => {
        const r = d.data();
        const connections = Number(r.connections) || 0;
        return {
          reseller: r.name || d.id,
          connections,
          due: connections * IPTV.wholesale,
          paid: Number(r.paidThisCycle) || 0,
        };
      });

      const active = lines.filter((l) => lineState(l.expiresAt).state !== 'expired');
      const collected = collection.reduce((s, c) => s + c.paid, 0);
      const due = collection.reduce((s, c) => s + c.due, 0);

      return json({
        ok: true,
        demo: false,
        kpis: {
          lines: active.length,
          trials: trials.length,
          mrr: active.length * IPTV.wholesale,
          collected: due ? Math.round((collected / due) * 100) : 0,
        },
        trials,
        lines: lines.slice(0, 100),
        collection,
      });
    }

    const id = String(b.id || '');
    if (!id) return json({ ok: false, error: 'ID missing' }, 400);

    if (action === 'approve') {
      const ref = db.collection('iptvTrials').doc(id);
      const snap = await ref.get();
      if (!snap.exists) return json({ ok: false, error: 'Trial request nahi mili.' }, 404);
      const t = snap.data();
      const username = `mz${String(Date.now()).slice(-6)}`;
      const password = Math.random().toString(36).slice(2, 8);
      await db.collection('iptvLines').add({
        username, password,
        phone: t.phone, name: t.name, city: t.city,
        plan: 'trial', maxDevices: 1,
        device: t.device || 'xtream',
        trial: true,
        expiresAt: Date.now() + IPTV.trialHours * 3600e3,
        createdAt: Date.now(),
        status: 'active',
      });
      await ref.update({ status: 'approved', approvedAt: Date.now() });
      return json({ ok: true, username });
    }

    if (action === 'extend') {
      const days = Math.min(365, Math.max(1, Number(b.days) || 30));
      const ref = db.collection('iptvLines').doc(id);
      const snap = await ref.get();
      if (!snap.exists) return json({ ok: false, error: 'Line nahi mili.' }, 404);
      const now = Date.now();
      const from = Math.max(now, Number(snap.data().expiresAt) || now);
      await ref.update({ expiresAt: from + days * DAY, status: 'active' });
      return json({ ok: true, days });
    }

    if (action === 'suspend') {
      await db.collection('iptvLines').doc(id).update({ status: 'suspended', suspendedAt: Date.now() });
      return json({ ok: true });
    }

    return json({ ok: false, error: 'Unknown action' }, 400);
  } catch (e) {
    return json({ ok: false, error: e.message || 'Server error' }, 500);
  }
}

// Demo rows for a fresh install: the shape is exactly what the real data returns.
function demo() {
  const now = Date.now();
  return {
    kpis: { lines: 264, trials: 4, mrr: 26400, collected: 78 },
    trials: [
      { id: 't1', name: 'Ali Raza', phone: '0300-1122334', city: 'Kasur', device: 'xtream', at: now - 40 * 60e3 },
      { id: 't2', name: 'Sana Malik', phone: '0321-9988776', city: 'Lahore', device: 'smarttv', at: now - 3 * 3600e3 },
      { id: 't3', name: 'Bilal Ahmed', phone: '0333-4455667', city: 'Multan', device: 'mag', at: now - 9 * 3600e3 },
      { id: 't4', name: 'Hira Khan', phone: '0345-2233445', city: 'Karachi', device: 'phone', at: now - 26 * 3600e3 },
    ],
    lines: [
      { id: 'l1', username: 'mz100241', plan: 'family', resellerName: 'Barakat Vision', expiresAt: now + 22 * DAY },
      { id: 'l2', username: 'mz100242', plan: 'starter', resellerName: 'Sky Link Cable', expiresAt: now + 2 * DAY },
      { id: 'l3', username: 'mz100243', plan: 'premium', resellerName: 'Madina Digital', expiresAt: now + 45 * DAY },
      { id: 'l4', username: 'mz100244', plan: 'starter', resellerName: 'Ali Traders', expiresAt: now - 2 * DAY },
      { id: 'l5', username: 'mz100245', plan: 'family', resellerName: 'Pak Vision HD', expiresAt: now + 11 * DAY },
    ],
    collection: [
      { reseller: 'Barakat Vision', connections: 86, due: 8600, paid: 8600 },
      { reseller: 'Sky Link Cable', connections: 62, due: 6200, paid: 6200 },
      { reseller: 'Madina Digital', connections: 71, due: 7100, paid: 3200 },
      { reseller: 'Ali Traders', connections: 45, due: 4500, paid: 4500 },
    ],
  };
}
