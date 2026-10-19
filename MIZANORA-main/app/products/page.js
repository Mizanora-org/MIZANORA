import { Suspense } from 'react';
import { getProducts, getCategories, getTotalCount, isLargeShop } from '@/lib/products';
import { browseRemote } from '@/lib/catalogQuery';
import { absUrl } from '@/lib/config';
import { pageMeta, breadcrumbJsonLd } from '@/lib/seo';
import { PageHead } from '@/components/Prose';
import ProductGrid from '@/components/ProductGrid';
import JsonLd from '@/components/JsonLd';
import { toCard } from '@/lib/cardData';

export const revalidate = 1800; // data comes from the shared cache; the admin panel refreshes pages instantly
export const metadata = pageMeta({
  title: 'Products, Cash on Delivery in Pakistan',
  description: 'Browse all Mizanora products. Order online in Pakistan with cash on delivery. WhatsApp support available.',
  path: '/products',
});

export default async function ProductsPage() {
  let products = await getProducts();
  // A shop with lakhs of products: the page opens with the cheapest first page and the grid asks the server for the rest.
  const remote = await isLargeShop();
  let total = products.length, next = '', chips = null;
  if (remote) {
    total = await getTotalCount();
    try { const r = await browseRemote({ sort: 'low' }); if (r.ok && r.items.length) { products = r.items; next = r.next; } } catch (e) { console.error('first page failed:', e.message); }
    chips = (await getCategories()).slice(0, 40).map((c) => ({ slug: c.slug, name: c.name, count: c.count }));
  }
  const cards = remote ? products : products.map(toCard); // slim copy for the browser (the JSON-LD below uses the full list)
  const crumbs = [['/', 'Home'], ['/products', 'Products']];
  const list = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    itemListElement: products.slice(0, 100).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: absUrl(`/product/${p.slug}`), name: p.name })),
  };
  return (
    <>
      <PageHead title="Products" intro="Pay cash on delivery anywhere in Pakistan. Tap a product to see sizes and details." crumbs={[['/', 'Home'], [null, 'Products']]} />
      <div className="mx-auto max-w-7xl px-3 py-8 sm:px-4">
        <Suspense fallback={null}><ProductGrid products={cards} remote={remote} total={total} initialNext={next} chips={chips} /></Suspense>
      </div>
      <JsonLd data={[breadcrumbJsonLd(crumbs), list]} />
    </>
  );
}
