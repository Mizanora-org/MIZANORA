import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { cleanupAnalytics, readTraffic } from '@/lib/analyticsServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Admin only: /api/admin/traffic
//   POST { days: 14 }                → traffic report (countries, cities, browsers, IPs, goal)
//   POST { action: 'cleanup', keepDays: 90 } → trim old analytics buckets
export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });
  let body = {};
  try { body = await req.json(); } catch { /* defaults */ }

  if (body.action === 'cleanup') {
    const r = await cleanupAnalytics(Number(body.keepDays) || 60);
    return NextResponse.json(r);
  }

  const days = Math.max(1, Math.min(90, Number(body.days) || 14));
  const goal = Math.max(1000, Math.min(10_000_000, Number(body.goal) || Number(process.env.TRAFFIC_GOAL) || 100000));
  const report = await readTraffic(days, goal);
  return NextResponse.json(report, { headers: { 'cache-control': 'no-store' } });
}
