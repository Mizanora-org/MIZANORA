import { NextResponse } from 'next/server';
import { adminRtdb, adminReady } from '@/lib/firebase-admin';
import { dayKey, rtdbOn } from '@/lib/rtdb';

export const runtime = 'nodejs';
export const revalidate = 60;

// v37: PUBLIC numbers. No sign-in, no personal data, nothing that can identify a visitor:
// only totals, a 14-day sparkline, the busiest pages (a path, never a person) and the split of
// devices and sources. Everything comes from the Realtime Database and is cached for a minute,
// so this page costs no Firestore reads and cannot be used to hammer the database.
//
// Deliberately NOT exposed: individual presence records, visitor ids, order contents, searches
// that could contain personal words (those stay in the admin dashboard only).
const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });

const top = (map, n = 10) => Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ k, v }));
const addInto = (acc, o) => { for (const [k, v] of Object.entries(o || {})) acc[k] = (acc[k] || 0) + (Number(v) || 0); };

const prettyPath = (k) => (k === 'home' ? '/' : `/${String(k).replace(/_/g, '/')}`);

export async function GET() {
  if (!adminReady() || !rtdbOn()) {
    return json({ ok: false, setup: true, online: 0, today: { views: 0, uv: 0 }, series: [], topPages: [], devices: [], sources: [] });
  }
  try {
    const ref = (p) => adminRtdb().ref(p).get();
    const days = Array.from({ length: 14 }, (_, i) => dayKey(Date.now() - (13 - i) * 864e5));

    const [dd, pg, dev, src] = await Promise.all([
      Promise.all(days.map((d) => ref(`stats/d/${d}`))),
      Promise.all(days.map((d) => ref(`stats/pg/${d}`))),
      Promise.all(days.map((d) => ref(`stats/dev/${d}`))),
      Promise.all(days.map((d) => ref(`stats/src/${d}`))),
    ]);
    const v = (snap) => snap.val() || {};

    const series = days.map((d, i) => ({ d, views: Number(v(dd[i]).views) || 0, uv: Number(v(dd[i]).uv) || 0 }));
    const pages = {};
    const devices = {};
    const sources = {};
    pg.forEach((s) => addInto(pages, v(s)));
    dev.forEach((s) => addInto(devices, v(s)));
    src.forEach((s) => addInto(sources, v(s)));

    // "on the site now" - count presence records touched in the last 90 seconds, never return them
    let online = 0;
    try {
      const now = Date.now();
      const p = await ref('presence');
      const val = p.val() || {};
      online = Object.values(val).filter((x) => x && now - (Number(x.t) || 0) < 90e3).length;
    } catch { online = 0; }

    const today = series[series.length - 1] || { views: 0, uv: 0 };
    return json({
      ok: true,
      online,
      today: { views: today.views, uv: today.uv },
      series,
      topPages: top(pages, 10).map((x) => ({ path: prettyPath(x.k), views: x.v })),
      devices: top(devices, 4),
      sources: top(sources, 6),
      totals: series.reduce((a, r) => ({ views: a.views + r.views, uv: a.uv + r.uv }), { views: 0, uv: 0 }),
      updatedAtMs: Date.now(),
    });
  } catch (e) {
    console.error('public stats failed:', e.message);
    return json({ ok: false, error: 'Numbers are not available right now.', online: 0, today: { views: 0, uv: 0 }, series: [], topPages: [], devices: [], sources: [] });
  }
}
