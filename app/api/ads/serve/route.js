import { NextResponse } from 'next/server';
import { SITE } from '@/lib/config';
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
  'Cache-Control': 'no-store',
};

// GET /api/ads/serve?key=mza_xxx&slot=video&count=1
// slot: '' | 'auto' | 'banner' | 'video' | 'animation' | 'product' | 'html'
// Special key "self": the shop's own pages (only accepted when the request
// comes from the shop's own origin - home + deals pages use it).
export async function GET(req) {
  const sp = req.nextUrl.searchParams;
  const key = sp.get('key') || '';
  const slot = String(sp.get('slot') || '').slice(0, 20);
  const count = Math.max(1, Math.min(12, Math.floor(Number(sp.get('count'))) || 1));
  const origin = String(req.headers.get('origin') || '').replace(/\/$/, '');

  const r = await serveAds({ key, slot, count, selfOrigin: origin });
  if (!r.ok) {
    const status = /key|auth/i.test(String(r.error || '')) ? 401 : 503;
    return NextResponse.json({ ok: false, error: r.error }, { status, headers: CORS });
  }
  return NextResponse.json(r, { headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
