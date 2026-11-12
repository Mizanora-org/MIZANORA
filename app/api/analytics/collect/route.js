import { NextResponse } from 'next/server';
import { analyticsReady, recordHit } from '@/lib/analyticsServer';
import { serverWeight } from '@/lib/beaconBudget';

// v62: only a sampled fraction of visitors sends this beacon (lib/beaconBudget.js). The weight is
// derived from the server's own env var, never from the request, and recordHit() scales every
// counter so Admin > Traffic still shows full-scale estimates.
const weight = serverWeight();

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/analytics/collect — one small beacon per page view.
//
// The browser sends only what JavaScript knows (path, referrer, title, language, screen class).
// The country, city, timezone, IP, browser and OS are read from the request headers on the server,
// because a browser cannot be trusted to report its own location.
//
// Answers 204 always: analytics must never show an error to a visitor.
const recent = new Map();

function limited(ip) {
  const now = Date.now();
  const arr = (recent.get(ip) || []).filter((t) => now - t < 60_000);
  arr.push(now);
  recent.set(ip, arr);
  if (recent.size > 4000) recent.clear();
  return arr.length > 40; // 40 page views a minute from one address is enough for anyone
}

export async function POST(req) {
  try {
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
    if (ip && limited(ip)) return new NextResponse(null, { status: 204 });
    if (!analyticsReady()) return new NextResponse(null, { status: 204 });
    let body = {};
    try { body = await req.json(); } catch { body = {}; }
    await recordHit({ headers: req.headers, body, weight });
  } catch { /* never break the page */ }
  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}

// Old cached pages (and uptime probes) still GET this path. A cached 204 means even a stray GET is
// answered by the CDN instead of starting a Function.
export async function GET() {
  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } });
}
