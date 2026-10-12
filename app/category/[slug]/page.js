import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { absUrl } from '@/lib/config';
import { DEPARTMENTS } from '@/lib/departments';
import { getProducts, buildCategories } from '@/lib/products';
import { inCategory } from '@/lib/cats';
import { pageMeta, breadcrumbJsonLd } from '@/lib/seo';
import { PageHead } from '@/components/Prose';
import ProductGrid from '@/components/ProductGrid';
import JsonLd from '@/components/JsonLd';

export const revalidate = 1800; // data comes from the shared cache; the admin panel refreshes pages instantly
export const dynamicParams = true;

export async function generateStaticParams() {
  return buildCategories(await getProducts()).map((c) => ({ slug: c.slug }));
}

async function load(params) {
  const { slug } = await params;
  const all = await getProducts();
  let cat = buildCategories(all).find((c) => c.slug === slug);
  let empty = false;
  if (!cat) {
    const d = DEPARTMENTS.find((x) => x.slug === slug);
    if (d) { cat = { name: d.name, slug: d.slug, count: 0, image: '' }; empty = true; }
  }
  return { cat, empty, items: cat && !empty ? all.filter((p) => inCategory(p, cat.name)) : [] };
}

export async function generateMetadata({ params }) {
  const { cat, empty } = await load(params);
  if (!cat) return { title: 'Category not found', robots: { index: false } };
  return pageMeta({
    title: `Buy ${cat.name} Online in Pakistan`,
    description: `Shop ${cat.name} online in Pakistan at Mizanora. ${cat.count} product${cat.count > 1 ? 's' : ''}, cash on delivery across Pakistan, honest prices.`,
    path: `/category/${cat.slug}`,
    image: cat.image || '/img/hero-banner.jpg',
    noindex: empty,
  });
}

export default async function CategoryPage({ params }) {
  const { cat, items, empty } = await load(params);
  if (!cat) notFound();
  const list = {
    '@context': 'https://schema.org', '@type': 'CollectionPage', name: cat.name, url: absUrl(`/category/${cat.slug}`),
    mainEntity: { '@type': 'ItemList', itemListElement: items.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: absUrl(`/product/${p.slug}`), name: p.name })) },
  };
  return (
    <>
      <PageHead title={cat.name} intro={empty ? 'New products are coming to this department soon.' : `${cat.count} product${cat.count > 1 ? 's' : ''}. Pay cash on delivery anywhere in Pakistan.`} crumbs={[['/', 'Home'], ['/products', 'Products'], [null, cat.name]]} />
      <div className="mx-auto max-w-7xl px-3 py-8 sm:px-4">
        {empty ? (
          <div className="card text-center"><p className="text-dim">We are adding {cat.name} products. Meanwhile, explore everything else in the market.</p><Link href="/products" className="btn-gold mt-4">Browse all products</Link></div>
        ) : <Suspense fallback={null}><ProductGrid products={items} /></Suspense>}
        <p className="mt-8 text-sm text-dim">Looking for something else? <Link href="/products" className="text-gold underline underline-offset-4">See all products</Link>.</p>
      </div>
      <JsonLd data={[list, breadcrumbJsonLd([['/', 'Home'], ['/products', 'Products'], [`/category/${cat.slug}`, cat.name]])]} />
    </>
  );
}
