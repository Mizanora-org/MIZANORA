import Link from 'next/link';
import { getShopAll } from '@/lib/products';
import { SEASONS, matchesSeason } from '@/lib/season';
import { pageMeta } from '@/lib/seo';
import { PageHead } from '@/components/Prose';
import ProductCard from '@/components/ProductCard';

export const revalidate = 1800;
export const metadata = pageMeta({ title: 'Winter collection: sardi ki shopping', description: 'Jackets, sweaters, shawls, boots and warm clothes for the Pakistani winter, with cash on delivery across Pakistan.', path: '/winter' });

export default async function Winter() {
  const all = await getShopAll();
  const s = SEASONS.winter;
  const picks = all.filter((p) => matchesSeason(p, s)).slice(0, 48);
  const cards = picks.map((p) => ({ id: p.id, slug: p.slug, name: p.name, price: p.price, comparePrice: p.comparePrice, images: (p.images || []).slice(0, 1), sizes: p.sizes || [], inStock: p.inStock, category: p.category, categories: p.categories }));
  return (
    <>
      <PageHead title="Winter collection" intro="Sardi aa gayi hai. Garam kapre, jackets, shawls aur boots, cash on delivery ke saath." crumbs={[['/', 'Home'], [null, 'Winter']]} />
      <div className="mx-auto max-w-7xl px-3 py-8 sm:px-4">
        {cards.length ? <div className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">{cards.map((p, i) => <ProductCard key={p.id} p={p} priority={i < 4} />)}</div> : <p className="text-dim">Winter products are coming soon. See all <Link href="/products" className="font-semibold text-gold underline underline-offset-4">products</Link>.</p>}
        <p className="mt-8 text-sm text-dim">Tips: read the <Link href="/blog/winter-collection-online-shopping-pakistan-2026" className="font-semibold text-gold underline underline-offset-4">winter shopping guide</Link>, the <Link href="/size-guide" className="font-semibold text-gold underline underline-offset-4">size guide</Link> and the <Link href="/shipping" className="font-semibold text-gold underline underline-offset-4">delivery page</Link>.</p>
      </div>
    </>
  );
}
