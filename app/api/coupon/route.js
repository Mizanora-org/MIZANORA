import { NextResponse } from 'next/server';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { priceCoupon } from '@/lib/coupons';
import { getProducts } from '@/lib/products';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Checks a promo code against the real prices in the catalog (not the browser's numbers).
// Product prices come from the shared cached catalog, so this costs only ONE Firestore read (the coupon itself).
export async function POST(req) {
  if (!adminReady()) return NextResponse.json({ ok: false, error: 'Promo codes are not available right now.' }, { status: 503 });
  let b;
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 }); }
  const rawItems = Array.isArray(b.items) ? b.items.slice(0, 15) : [];
  if (!rawItems.length) return NextResponse.json({ ok: false, error: 'Your cart is empty.' }, { status: 400 });
  try {
    const catalog = new Map((await getProducts()).map((p) => [p.id, p]));
    const items = rawItems.map((r) => {
      const p = catalog.get(String(r.id));
      return p ? { id: p.id, name: p.name, price: p.price, qty: Math.max(1, Math.min(10, Math.floor(Number(r.qty)) || 1)) } : null;
    }).filter(Boolean);
    const res = await priceCoupon(adminDb(), b.code, items);
    if (!res.ok) return NextResponse.json(res);
    // The browser needs only these fields
    return NextResponse.json({ ok: true, code: res.code, discount: res.discount, label: res.label, scoped: res.scoped, appliesTo: res.appliesTo });
  } catch (e) {
    console.error('coupon failed', e.message);
    return NextResponse.json({ ok: false, error: 'Could not check the promo code. Try again.' }, { status: 500 });
  }
}
