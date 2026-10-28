import Link from 'next/link';
import { Flame, ShieldCheck, Tag } from 'lucide-react';
import { pageMeta, breadcrumbJsonLd } from '@/lib/seo';
import { absUrl } from '@/lib/config';
import { PageHead } from '@/components/Prose';
import JsonLd from '@/components/JsonLd';
import DealsClient from '@/components/DealsClient';
import Countdown from '@/components/Countdown';
import ShareButtons from '@/components/ShareButtons';
import CountUp from '@/components/CountUp';
import AdsInject from '@/components/AdsInject';
import { dealsRemote } from '@/lib/catalogQuery';
import { getDealsConfig } from '@/lib/dealsServer';

export const revalidate = 600;
export const metadata = pageMeta({
  title: 'Deals: biggest discounts in Pakistan, cash on delivery',
  description: 'All Mizanora deals in one link: real discounts on fashion, footwear, gadgets, home items and more. Old price crossed out, pay cash on delivery anywhere in Pakistan.',
  path: '/deals',
});

export default async function DealsPage() {
  const cfg = await getDealsConfig();
  if (!cfg.enabled) {
    return (
      <>
        <PageHead title={cfg.title} intro="Deals abhi band hain. Jald wapas aayengi." crumbs={[['/', 'Home'], [null, 'Deals']]} />
        <div className="mx-auto max-w-3xl px-4 py-10 text-center"><Link href="/products" className="btn-gold">Shop all products</Link></div>
      </>
    );
  }
  let first = { items: [], next: '', total: 0, chips: [], maxPct: 0 };
  try { first = await dealsRemote({ minPct: cfg.minPct, sort: 'pct', size: 48, pinned: cfg.pinned }); } catch (e) { console.error('deals page:', e.message); }
  const crumbs = [['/', 'Home'], ['/deals', 'Deals']];
  const list = {
    '@context': 'https://schema.org', '@type': 'ItemList', name: cfg.title,
    itemListElement: first.items.slice(0, 50).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: absUrl(`/product/${p.slug}`), name: p.name })),
  };
  const live = cfg.endsAtMs > Date.now();
  return (
    <>
      <PageHead title={cfg.title} intro={cfg.subtitle} crumbs={[['/', 'Home'], [null, 'Deals']]} />
      <div className="mx-auto max-w-7xl px-3 py-6 sm:px-4">
        <section className="mz-deal-hero relative overflow-hidden rounded-3xl p-5 text-white sm:p-8" aria-label="Deals summary">
          <span className="mz-deal-glow" aria-hidden="true" />
          <div className="relative flex flex-wrap items-center gap-x-8 gap-y-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-extrabold uppercase tracking-wide"><Flame size={14} /> {cfg.badge || 'Deals'}</span>
              <p className="mt-2 font-display text-3xl font-extrabold leading-tight sm:text-5xl">Up to <CountUp to={first.maxPct || 0} />% off</p>
              <p className="mt-1 text-sm text-white/85">{first.total} products with a real lower price. Cash on delivery across Pakistan.</p>
            </div>
            <ul className="ml-auto flex flex-wrap gap-2 text-sm font-bold">
              <li className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5"><Tag size={15} /> Old price shown</li>
              <li className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5"><ShieldCheck size={15} /> Honest dealing</li>
            </ul>
          </div>
          {live && <div className="relative mt-4"><Countdown endsMs={cfg.endsAtMs} /></div>}
        </section>

        <div className="mt-2"><ShareButtons url={absUrl('/deals')} title="Mizanora Deals" label="Share this deals link: one link, all deals" /></div>

        {/* v31: a video ad slot on the deals page (shop's own ads, key=self) */}
        <AdsInject slots={['video']} />

        <DealsClient initial={first} baseMin={cfg.minPct} />
      </div>
      <JsonLd data={[breadcrumbJsonLd(crumbs), list]} />
    </>
  );
}
