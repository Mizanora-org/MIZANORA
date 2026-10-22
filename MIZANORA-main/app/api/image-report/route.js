import { NextResponse } from 'next/server';
import { denyIf } from '@/lib/siteGate';
import { adminReady } from '@/lib/firebase-admin';
import { inspectProduct } from '@/lib/imageErrors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// A shopper's phone says "a photo of this product did not load". We do NOT trust that: the server downloads the product's photos itself,
// and only when a photo is really broken is it removed (product hidden if nothing works) and listed in Admin > Photo errors.
// A fake report can therefore never hide a good product.
const hits = new Map();
const recent = new Map(); // slug -> time of the last check (one check per product per 10 minutes)
let running = 0;

export async function POST(req) {
  const closed = await denyIf('imageReport');
  if (closed) return closed;
  if (!adminReady()) return NextResponse.json({ ok: false }, { status: 501 });
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'x';
  const now = Date.now();
  const a = (hits.get(ip) || []).filter((t) => now - t < 60000); a.push(now); hits.set(ip, a);
  if (hits.size > 3000) hits.clear();
  if (a.length > 30) return NextResponse.json({ ok: false }, { status: 429 });

  let slug = '';
  try { slug = String((await req.json()).slug || ''); } catch { /* ignore */ }
  if (!/^[a-z0-9][a-z0-9-]{0,110}$/.test(slug)) return NextResponse.json({ ok: false }, { status: 400 });
  if (now - (recent.get(slug) || 0) < 10 * 60e3) return NextResponse.json({ ok: true, checked: false });
  if (running >= 6) return NextResponse.json({ ok: true, checked: false });
  recent.set(slug, now);
  if (recent.size > 5000) recent.clear();

  running += 1;
  try {
    const r = await inspectProduct(slug, { source: 'visitor' });
    return NextResponse.json({ ok: true, checked: true, state: r.state, removed: r.state === 'hidden' });
  } catch (e) {
    console.error('image-report failed', e.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  } finally { running -= 1; }
}
