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

// v62: the shop's OWN pages ask this endpoint once per ad slot on every page view. `no-store` meant
// one Vercel Function invocation per slot per visitor — including the "ads are off" answer that
// 99% of visits get. A short, public edge cache makes one answer serve everyone for five minutes.
// `key=self` is same-origin only, so there is no wildcard CORS on this response, and `Vary: Origin`
// keeps the self check honest. Third-party ad keys keep the old open-CORS behaviour unchanged.
const SELF_CACHE = {
  'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
  'Vary': 'Origin',
  'X-Content-Type-Options': 'nosniff',
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
  const origin = String(req.headers.get('origin') || (() => { try { return new URL(req.headers.get('referer')).origin; } catch { return ''; } })()).replace(/\/$/, '');

  const r = await serveAds({ key, slot, count, selfOrigin: origin });
  const self = key === 'self';
  if (!r.ok) {
    const status = /key|auth|self/i.test(String(r.error || '')) ? 401 : 503;
    // For the shop's own pages a cacheable 200 is important: CDNs do not normally keep error
    // responses, so an "ads are off" 503 would still start a Function on every page view. The
    // embed script only looks at `ok`, so returning 200 here changes nothing for the visitor.
    return NextResponse.json({ ok: false, error: r.error }, { status: self ? 200 : status, headers: self ? SELF_CACHE : CORS });
  }
  return NextResponse.json(r, { headers: self ? SELF_CACHE : CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
