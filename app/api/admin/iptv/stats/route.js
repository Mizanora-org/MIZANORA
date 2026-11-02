import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { byReseller, dailySeries, overview, topApps, topContent } from '@/lib/iptvStats';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });

// ANALYTICS — poore panel ke numbers: din ke hisab se plays, top channels, top apps,
// reseller ke hisab se lines/online, aur KPI.
//   GET ?days=14
export async function GET(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  if (!adminReady()) return json({ ok: true, demo: true, ...empty() });

  const q = new URL(req.url).searchParams;
  const days = Math.min(60, Math.max(3, Number(q.get('days')) || 14));

  try {
    const db = adminDb();
    const since = Date.now() - days * 86400e3;
    const [eventsSnap, linesSnap, resSnap, sessSnap] = await Promise.all([
      db.collection('iptvEvents').where('at', '>', since).limit(4000).get().catch(() => null),
      db.collection('iptvLines').limit(800).get().catch(() => null),
      db.collection('iptvResellers').limit(200).get().catch(() => null),
      db.collection('iptvSessions').limit(600).get().catch(() => null),
    ]);

    const events = (eventsSnap?.docs || []).map((d) => d.data());
    const lines = (linesSnap?.docs || []).map((d) => ({ id: d.id, ...d.data() }));
    const resellers = (resSnap?.docs || []).map((d) => ({ id: d.id, ...d.data() }));
    const online = (sessSnap?.docs || []).map((d) => d.data());

    return json({
      ok: true,
      days,
      kpi: overview({ events, lines, online, resellers }),
      daily: dailySeries(events, days),
      topChannels: topContent(events, 12),
      topApps: topApps(events, 8),
      resellers: byReseller(lines, events, online),
    });
  } catch (e) {
    return json({ ok: false, error: e.message || 'Server error' }, 500);
  }
}

const empty = () => ({
  kpi: overview({}),
  daily: dailySeries([], 14),
  topChannels: [],
  topApps: [],
  resellers: [],
});
