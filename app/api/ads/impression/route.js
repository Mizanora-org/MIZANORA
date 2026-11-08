import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/adsToken';
import { limitRequest } from '@/lib/requestRate';
import { logSecurityEvent, securityIp } from '@/lib/securityControl';
import { readLimitedJson } from '@/lib/readLimitedJson';
import { creditImpression, findKeyDoc, hashKey } from '@/lib/adsServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

// POST /api/ads/impression { key, campaign, token }
// The token was signed by /api/ads/serve for THIS key + campaign, so the counts
// cannot be faked by editing the request.
export async function POST(req) {
  const ip = securityIp(req.headers) || 'unknown';
  if (!limitRequest('ads-track', ip, 100, 60_000).allowed) {
    void logSecurityEvent(req, 'rate-limit', { reason: 'ads-track', severity: 'medium' });
    return new NextResponse(null, { status: 429, headers: CORS });
  }
  let b;
  try { b = await readLimitedJson(req, 2048); }
  catch { return new NextResponse(null, { status: 400, headers: CORS }); }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return new NextResponse(null, { status: 400, headers: CORS });
  try {
    const key = String(b.key || '').slice(0, 120);
    const campaign = String(b.campaign || '').replace(/[^\w-]/g, '').slice(0, 60);
    const tok = verifyToken(b.token);
    if (!tok || tok.campaignId !== campaign) return new NextResponse(null, { status: 403, headers: CORS });

    const keyId = key === 'self' ? 'self' : hashKey(key);
    if (tok.keyId !== keyId) return new NextResponse(null, { status: 403, headers: CORS });
    if (key !== 'self') {
      const doc = await findKeyDoc(key);
      const d = doc?.data;
      if (!doc || doc.id !== keyId || d.revoked || (d.expiresAt && Date.now() > Number(d.expiresAt))
        || !Array.isArray(d.allowedAds) || !(d.allowedAds.includes('all') || d.allowedAds.includes(campaign))) {
        return new NextResponse(null, { status: 401, headers: CORS });
      }
    }
    // A served creative can only contribute once per token per instance. This is
    // best-effort replay protection; deploy a fleet-wide WAF for distributed abuse.
    if (!limitRequest('ads-impression-token', b.token, 1, 900000).allowed) return new NextResponse(null, { status: 204, headers: CORS });
    await creditImpression(campaign, keyId);
    return new NextResponse(null, { status: 204, headers: CORS });
  } catch {
    return new NextResponse(null, { status: 500, headers: CORS });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
