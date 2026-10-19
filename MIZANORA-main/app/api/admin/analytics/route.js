import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { adminRtdb } from '@/lib/firebase-admin';
import { dayKey, hourKey, rtdbOn } from '@/lib/rtdb';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Admin only. Everything the dashboard shows comes from the Realtime Database: zero Firestore reads.
//   POST { live: true }            -> only "who is on the site now" + the live order feed (cheap, refreshed every 20 s)
//   POST { days: 14 }              -> the full picture
//   POST { action: 'cleanup', keepDays: 90 }  -> delete old counters
const json = (b, s = 200) => NextResponse.json(b, { status: s });
const val = async (path) => (await adminRtdb().ref(path).get()).val();
const top = (map, n = 12) => Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ k, v }));
const addInto = (acc, o) => { for (const [k, v] of Object.entries(o || {})) acc[k] = (acc[k] || 0) + (Number(v) || 0); };
const daysBack = (n) => Array.from({ length: n }, (_, i) => dayKey(Date.now() - (n - 1 - i) * 864e5));

async function live() {
  const now = Date.now();
  const p = (await val('presence')) || {};
  const rows = Object.entries(p).map(([id, x]) => ({ id, t: Number(x.t) || 0, p: String(x.p || ''), d: x.d || '' }));
  const online = rows.filter((r) => now - r.t < 90e3).sort((a, b) => b.t - a.t);
  const stale = rows.filter((r) => now - r.t > 10 * 60e3).slice(0, 400);
  if (stale.length) { const u = {}; stale.forEach((r) => { u[r.id] = null; }); adminRtdb().ref('presence').update(u).catch(() => {}); }
  const pages = {};
  online.forEach((r) => { pages[r.p] = (pages[r.p] || 0) + 1; });
  const feedSnap = await adminRtdb().ref('liveOrders').orderByChild('t').limitToLast(12).get();
  const feed = [];
  feedSnap.forEach((c) => { feed.push({ id: c.key, ...c.val() }); });
  feed.sort((a, b) => b.t - a.t);
  const back = await val('ordersBackup');
  return { now, online: online.length, devices: online.reduce((m, r) => { m[r.d || '?'] = (m[r.d || '?'] || 0) + 1; return m; }, {}), pages: top(pages, 8), visitors: online.slice(0, 25).map((r) => ({ p: r.p, ago: Math.round((now - r.t) / 1000), d: r.d })), feed, backupOrders: back ? Object.keys(back).length : 0 };
}

export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  if (!rtdbOn()) return json({ ok: false, setup: true, error: 'The Realtime Database is not set up yet. Firebase Console > Build > Realtime Database > Create database, then redeploy.' });
  let b = {}; try { b = await req.json(); } catch { /* defaults */ }
  try {
    if (b.action === 'cleanup') {
      const keep = Math.max(30, Math.min(730, Number(b.keepDays) || 90));
      const cutoff = dayKey(Date.now() - keep * 864e5);
      let removed = 0;
      for (const m of ['d', 'ev', 'src', 'dev', 'pv', 'cart', 'q', 'q0', 'h']) {
        const snap = await adminRtdb().ref(`stats/${m}`).orderByKey().endBefore(cutoff).limitToFirst(400).get();
        const u = {}; snap.forEach((c) => { u[c.key] = null; removed++; });
        if (Object.keys(u).length) await adminRtdb().ref(`stats/${m}`).update(u);
      }
      return json({ ok: true, removed });
    }
    if (b.live) return json({ ok: true, ...(await live()) });

    const n = Math.max(3, Math.min(60, Number(b.days) || 14));
    const days = daysBack(n);
    const get = (m) => Promise.all(days.map((d) => val(`stats/${m}/${d}`)));
    const [dd, ev, src, dev, pv, cart, q, q0] = await Promise.all([get('d'), get('ev'), get('src'), get('dev'), get('pv'), get('cart'), get('q'), get('q0')]);
    const last7 = (arr) => { const acc = {}; arr.slice(-7).forEach((o) => addInto(acc, o)); return acc; };
    const all = (arr) => { const acc = {}; arr.forEach((o) => addInto(acc, o)); return acc; };
    // hours of the last 24 h
    const now = Date.now();
    const hours = Array.from({ length: 24 }, (_, i) => hourKey(now - (23 - i) * 3600e3));
    const hv = await Promise.all(hours.map((h) => val(`stats/h/${h}/v`)));
    const series = days.map((d, i) => ({ d, views: Number(dd[i] && dd[i].views) || 0, uv: Number(dd[i] && dd[i].uv) || 0, orders: Number(dd[i] && dd[i].orders) || 0, sales: Number(dd[i] && dd[i].sales) || 0 }));
    return json({
      ok: true, series, hours: hours.map((h, i) => ({ h: h.slice(11), v: Number(hv[i]) || 0 })),
      funnel: (() => { const f = all(ev); return { view: f.view || 0, cart: f.cart || 0, checkout: f.checkout || 0, order: f.order || 0, wa: f.wa || 0, wish: f.wish || 0 }; })(),
      sources: top(all(src)), devices: top(all(dev)),
      topProducts: top(last7(pv), 15), topCart: top(last7(cart), 15), topSearches: top(last7(q), 15), noResult: top(last7(q0), 15),
      today: series[series.length - 1],
    });
  } catch (e) {
    console.error('analytics failed:', e.message);
    return json({ ok: false, error: e.message }, 500);
  }
}
