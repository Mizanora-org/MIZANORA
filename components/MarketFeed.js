import Link from 'next/link';
import { Tv, Wrench, ArrowRight } from 'lucide-react';
import ProductCard from '@/components/ProductCard';
import FeedFilter from '@/components/FeedFilter';
import { KIND_COLOR, KIND_LABEL } from '@/lib/islamic';

// The home "Mizanora Feed": products, Islamic posts, live TV channels and free tools in one scrolling feed (see lib/marketFeed.js).
// Server markup, except the small tab bar. Cards sit in CSS columns so tall and short cards fit together like a social feed.
export default function MarketFeed({ feed }) {
  if (!feed || !feed.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-3 pt-8 sm:px-4" aria-labelledby="mz-feed-title">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-wider text-gold">Aaj ka feed</p><h2 id="mz-feed-title" className="section-title">Mizanora Feed</h2></div>
        <Link href="/search" className="flex items-center gap-1 whitespace-nowrap text-sm font-bold text-gold">Search everything <ArrowRight size={15} /></Link>
      </div>
      <FeedFilter>
        {feed.map(({ kind, item }, i) => (
          <div key={`${kind}-${i}`} data-kind={kind} className="mz-feed-item mb-2.5 break-inside-avoid sm:mb-3">
            {kind === 'product' && <ProductCard p={item} priority={i < 2} />}
            {kind === 'islamic' && (
              <article className="rounded-2xl border border-gold/25 bg-gradient-to-br from-[#F4F8F1] via-white to-[#EAF4EE] p-4">
                <span className={`mb-2 inline-block rounded-full px-2.5 py-0.5 text-[0.68rem] font-extrabold text-white ${KIND_COLOR[item.kind] || 'bg-emerald-600'}`}>{KIND_LABEL[item.kind] || 'Yaad-dehani'}</span>
                {item.ar && <p lang="ar" dir="rtl" className="font-arabic text-xl leading-[2] text-cream">{item.ar}</p>}
                <p className="mt-1 text-sm text-dim">{item.ur}</p>
                <p className="mt-2 text-xs font-semibold text-faint">{item.ref}</p>
                <Link href="/islamic" className="mt-2 inline-block text-xs font-bold text-gold">Aur Islami posts</Link>
              </article>
            )}
            {kind === 'tv' && (
              <Link href={`/live/${item.slug}`} prefetch={false} className="block overflow-hidden rounded-2xl bg-gradient-to-br from-[#7f1111] to-[#2a0707] p-4 text-white transition hover:-translate-y-0.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />LIVE</span>
                <div className="mt-3 flex items-center gap-3">
                  {item.logo ? <img src={item.logo} alt="" className="h-12 w-12 shrink-0 rounded-xl bg-white object-contain p-0.5" loading="lazy" referrerPolicy="no-referrer" /> : <Tv size={28} className="shrink-0 text-[#F5B83D]" aria-hidden="true" />}
                  <div className="min-w-0"><p className="line-clamp-2 font-extrabold leading-tight">{item.name}</p><p className="text-xs text-white/65">{item.group || 'Live channel'}</p></div>
                </div>
                <span className="mt-3 inline-block rounded-full bg-white px-4 py-1.5 text-xs font-extrabold text-[#7f1111]">Abhi dekhein</span>
              </Link>
            )}
            {kind === 'tool' && (
              <Link href={`/tools/${item.slug}`} className="block rounded-2xl border border-line bg-surface p-4 transition hover:-translate-y-0.5 hover:border-gold">
                <span className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-2.5 py-0.5 text-[0.68rem] font-extrabold text-gold"><Wrench size={11} /> Free tool</span>
                <h3 className="mt-2 font-extrabold leading-snug">{item.title}</h3>
                <p className="mt-1 line-clamp-3 text-sm text-dim">{item.short}</p>
                <span className="mt-2 inline-block text-xs font-bold text-gold">Kholein</span>
              </Link>
            )}
            {kind === 'muaaz' && (
              <Link href="/muaaz-iqbal" prefetch={false} className="block overflow-hidden rounded-2xl border border-gold/25 bg-surface p-3 transition hover:-translate-y-0.5 hover:border-gold">
                <div className="overflow-hidden rounded-xl bg-raised">
                  {item.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt={item.title || 'Muaaz Iqbal'} loading="lazy" referrerPolicy="no-referrer" className="h-32 w-full object-cover sm:h-40" />
                  ) : <div className="grid h-32 place-items-center font-display text-3xl text-bronze sm:h-40">MI</div>}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold/10 px-2 py-0.5 text-[0.62rem] font-extrabold text-gold">Muaaz Iqbal</span>
                  <p className="line-clamp-1 text-sm font-bold">{item.title || 'Muaaz Iqbal ki photo'}</p>
                </div>
                {item.caption && <p className="mt-1 line-clamp-2 text-xs text-dim">{item.caption}</p>}
              </Link>
            )}
          </div>
        ))}
      </FeedFilter>
    </section>
  );
}
