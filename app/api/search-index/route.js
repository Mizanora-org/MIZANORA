import { NextResponse } from 'next/server';
import { denyIf } from '@/lib/siteGate';
import { getProducts } from '@/lib/products';

// v61: the site search index — a day is plenty and keeps ISR writes tiny (see lib/cachePolicy.js).
export const revalidate = 86400;

// Small public product list used by the search suggestions and "recently viewed" (no secrets, same data as the shop pages).
export async function GET() {
  const closed = await denyIf();
  if (closed) return closed;
  const all = await getProducts();
  return NextResponse.json(all.map((p) => ({
    id: p.id, slug: p.slug, name: p.name, category: p.category, categories: p.categories, price: p.price, image: p.images[0] || '',
    description: (p.description || '').slice(0, 240), options: p.options, specs: p.specs.map((x) => x.v).slice(0, 12),
  })), { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } });
}
