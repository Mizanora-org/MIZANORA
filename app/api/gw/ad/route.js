import { unstable_cache } from 'next/cache';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { ADS_DOC, adForChannel, cleanAds } from '@/lib/iptvAds';
import { clientIp, rateLimit } from '@/lib/gateway/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public: hamare player ko ad config (kis channel par kya chalana hai).
// Asli stream URLs yahan nahi aate — sirf ad ka apna link.
const readAds = unstable_cache(async () => {
  try {
    if (!adminReady()) return cleanAds({});
    const snap = await adminDb().collection(ADS_DOC.collection).doc(ADS_DOC.id).get();
    return cleanAds(snap.exists ? snap.data() : {});
  } catch { return cleanAds({}); }
}, ['mz-iptv-ads-v1'], { revalidate: 120, tags: ['iptv'] });

export async function GET(req) {
  if (!rateLimit(clientIp(req), 'gw-ad', 60, 60_000)) {
    return Response.json({ ad: null }, { status: 429, headers: { 'Cache-Control': 'no-store' } });
  }
  const channel = new URL(req.url).searchParams.get('channel') || '';
  const ads = await readAds();
  const ad = adForChannel(ads, channel);
  return Response.json({ ad, enabled: ads.enabled, updatedAt: ads.updatedAt }, {
    headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
  });
}
