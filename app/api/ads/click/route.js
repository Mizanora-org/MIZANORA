import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/adsToken';
import { creditClick, findKeyDoc, hashKey } from '@/lib/adsServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

// POST /api/ads/click { key, campaign, token }
// The browser script fires this just before opening the ad link, so the click
// count is honest. It returns the link so the caller can navigate.
export async function POST(req) {
  try {
    const b = await req.json().catch(() => ({}));
    const key = String(b.key || '').slice(0, 120);
    const campaign = String(b.campaign || '').replace(/[^\w-]/g, '').slice(0, 60);
    const tok = verifyToken(b.token, process.env.AD_SECRET || 'mizanora-ads-v1');
    if (!tok || tok.campaignId !== campaign) {
      return NextResponse.json({ ok: false, error: 'bad token' }, { status: 403, headers: CORS });
    }

    let keyId = 'self';
    if (key !== 'self') {
      const h = hashKey(key);
      const doc = await findKeyDoc(key);
      if (!doc || doc.id !== h) return NextResponse.json({ ok: false, error: 'bad key' }, { status: 401, headers: CORS });
      keyId = doc.id;
    }
    await creditClick(campaign, keyId);
    return NextResponse.json({ ok: true, href: String(b.href || '').slice(0, 500) }, { headers: CORS });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500, headers: CORS });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
