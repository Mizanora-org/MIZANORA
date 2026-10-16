import { NextResponse } from 'next/server';
import { browseRemote, searchRemote } from '@/lib/catalogQuery';
import { denyIf } from '@/lib/siteGate';
import { getCategories } from '@/lib/products';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PUBLIC. "Aap ke liye" (for you) shelf: the assistant's memory says which categories this shopper looks at, and this route
// returns the best cards from them. It reads the WHOLE catalogue (archived JSON files + live products) from server memory -
// zero Firestore reads, so it never touches the free quota. Cacheable for 5 minutes per category set.
export async function GET(req) {
  const closed = await denyIf();
  if (closed) return closed;
  const u = new URL(req.url);
  const cats = String(u.searchParams.get('cats') || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 3);
  const limit = Math.max(1, Math.min(20, Number(u.searchParams.get('limit')) || 10));
  if (!cats.length) return NextResponse.json({ ok: true, items: [] });

  // Only real categories (so a stored slug cannot make the server walk anything odd).
  const known = new Set((await getCategories().catch(() => [])).map((c) => c.slug));
  const use = cats.filter((c) => known.has(c));
  if (!use.length) return NextResponse.json({ ok: true, items: [] });

  const out = new Map();
  await Promise.all(use.map(async (cat) => {
    try {
      for (const sort of ['low', 'new']) {
        const r = await browseRemote({ cat, sort, size: 12 });
        for (const p of r.items || []) if (!out.has(p.id) && p.inStock !== false && ((p.images || [])[0] || p.image)) out.set(p.id, p);
        if (out.size >= limit) break;
      }
    } catch (e) { console.error('for-you browse failed:', cat, e.message); }
  }));
  let items = [...out.values()];
  if (!items.length && use.length) { // very small shop: fall back to a plain search of the category words
    try { items = (await searchRemote(use.join(' '), { limit })).items.filter((p) => p.inStock !== false && ((p.images || [])[0] || p.image)); } catch { /* ignore */ }
  }
  items = items.slice(0, limit).map((p) => ({
    id: p.id, slug: p.slug, name: p.name, price: p.price, comparePrice: p.comparePrice || 0,
    images: p.images || [], categories: p.categories || [], inStock: p.inStock !== false, hasOptions: Boolean(p.hasOptions || (p.options && p.options.length)),
  }));
  return NextResponse.json({ ok: true, cats: use, items }, { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' } });
}
