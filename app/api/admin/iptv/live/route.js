import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { adminDb, adminReady } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });
const ONLINE_MS = 5 * 60_000; // 5 minute tak heartbeat na aaye to "offline"

// Admin > IPTV > Live now. Kaun online hai, kis app se, kaunsa channel, kis reseller ka line.
//   GET  -> { online:[...], events:[...], totals:{...} }
export async function GET(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  if (!adminReady()) return json({ ok: true, demo: true, online: [], events: [], totals: { online: 0, today: 0, countries: 0 } });

  try {
    const db = adminDb();
    const now = Date.now();
    const [sessionsSnap, eventsSnap] = await Promise.all([
      db.collection('iptvSessions').limit(600).get().catch(() => null),
      db.collection('iptvEvents').orderBy('at', 'desc').limit(120).get().catch(() => null),
    ]);

    const sessions = (sessionsSnap?.docs || []).map((d) => ({ id: d.id, ...d.data() }));
    const online = sessions
      .filter((s) => Number(s.lastSeen) > now - ONLINE_MS)
      .sort((x, y) => Number(y.lastSeen) - Number(x.lastSeen))
      .map((s) => ({
        username: s.username || s.id,
        clientName: s.clientName || '',
        resellerId: s.resellerId || '',
        app: s.app || '',
        ip: s.ip || '',
        kind: s.kind || '',
        channel: s.channel || '',
        device: s.device || '',
        lastSeen: Number(s.lastSeen) || Number(s.updatedAt) || 0,
        devices: Object.values(s.devices || {}).filter((t) => Number(t) > now - 90_000).length,
      }));

    const events = (eventsSnap?.docs || []).map((d) => ({ id: d.id, ...d.data() }));

    const dayAgo = now - 86400e3;
    const todayEvents = events.filter((e) => Number(e.at) > dayAgo);
    const appCount = {};
    for (const e of todayEvents) if (e.app) appCount[e.app] = (appCount[e.app] || 0) + 1;

    return json({
      ok: true,
      online,
      events,
      totals: {
        online: online.length,
        devices: online.reduce((n, s) => n + (s.devices || 0), 0),
        today: todayEvents.length,
        logins: todayEvents.filter((e) => e.type === 'login').length,
        plays: todayEvents.filter((e) => e.type === 'stream_start').length,
        apps: Object.entries(appCount).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, n]) => ({ name, n })),
      },
    });
  } catch (e) {
    return json({ ok: false, error: e.message || 'Server error' }, 500);
  }
}

// Purane session/event records hatao (Firestore mehnga na ho).
export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  if (!adminReady()) return json({ ok: false, error: 'Firestore connect karein.' }, 503);

  let b = {};
  try { b = await req.json(); } catch { b = {}; }
  const days = Math.min(90, Math.max(1, Number(b.days) || 14));
  const cut = Date.now() - days * 86400e3;

  try {
    const db = adminDb();
    const snap = await db.collection('iptvEvents').where('at', '<', cut).limit(300).get();
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    return json({ ok: true, deleted: snap.size, days });
  } catch (e) {
    return json({ ok: false, error: e.message || 'Server error' }, 500);
  }
}
