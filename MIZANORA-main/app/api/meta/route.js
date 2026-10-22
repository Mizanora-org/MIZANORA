import { NextResponse, after } from 'next/server';
import { sendCapi } from '@/lib/capi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Browser events that are mirrored to the Conversions API. Purchase is sent only by /api/orders (server truth).
const ALLOWED = new Set(['ViewContent', 'AddToCart', 'InitiateCheckout', 'AddToWishlist', 'Search', 'CompleteRegistration', 'Contact']);

export async function POST(req) {
  let b;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  if (!ALLOWED.has(b.eventName) || !b.eventId) return NextResponse.json({ ok: false }, { status: 400 });
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  after(() => sendCapi({
    eventName: b.eventName, eventId: String(b.eventId).slice(0, 80), sourceUrl: String(b.sourceUrl || '').slice(0, 500),
    customData: b.customData && typeof b.customData === 'object' ? b.customData : {},
    ip, userAgent: req.headers.get('user-agent') || '', fbp: b.fbp, fbc: b.fbc,
  }));
  return NextResponse.json({ ok: true });
}
