import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/adsToken';
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
  try {
    const b = await req.json().catch(() => ({}));
    const key = String(b.key || '').slice(0, 120);
    const campaign = String(b.campaign || '').replace(/[^\w-]/g, '').slice(0, 60);
    const tok = verifyToken(b.token, process.env.AD_SECRET || 'mizanora-ads-v1');
    if (!tok || tok.campaignId !== campaign) return new NextResponse(null, { status: 403, headers: CORS });

    let keyId = 'self';
    if (key !== 'self') {
      const h = hashKey(key);
      const doc = await findKeyDoc(key);
      if (!doc || doc.id !== h) return new NextResponse(null, { status: 401, headers: CORS });
      keyId = doc.id;
    }
    await creditImpression(campaign, keyId);
    return new NextResponse(null, { status: 204, headers: CORS });
  } catch {
    return new NextResponse(null, { status: 500, headers: CORS });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
