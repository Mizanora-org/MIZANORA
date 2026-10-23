import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getShopAll } from '@/lib/products';
import ProductCard from '@/components/ProductCard';

// A strip of the shop's own products (photo or video cards) that can sit under ANY page: tools, Live TV, Quran, Hadith, blog.
// `seed` makes each page show a different part of the catalogue, so the strips do not look the same everywhere. Products only come from the shop,
// the price is read from the shop, so the ad can never show a wrong price. Renders nothing if the shop has no products.
const hash = (s) => [...String(s || 'x')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
export default async function ProductAds({ seed = 'x', title = 'Shop on Mizanora', note = 'Cash on delivery across Pakistan', count = 8, href = '/products' }) {
  let all = [];
  try { all = await getShopAll(); } catch { return null; }
  const ok = all.filter((p) => p && p.inStock !== false && p.price > 0 && ((p.images && p.images[0]) || p.image));
  if (!ok.length) return null;
  const start = hash(seed) % ok.length;
  const items = Array.from({ length: Math.min(count, ok.length) }, (_, i) => ok[(start + i * 3) % ok.length]).filter((p, i, a) => a.findIndex((x) => x.id === p.id) === i);
  return (
    <section className="mx-auto max-w-6xl px-3 pt-10 sm:px-4" aria-label="Products from Mizanora">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-wider text-saffron">Mizanora store</p><h2 className="section-title">{title}</h2><p className="text-sm text-dim">{note}</p></div>
        <Link href={href} className="flex items-center gap-1 whitespace-nowrap text-sm font-bold text-gold">View all <ArrowRight size={15} /></Link>
      </div>
      <div className="no-sb -mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-2 md:mx-0 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:px-0">
        {items.map((p) => <div key={p.id} className="w-44 shrink-0 snap-start md:w-auto"><ProductCard p={p} /></div>)}
      </div>
    </section>
  );
}
