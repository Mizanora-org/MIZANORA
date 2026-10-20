import { NextResponse } from 'next/server';
import { getProducts } from '@/lib/products';
import { archiveCards } from '@/lib/archive';

export const runtime = 'nodejs';
export const revalidate = 300;

// The cards of the products in a shopper's wishlist. Looks in the live products AND in the catalogue files (the old wishlist page
// only looked at Firebase products, so a saved catalogue product never appeared). Public data only: what a product card shows.
const card = (p) => ({ id: p.id, slug: p.slug || p.id, name: p.name, price: p.price, comparePrice: p.comparePrice || 0, images: (p.images || []).slice(0, 1), sizes: p.sizes || [], inStock: p.inStock !== false, category: p.category || '', categories: p.categories || [] });

export async function GET(req) {
  const ids = [...new Set(String(new URL(req.url).searchParams.get('ids') || '').split(',').map((x) => x.trim()).filter(Boolean))].slice(0, 100);
  if (!ids.length) return NextResponse.json({ ok: true, products: [] });
  const live = new Map((await getProducts()).map((p) => [p.id, p]));
  let arch = new Map();
  try { arch = new Map(((await archiveCards()).list || []).map((c) => [c.id, c])); } catch { /* no catalogue files */ }
  const products = ids.map((id) => live.get(id) || arch.get(id)).filter((p) => p && p.active !== false).map(card);
  return NextResponse.json({ ok: true, products }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' } });
}
