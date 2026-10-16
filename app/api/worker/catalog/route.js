import { NextResponse } from 'next/server';
import { denyIf } from '@/lib/siteGate';
import { getProduct } from '@/lib/products';
import { browseRemote, searchRemote } from '@/lib/catalogQuery';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Product list for the worker dashboard. Works for a shop with lakhs of products: it is searched and paged on the server
// (live + archived products, all from memory, no Firestore reads).
//   GET /api/worker/catalog?q=red suit&max=2000          -> up to 80 matches
//   GET /api/worker/catalog?max=2000&cursor=i:48          -> next page of the browse list
//   GET /api/worker/catalog?id=<slug>                      -> ONE product with all photos and videos
const slim = (p) => ({ id: p.id, name: p.name, price: p.price, image: (p.images && p.images[0]) || '', images: (p.images || []).slice(0, 8), videos: (p.videos || []).slice(0, 4), category: p.category, affRate: p.affRate || 0 });
const nums = (v) => Math.max(0, Math.floor(Number(v) || 0));

export async function GET(req) {
  const closed = await denyIf('workers');
  if (closed) return closed;
  const u = new URL(req.url).searchParams;
  try {
    const id = String(u.get('id') || '').slice(0, 120);
    if (id) {
      const p = await getProduct(id);
      return NextResponse.json(p ? { ok: true, product: slim(p) } : { ok: false }, { status: p ? 200 : 404 });
    }
    const q = String(u.get('q') || '').slice(0, 100).trim();
    const max = nums(u.get('max'));
    let items = [], next = '';
    if (q.length >= 2) items = (await searchRemote(q, { max, limit: 80 })).items;
    else { const r = await browseRemote({ sort: 'new', max, cursor: String(u.get('cursor') || ''), size: 60 }); items = r.items; next = r.next; }
    return NextResponse.json({ ok: true, products: items.filter((p) => p.inStock && p.affOn !== false).map(slim), next }, { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' } });
  } catch (e) {
    console.error('worker catalog failed:', e.message);
    return NextResponse.json({ ok: false, products: [], next: '' }, { status: 500 });
  }
}
