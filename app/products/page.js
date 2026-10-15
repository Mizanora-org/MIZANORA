import { Suspense } from 'react';
import { getProducts } from '@/lib/products';
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
  const products = await getProducts();
  const cards = products.map(toCard); // slim copy for the browser (the JSON-LD below uses the full list)
  const crumbs = [['/', 'Home'], ['/products', 'Products']];
  const list = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    itemListElement: products.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: absUrl(`/product/${p.slug}`), name: p.name })),
  };
  return (
    <>
      <PageHead title="Products" intro="Pay cash on delivery anywhere in Pakistan. Tap a product to see sizes and details." crumbs={[['/', 'Home'], [null, 'Products']]} />
      <div className="mx-auto max-w-7xl px-3 py-8 sm:px-4">
        <Suspense fallback={null}><ProductGrid products={cards} /></Suspense>
      </div>
      <JsonLd data={[breadcrumbJsonLd(crumbs), list]} />
    </>
  );
}
