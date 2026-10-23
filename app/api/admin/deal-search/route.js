import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/adminAuth';
import { browseRemote, searchRemote } from '@/lib/catalogQuery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Admin only. POST { q } -> the products (live AND catalogue-file products) the admin can tick for a deal group. Searched in server memory: no Firestore reads.
// Empty q = the newest products.
export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });
  let b; try { b = await req.json(); } catch { b = {}; }
  const q = String(b.q || '').trim().slice(0, 100);
  try {
    const r = q ? await searchRemote(q, { limit: 40 }) : await browseRemote({ sort: 'new', size: 40 });
    const items = (r.items || []).map((c) => ({ id: String(c.id), name: String(c.name || '').slice(0, 90), price: Number(c.price) || 0, comparePrice: Number(c.comparePrice) || 0, image: (c.images && c.images[0]) || '', cat: c.category || '' }));
    return NextResponse.json({ ok: true, items }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('deal-search failed:', e.message);
    return NextResponse.json({ ok: false, error: 'Search failed. Try again.' }, { status: 500 });
  }
}
