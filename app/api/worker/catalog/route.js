import { NextResponse } from 'next/server';
import { getProducts } from '@/lib/products';

export const runtime = 'nodejs';
export const revalidate = 300;

// Slim product list for the worker dashboard. Comes from the shared cached catalog: it costs NO extra Firestore reads.
export async function GET() {
  const list = (await getProducts()).filter((p) => p.inStock && p.affOn !== false).map((p) => ({
    id: p.id, name: p.name, price: p.price, image: p.images[0] || '', images: p.images.slice(0, 8), videos: p.videos.slice(0, 4), category: p.category, affRate: p.affRate || 0,
  }));
  return NextResponse.json({ ok: true, products: list }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
}
