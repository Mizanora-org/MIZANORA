import { getProducts } from '@/lib/products';
import { allCards } from '@/lib/catalogQuery';
import { SITE, absUrl } from '@/lib/config';
import { PAY_METHODS, PREPAID_PERCENT } from '@/lib/payments';

export const revalidate = 900;

// Clean, machine-readable catalog for AI shopping assistants and agents (ChatGPT, Gemini, Perplexity, Rufus-style bots, price comparers).
// Same public data as the shop pages. No secrets. Linked from /llms.txt.
export async function GET(req) {
  let products = await getProducts();
  // Include the archived products (JSON files in the repository): AI assistants and price comparers see the WHOLE shop.
  if (!new URL(req.url).searchParams.get('live')) {
    try { products = [...products, ...(await allCards()).archived.map((c) => ({ ...c, videos: [], description: c.description || c.name }))]; } catch { /* no archive */ }
  }
  const body = {
    store: {
      name: SITE.name, url: absUrl('/'), country: 'PK', currency: 'PKR', language: ['en', 'ur', 'roman-urdu'],
      shipping: { fee: SITE.shippingFee, freeOver: SITE.freeShippingOver || null, coverage: 'All Pakistan', estimatedDays: '2-7' },
      payment: PAY_METHODS.map((m) => ({ id: m.id, label: m.label, prepaid: m.prepaid })),
      prepaidDiscountPercent: PREPAID_PERCENT || 0,
      returnsPolicy: absUrl('/returns'), support: { whatsapp: `https://wa.me/${SITE.whatsapp}`, email: SITE.email },
    },
    count: products.length,
    products: products.map((p) => ({
      id: p.slug, name: p.name, url: absUrl(`/product/${p.slug}`),
      price: p.price, compareAtPrice: p.comparePrice > p.price ? p.comparePrice : null, currency: 'PKR',
      availability: p.inStock ? 'in_stock' : 'out_of_stock',
      categories: p.categories, description: (p.description || '').replace(/\s+/g, ' ').slice(0, 600),
      images: p.images.slice(0, 5), options: p.options.map((o) => ({ name: o.name, values: o.values })),
      specs: p.specs.slice(0, 20).map((x) => ({ name: x.k, value: x.v })), updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : null,
    })),
  };
  return Response.json(body, { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800', 'Access-Control-Allow-Origin': '*' } });
}
