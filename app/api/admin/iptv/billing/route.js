import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { billingSummary, billingState, reminderText, periodOf, dueAtFor, BILLING } from '@/lib/iptvBilling';
import { IPTV } from '@/lib/iptv';
import { logAdmin } from '@/lib/gateway/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });
const DAY = 86400e3;

// v47: billing ka admin view + manual actions.
//   GET  /api/admin/iptv/billing           -> cycle, counts, due/overdue lines + reminder text
//   POST { action:'markPaid', id, months } -> expiry barhao + payment record
//   POST { action:'suspend', id } | { action:'extend', id, days }
export async function GET(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  if (!adminReady()) return json({ ok: true, demo: true, lines: [], counts: {}, cron: false });

  try {
    const snap = await adminDb().collection('iptvLines').limit(500).get();
    const lines = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const summary = billingSummary(lines, Date.now());
    return json({
      ok: true,
      now: Date.now(),
      period: periodOf(),
      dueAt: dueAtFor(),
      graceDays: BILLING.graceDays,
      cycle: BILLING.cycle,
      cron: Boolean(process.env.CRON_SECRET),
      counts: {
        total: lines.length,
        ok: summary.ok, due: summary.due, overdue: summary.overdue, suspend: summary.suspend, off: summary.off, none: summary.none,
        amountAtRisk: summary.amountAtRisk,
      },
      lines: summary.lines.slice(0, 120).map((l) => ({
        ...l,
        state: billingState(l, Date.now()).state,
        text: reminderText(lines.find((x) => x.id === l.id) || l, Date.now()),
      })),
    });
  } catch (e) {
    return json({ ok: false, error: e.message || 'Load failed' }, 500);
  }
}

export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  if (!adminReady()) return json({ ok: false, error: 'Firestore connect karein (FIREBASE_SERVICE_ACCOUNT).' }, 503);

  let b;
  try { b = await req.json(); } catch { return json({ ok: false, error: 'Bad request' }, 400); }
  const action = String(b.action || '');
  const id = String(b.id || '');
  if (!id) return json({ ok: false, error: 'Line id missing.' }, 400);

  const db = adminDb();
  const ref = db.collection('iptvLines').doc(id);

  try {
    const snap = await ref.get();
    if (!snap.exists) return json({ ok: false, error: 'Line nahi mili.' }, 404);
    const line = { id, ...snap.data() };

    if (action === 'markPaid') {
      const months = [1, 3, 6, 12].includes(Number(b.months)) ? Number(b.months) : 1;
      const from = Math.max(Date.now(), Number(line.expiresAt) || 0);
      const d = new Date(from);
      d.setMonth(d.getMonth() + months);
      const amount = Math.max(0, Number(line.price) || 0) * months;
      await ref.update({ expiresAt: d.getTime(), status: 'active', months, lastPaymentAt: Date.now(), paidThisCycle: amount });
      await db.collection('iptvPayments').add({
        lineId: id, username: line.username || '', resellerId: line.resellerId || '', months, amount,
        wholesale: IPTV.wholesale * months, at: Date.now(), kind: 'admin_renewal',
      }).catch(() => {});
      await logAdmin(req, a.uid, 'billing_mark_paid', { id, username: line.username, months, amount });
      return json({ ok: true, expiresAt: d.getTime(), months, amount });
    }

    if (action === 'suspend') {
      await ref.update({ status: 'suspended', statusAt: Date.now(), suspendedBy: 'admin', suspendReason: 'unpaid' });
      await db.collection('iptvSessions').doc(line.username || id).delete().catch(() => {});
      await logAdmin(req, a.uid, 'billing_suspend', { id, username: line.username });
      return json({ ok: true, status: 'suspended' });
    }

    if (action === 'extend') {
      const days = Math.min(365, Math.max(1, Number(b.days) || 7));
      const from = Math.max(Date.now(), Number(line.expiresAt) || 0);
      await ref.update({ expiresAt: from + days * DAY, status: 'active', statusAt: Date.now() });
      await logAdmin(req, a.uid, 'billing_extend', { id, username: line.username, days });
      return json({ ok: true, expiresAt: from + days * DAY, days });
    }

    return json({ ok: false, error: 'Unknown action' }, 400);
  } catch (e) {
    return json({ ok: false, error: e.message || 'Server error' }, 500);
  }
}
