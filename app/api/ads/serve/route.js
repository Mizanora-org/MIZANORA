import { NextResponse } from 'next/server';
import { serveAds } from '@/lib/adsServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PUBLIC: any website that has an API key calls this. CORS is open on purpose -
// the ad script runs on OTHER websites, so the browser sends the request from
// their origin. The key (not the origin) is what authorises the call.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
  'Cache-Control': 'no-store',
  Vary: 'Origin',
};

// GET /api/ads/serve?key=mza_xxx&slot=video&count=1
// slot: '' | 'auto' | 'banner' | 'video' | 'animation' | 'product' | 'html'
// Special key "self": the shop's own pages (accepted only from the shop's own
// address AND only when the admin switched "Show ads on the shop itself" on).
export async function GET(req) {
  const sp = req.nextUrl.searchParams;
  const key = sp.get('key') || '';
  const slot = String(sp.get('slot') || '').slice(0, 20);
  const count = Math.max(1, Math.min(12, Math.floor(Number(sp.get('count'))) || 1));
  const origin = String(req.headers.get('origin') || '').replace(/\/$/, '');
  const host = String(req.headers.get('x-forwarded-host') || req.headers.get('host') || '').split(',')[0].trim();

  const r = await serveAds({ key, slot, count, selfOrigin: origin, selfHost: host });
  if (!r.ok) {
    const status = /key|auth|self/i.test(String(r.error || '')) ? 401 : 503;
    return NextResponse.json({ ok: false, error: r.error }, { status, headers: CORS });
  }
  return NextResponse.json(r, { headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
