import { NextResponse } from 'next/server';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { billingSummary, linesToSuspend, reminderText, periodOf, dueAtFor, BILLING } from '@/lib/iptvBilling';
import { logAdmin } from '@/lib/gateway/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// v47: BILLING CRON — roz aik dafa (vercel.json > crons).
//   GET /api/cron/iptv            -> due/overdue report + overdue lines suspend
//   GET /api/cron/iptv?dry=1      -> sirf report (kuch change nahi)
// Auth: Vercel khud `Authorization: Bearer $CRON_SECRET` bhejta hai. Local: ?key=<CRON_SECRET>
const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });

function authorized(req) {
  const secret = String(process.env.CRON_SECRET || '');
  if (!secret) return false;
  const header = String(req.headers.get('authorization') || '');
  const key = new URL(req.url).searchParams.get('key') || '';
  return header === `Bearer ${secret}` || (key && key === secret);
}

export async function GET(req) {
  if (!authorized(req)) return json({ ok: false, error: 'Unauthorized (CRON_SECRET set karein)' }, 401);
  if (!adminReady()) return json({ ok: false, error: 'Firestore connect karein (FIREBASE_SERVICE_ACCOUNT)' }, 503);

  const dry = ['1', 'true', 'yes'].includes(String(new URL(req.url).searchParams.get('dry') || ''));
  const now = Date.now();
  const db = adminDb();

  try {
    const snap = await db.collection('iptvLines').limit(500).get();
    const lines = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const summary = billingSummary(lines, now);
    const todo = dry ? [] : linesToSuspend(lines, now);

    const suspended = [];
    for (const line of todo.slice(0, 200)) {
      try {
        await db.collection('iptvLines').doc(line.id).update({
          status: 'suspended',
          suspendedAt: now,
          suspendedBy: 'cron',
          suspendReason: `unpaid ${Math.max(0, Math.floor((now - (Number(line.expiresAt) || now)) / 86400e3))} din`,
        });
        await db.collection('iptvSessions').doc(line.username || line.id).delete().catch(() => {});
        suspended.push(line.username || line.id);
      } catch { /* ek line fail ho to baqi chalti rahein */ }
    }

    if (suspended.length) await logAdmin(req, 'cron', 'billing_auto_suspend', { count: suspended.length, sample: suspended.slice(0, 20) });

    const reminders = summary.lines
      .filter((l) => l.state === 'due' || l.state === 'overdue')
      .slice(0, 100)
      .map((l) => {
        const line = lines.find((x) => x.id === l.id) || l;
        return { username: l.username, phone: l.phone, state: l.state, daysLeft: l.daysLeft, daysLate: l.daysLate, text: reminderText(line, now) };
      });

    return json({
      ok: true,
      dry,
      now,
      period: periodOf(now),
      dueAt: dueAtFor(now),
      graceDays: BILLING.graceDays,
      counts: {
        total: lines.length,
        ok: summary.ok, due: summary.due, overdue: summary.overdue, suspend: summary.suspend, off: summary.off, none: summary.none,
        amountAtRisk: summary.amountAtRisk,
        suspendedNow: suspended.length,
      },
      suspended: dry ? [] : suspended.slice(0, 50),
      reminders,
    });
  } catch (e) {
    return json({ ok: false, error: e.message || 'Cron failed' }, 500);
  }
}
