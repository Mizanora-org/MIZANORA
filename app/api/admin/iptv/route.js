import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { adminApp } from '@/lib/firebase-admin';
import { IPTV, lineState } from '@/lib/iptv';
import { addMonths, clientPrice, credentials, canAddLine } from '@/lib/iptvReseller';

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
      const [trialsSnap, linesSnap, resSnap, appsSnap] = await Promise.all([
        db.collection('iptvTrials').where('status', '==', 'new').limit(50).get().catch(() => null),
        db.collection('iptvLines').limit(400).get().catch(() => null),
        db.collection('iptvResellers').limit(100).get().catch(() => null),
        db.collection('iptvResellerApps').where('status', '==', 'new').limit(50).get().catch(() => null),
      ]);

      const trials = (trialsSnap?.docs || []).map((d) => ({ id: d.id, ...d.data() }))
        .sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0));

      const lines = (linesSnap?.docs || []).map((d) => ({ id: d.id, ...d.data() }));

      const apps = (appsSnap?.docs || []).map((d) => ({ id: d.id, ...d.data() }))
        .sort((x, y) => (Number(y.createdAt) || 0) - (Number(x.createdAt) || 0));

      const allLines = (linesSnap?.docs || []).map((d) => ({ id: d.id, ...d.data() }));
      const byReseller = allLines.reduce((m, l) => {
        if (!l.resellerId) return m;
        m[l.resellerId] = (m[l.resellerId] || 0) + 1;
        return m;
      }, {});

      // Self-service accounts: har line jis par uid hai, us account ke neeche jama.
      const usersMap = new Map();
      for (const l of allLines) {
        if (!l.uid) continue;
        const u = usersMap.get(l.uid) || {
          uid: l.uid, email: l.email || '', name: l.clientName || l.name || '',
          lines: 0, active: 0, trial: false, lastAt: 0,
        };
        u.lines += 1;
        if ((Number(l.expiresAt) || 0) > Date.now() && l.status !== 'cancelled') u.active += 1;
        if (l.trial === true) u.trial = true;
        if (!u.email && l.email) u.email = l.email;
        u.lastAt = Math.max(u.lastAt, Number(l.createdAt) || 0);
        usersMap.set(l.uid, u);
      }
      const users = [...usersMap.values()].sort((a, b) => b.lastAt - a.lastAt);

      const resellers = (resSnap?.docs || []).map((d) => {
        const r = d.data();
        return {
          id: d.id,
          name: r.name || d.id,
          phone: r.phone || '',
          credit: Number(r.credit) || 0,
          price: clientPrice(r.price),
          status: r.status || 'approved',
          used: byReseller[d.id] || 0,
          paidThisCycle: Number(r.paidThisCycle) || 0,
        };
      }).sort((a, b) => b.used - a.used);

      const collection = resellers.map((r) => ({
        id: r.id,
        reseller: r.name,
        connections: r.used,
        due: r.used * IPTV.wholesale,
        paid: r.paidThisCycle,
      }));

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
        lines: lines.slice(0, 150),
        apps,
        users,
        resellers,
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

    if (action === 'approveReseller') {
      const appRef = db.collection('iptvResellerApps').doc(id);
      const appSnap = await appRef.get();
      if (!appSnap.exists) return json({ ok: false, error: 'Application nahi mili.' }, 404);
      const a = appSnap.data();
      const credit = Math.min(500, Math.max(1, Number(b.credit) || 10));
      const docId = String(a.uid || '').trim() || db.collection('iptvResellers').doc().id;
      await db.collection('iptvResellers').doc(docId).set({
        name: a.name || '', phone: a.phone || '', whatsapp: a.whatsapp || a.phone || '',
        city: a.city || '', credit, price: IPTV.cap, status: 'approved',
        payment: {}, approvedAt: Date.now(), paidThisCycle: 0,
      }, { merge: true });
      await appRef.update({ status: 'approved', approvedAt: Date.now(), resellerId: docId });
      return json({ ok: true, resellerId: docId, credit, linked: Boolean(a.uid) });
    }

    if (action === 'rejectReseller') {
      await db.collection('iptvResellerApps').doc(id).update({ status: 'rejected', rejectedAt: Date.now() });
      return json({ ok: true });
    }

    if (action === 'addCredit') {
      const add = Math.min(200, Math.max(1, Number(b.n) || 10));
      const ref = db.collection('iptvResellers').doc(id);
      const snap = await ref.get();
      if (!snap.exists) return json({ ok: false, error: 'Reseller nahi mila.' }, 404);
      const credit = (Number(snap.data().credit) || 0) + add;
      await ref.update({ credit });
      return json({ ok: true, credit });
    }

    if (action === 'markPaid') {
      const ref = db.collection('iptvResellers').doc(id);
      const snap = await ref.get();
      if (!snap.exists) return json({ ok: false, error: 'Reseller nahi mila.' }, 404);
      const amount = Math.max(0, Number(b.amount) || 0);
      const paidThisCycle = (Number(snap.data().paidThisCycle) || 0) + amount;
      await ref.update({ paidThisCycle, lastPaidAt: Date.now() });
      await db.collection('iptvPayments').add({ resellerId: id, amount, at: Date.now(), kind: 'reseller_to_admin' }).catch(() => {});
      return json({ ok: true, paidThisCycle });
    }

    if (action === 'createLine') {
      const email = String(b.email || '').trim().toLowerCase();
      const plan = ['starter', 'family', 'premium'].includes(b.plan) ? b.plan : 'starter';
      const months = [1, 3, 12].includes(Number(b.months)) ? Number(b.months) : 1;
      const price = clientPrice(b.price);
      let uid = '';
      if (email) { try { const u = await getAuth(adminApp()).getUserByEmail(email); uid = u.uid; } catch { uid = ''; } }
      const { username, password } = credentials();
      const doc = {
        uid, email, clientName: String(b.name || '').slice(0, 60), phone: String(b.phone || '').replace(/\D/g, '').slice(0, 11),
        username, password, mac: '', server: process.env.NEXT_PUBLIC_IPTV_SERVER || 'http://dns.mizanora.tv:8080',
        plan, maxDevices: plan === 'starter' ? 1 : plan === 'family' ? 2 : 3,
        price, months, locked: true, expiresAt: addMonths(Date.now(), months),
        status: 'active', trial: false, createdAt: Date.now(), resellerId: 'admin', resellerName: 'Mizanora',
      };
      const ref = await db.collection('iptvLines').add(doc);
      return json({ ok: true, line: { id: ref.id, ...doc } });
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
    users: [
      { uid: 'u_demo1', email: 'ali.raza@gmail.com', name: 'Ali Raza', lines: 1, active: 1, trial: false, lastAt: now - 3 * DAY },
      { uid: 'u_demo2', email: 'sana.malik@gmail.com', name: 'Sana Malik', lines: 1, active: 1, trial: true, lastAt: now - 6 * 3600e3 },
    ],
    apps: [
      { id: 'a1', name: 'Hamza Cable', phone: '0301-2233445', city: 'Gujranwala', experience: 'cable', at: now - 2 * 3600e3 },
      { id: 'a2', name: 'Rizwan Digital', phone: '0345-7788990', city: 'Sialkot', experience: 'mobile', at: now - 20 * 3600e3 },
    ],
    resellers: [
      { id: 'r1', name: 'Barakat Vision', phone: '0300-1112223', credit: 100, used: 86, price: 200, status: 'approved', paidThisCycle: 8600 },
      { id: 'r2', name: 'Sky Link Cable', phone: '0321-4445556', credit: 80, used: 62, price: 180, status: 'approved', paidThisCycle: 6200 },
      { id: 'r3', name: 'Madina Digital', phone: '0333-7778889', credit: 90, used: 71, price: 200, status: 'approved', paidThisCycle: 3200 },
    ],
    collection: [
      { reseller: 'Barakat Vision', connections: 86, due: 8600, paid: 8600 },
      { reseller: 'Sky Link Cable', connections: 62, due: 6200, paid: 6200 },
      { reseller: 'Madina Digital', connections: 71, due: 7100, paid: 3200 },
      { reseller: 'Ali Traders', connections: 45, due: 4500, paid: 4500 },
    ],
  };
}
