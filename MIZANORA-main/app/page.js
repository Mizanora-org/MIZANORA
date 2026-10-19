import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheck, Truck, Headphones, Banknote, Footprints, Shirt, Gem, Baby, Smartphone, Cpu, Home as HomeIcon, Sparkles, Dumbbell, HeartPulse, ShoppingBasket, Car, ArrowRight } from 'lucide-react';
import { SITE } from '@/lib/config';
import { getShopAll, getBanners, getReels, getCategories, getTotalCount } from '@/lib/products';
import { getReelMusic } from '@/lib/reelMusicServer';
import { getPosts } from '@/lib/blog';
import { FAQ } from '@/lib/faq';
import { pageMeta, faqJsonLd } from '@/lib/seo';
import { discountPct, formatPKR } from '@/lib/format';
import ProductCard from '@/components/ProductCard';
import BannerCarousel from '@/components/BannerCarousel';
import ReorderBanner from '@/components/ReorderBanner';
import Marquee from '@/components/Marquee';
import SignInStrip from '@/components/SignInStrip';
import RecentlyViewed from '@/components/RecentlyViewed';
import ReelsRail from '@/components/ReelsRail';
import CountUp from '@/components/CountUp';
import AskAssistant from '@/components/AskAssistant';
import { getPublicAssistant } from '@/lib/assistantPublic';
import Reveal from '@/components/Reveal';
import SeasonHero from '@/components/SeasonHero';
import DailyReminder from '@/components/DailyReminder';
import IslamicFeed from '@/components/IslamicFeed';
import { getFeedPosts } from '@/lib/feedPosts';
import { seasonFor, matchesSeason } from '@/lib/season';
import { getThemeMode } from '@/lib/themeServer';
import { inCategory } from '@/lib/cats';
import { DEPARTMENTS } from '@/lib/departments';
import JsonLd from '@/components/JsonLd';
import ForYouShelf from '@/components/ForYouShelf';
import { SOCIAL_ICONS } from '@/components/Icons';

export const revalidate = 1800; // data comes from the shared cache; the admin panel refreshes pages instantly

export const metadata = pageMeta({
  title: { absolute: 'Mizanora | Online Market in Pakistan: Shop Fashion, Footwear, Gadgets & More, Cash on Delivery' },
  description: 'Mizanora is an online market in Pakistan. Shop footwear, fashion, mobile accessories, home items and more with cash on delivery. Read shopping guides. Shop smart. Shop halal.',
  path: '/',
});

const DEPT_ICONS = [Footprints, Shirt, Gem, Baby, Smartphone, Cpu, HomeIcon, Sparkles, Dumbbell, HeartPulse, ShoppingBasket, Car];

const DEFAULT_SLIDES = [
  { id: 'd1', kicker: 'Mizanora market', title: 'Everything you need, one trusted market', subtitle: 'Fashion, footwear, gadgets, home and more. Pay cash on delivery.', link: '/products', cta: 'Start shopping', bg: 'bg-gradient-to-br from-[#0B6B45] via-[#0E8556] to-[#073D28]' },
  { id: 'd2', kicker: 'Pay on delivery', title: 'See it. Receive it. Then pay.', subtitle: 'Cash on delivery across Pakistan. No account needed.', link: '/how-to-order', cta: 'How to order', bg: 'bg-gradient-to-br from-[#F29F05] via-[#E8860A] to-[#B45309]' },
  { id: 'd3', kicker: 'Shopping blog', title: 'Shop smarter with our guides', subtitle: 'Safe buying, size help, price checks and Eid shopping tips.', link: '/blog', cta: 'Read guides', bg: 'bg-gradient-to-br from-[#1E3A5F] via-[#27507F] to-[#0F2440]' },
];

// Horizontal swipe row on phones (like an app), grid on large screens.
function Shelf({ id, title, href, products, priorityFirst = false, tone = '', anchor }) {
  if (!products.length) return null;
  return (
    <Reveal><section id={anchor} className="mx-auto max-w-7xl scroll-mt-20 px-3 pt-8 sm:px-4" aria-labelledby={id}>
      <div className={`rounded-2xl ${tone}`}>
        <div className="mb-3 flex items-end justify-between gap-4">
          <h2 id={id} className="section-title">{title}</h2>
          {href && <Link href={href} className="flex items-center gap-1 whitespace-nowrap text-sm font-bold text-gold">View all <ArrowRight size={15} /></Link>}
        </div>
        <div className="no-sb -mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-2 md:mx-0 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:px-0 lg:grid-cols-5">
          {products.map((p, i) => <div key={p.id} className="w-[44vw] max-w-[200px] shrink-0 snap-start md:w-auto md:max-w-none"><ProductCard p={p} priority={priorityFirst && i < 3} /></div>)}
        </div>
      </div>
    </section></Reveal>
  );
}

export default async function Home() {
  // THE WHOLE CATALOGUE: live products + the archived products that live as JSON files in the repository.
  // A shop can keep EVERY product in those files (CSV import -> data/catalog) and still fill this home page,
  // with no Firestore writes and no Firestore reads for visitors.
  const [all, banners, reels, categories, totalCount, reelMusic, feedPosts] = await Promise.all([getShopAll(), getBanners(), getReels(), getCategories(), getTotalCount(), getReelMusic(), getFeedPosts()]);
  const byPrice = (a, b) => a.price - b.price;
  const deals = all.filter((p) => discountPct(p.price, p.comparePrice) > 0)
    .sort((a, b) => discountPct(b.price, b.comparePrice) - discountPct(a.price, a.comparePrice)).slice(0, 10);
  const picks = all.filter((p) => p.featured).slice(0, 10);
  const fresh = all.slice(0, 12);
  // The 8 biggest categories get their own shelf (all categories stay one tap away in the circles above). Fewer cards = a lighter, smoother home page.
  const shelves = categories.slice(0, 8).map((c) => ({ c, items: all.filter((p) => inCategory(p, c.name)).sort(byPrice).slice(0, 8) }));
  // CHEAPEST FIRST: every category shelf starts with its cheapest products, and one shelf shows the cheapest item of EVERY category.
  const inStockAll = all.filter((p) => p.inStock !== false && p.price > 0);
  const budget = categories.map((c) => inStockAll.filter((p) => inCategory(p, c.name)).sort(byPrice)[0]).filter(Boolean)
    .filter((p, i, a) => a.findIndex((x) => x.id === p.id) === i).sort(byPrice).slice(0, 16);
  const cheapest = inStockAll.length ? Math.min(...inStockAll.map((p) => p.price)) : 0;
  const assistant = await getPublicAssistant();
  const themeMode = await getThemeMode();
  const season = seasonFor(new Date(), themeMode);
  const seasonPicks = season ? all.filter((p) => matchesSeason(p, season)).slice(0, 10) : [];
  const posts = getPosts().slice(0, 4);
  const socials = SITE.social.filter((s) => s.url);
  const delivery = SITE.shippingFee > 0 ? `Delivery ${formatPKR(SITE.shippingFee)}` : 'Free delivery';

  // Moving "Trending now" strip: featured first, then newest. Repeated so a small catalog still fills the strip.
  const trendBase = [...picks, ...all.filter((p) => !p.featured)].slice(0, 14);
  const trend = trendBase.length && trendBase.length < 8 ? Array.from({ length: Math.ceil(8 / trendBase.length) }, () => trendBase).flat() : trendBase;

  // Circles: real categories first, then starter departments that have no products yet.
  const have = new Set(categories.map((c) => c.slug));
  const circles = [
    ...categories.map((c) => ({ ...c, real: true })),
    ...DEPARTMENTS.map((d, i) => ({ ...d, Icon: DEPT_ICONS[i], count: 0, real: false })).filter((d) => !have.has(d.slug)),
  ];

  return (
    <>
      <SeasonHero hasPicks={seasonPicks.length > 0} mode={themeMode} />
      <div className="mx-auto max-w-7xl px-3 pt-3 sm:px-4 sm:pt-4">
        <BannerCarousel banners={banners.length > 0 ? banners : DEFAULT_SLIDES} />
        <h1 className="sr-only">Mizanora: online shopping market in Pakistan with cash on delivery</h1>
      </div>

      <ReorderBanner />
      <SignInStrip />

      <section className="mx-auto max-w-7xl px-3 pt-4 sm:px-4" aria-label="Why shop with us">
        <ul className="no-sb flex gap-2.5 overflow-x-auto lg:grid lg:grid-cols-4">
          {[[Banknote, 'Cash on delivery', 'Pay when you receive'], [Truck, delivery, 'Across Pakistan'], [Headphones, 'WhatsApp support', 'Help when you need it'], [ShieldCheck, 'Honest dealing', 'Price shown upfront']].map(([Icon, t, s]) => (
            <li key={t} className="flex min-w-[58%] shrink-0 items-center gap-3 rounded-xl border border-line bg-surface p-3 sm:min-w-[40%] lg:min-w-0">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold/10 text-gold"><Icon size={22} /></span>
              <div><p className="text-sm font-bold text-cream">{t}</p><p className="text-xs text-dim">{s}</p></div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-7xl px-3 pt-4 sm:px-4" aria-label="Shop numbers">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl bg-gradient-to-r from-[#0B6B45] to-[#0E8556] p-4 text-white">
          <p className="min-w-[8rem]"><span className="block font-display text-3xl font-extrabold leading-none"><CountUp to={totalCount || all.length} />+</span><span className="text-xs text-white/85">products in stock to order</span></p>
          <p><span className="block font-display text-3xl font-extrabold leading-none"><CountUp to={categories.length} /></span><span className="text-xs text-white/85">categories</span></p>
          {cheapest > 0 && <p><span className="block font-display text-3xl font-extrabold leading-none">Rs <CountUp to={cheapest} /></span><span className="text-xs text-white/85">prices start from</span></p>}
          <div className="ml-auto flex flex-wrap gap-2">
            {assistant.enabled && <AskAssistant name={assistant.name} q="Sab se sasti deals dikhao" className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-bold text-[#0B6B45] active:scale-95">Ask {assistant.name} for deals</AskAssistant>}
          </div>
        </div>
        <ul className="no-sb mt-3 flex gap-2 overflow-x-auto" aria-label="Shop by budget">
          {[500, 1000, 2000, 5000].map((n) => <li key={n} className="shrink-0"><Link href={`/products?max=${n}`} className="block rounded-full border border-gold bg-surface px-4 py-1.5 text-sm font-bold text-gold active:bg-gold/10">Under Rs {n}</Link></li>)}
        </ul>
      </section>

      <Shelf id="budget" anchor="sasti" title="Sab se sasti: har category se" href="/products" products={budget} tone="bg-gold/5 p-3 sm:p-4" />

      {/* Aap ke liye: built from what THIS shopper talked about with the assistant (stored on their device, no tracking) */}
      <ForYouShelf assistant={assistant} />

      <Reveal><section className="mx-auto max-w-7xl px-3 pt-8 sm:px-4" aria-labelledby="cats">
        <h2 id="cats" className="section-title mb-3">Shop by category</h2>
        <ul className="no-sb flex gap-3 overflow-x-auto pb-2">
          {circles.map((c) => (
            <li key={c.slug} className="shrink-0">
              <Link href={`/category/${c.slug}`} className="block w-[5.2rem] text-center sm:w-28">
                <span className={`relative mx-auto grid h-[4.4rem] w-[4.4rem] place-items-center overflow-hidden rounded-full border-2 sm:h-24 sm:w-24 ${c.real ? 'border-gold bg-raised' : 'border-line bg-surface text-gold'}`}>
                  {c.image ? <Image src={c.image} alt="" fill sizes="96px" className="object-cover" /> : c.Icon ? <c.Icon size={30} /> : <span className="font-display text-3xl text-gold">{c.name[0]}</span>}
                </span>
                <span className="mt-1.5 block text-xs font-semibold leading-tight text-cream sm:text-sm">{c.name}</span>
                {c.real && <span className="block text-[0.7rem] text-faint">{c.count} item{c.count > 1 ? 's' : ''}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </section></Reveal>

      {season && <Shelf id="season" anchor="season-picks" title={season.picksTitle} href="/products" products={seasonPicks} tone={season.tone} />}

      <Shelf id="deals" title="Hot deals" href="/products" products={deals} priorityFirst tone="bg-red-50 p-3 sm:p-4" />

      {trend.length > 0 && (
        <Reveal><section className="mx-auto max-w-7xl px-3 pt-8 sm:px-4" aria-labelledby="trend">
          <div className="mb-3 flex items-end justify-between"><h2 id="trend" className="section-title">Trending now</h2><Link href="/products" className="flex items-center gap-1 text-sm font-bold text-gold">See all <ArrowRight size={15} /></Link></div>
          <Marquee seconds={Math.max(30, trend.length * 5)} label="Trending products" className="rounded-2xl">
            {trend.map((p, i) => <div key={`${p.id}-${i}`} className="w-44 shrink-0 px-1.5 sm:w-52"><ProductCard p={p} /></div>)}
          </Marquee>
        </section></Reveal>
      )}

      {reels.length > 0 && (
        <Reveal><section className="mx-auto max-w-7xl px-3 pt-8 sm:px-4" aria-labelledby="reels">
          <div className="mb-3 flex items-end justify-between"><h2 id="reels" className="section-title">Reels: watch and shop</h2><Link href="/reels" className="flex items-center gap-1 text-sm font-bold text-gold">All reels <ArrowRight size={15} /></Link></div>
          <ReelsRail reels={reels.slice(0, 12)} music={reelMusic} />
        </section></Reveal>
      )}

      <Reveal><IslamicFeed extra={feedPosts} winter={season ? season.id === 'winter' : false} /></Reveal>

      <Shelf id="picks" title="Top picks for you" href="/products" products={picks} />
      <Shelf id="new" title="New arrivals" href="/products" products={fresh} priorityFirst={deals.length === 0 && picks.length === 0} />
      {shelves.map(({ c, items }) => <Shelf key={c.slug} id={`cat-${c.slug}`} title={c.name} href={`/category/${c.slug}`} products={items} />)}

      <div className="mx-auto max-w-7xl px-3 sm:px-4"><RecentlyViewed /></div>

      {all.length === 0 && (
        <section className="mx-auto max-w-3xl px-4 pt-10">
          <div className="card text-center"><p className="text-dim">New products are being added. Please check back soon.</p>
            <Link href="/contact" className="btn-ghost mt-4">Contact support</Link></div>
        </section>
      )}

      <Reveal><section className="mx-auto max-w-7xl px-3 pt-14 sm:px-4" aria-labelledby="how">
        <h2 id="how" className="section-title mb-4">Ordering takes one minute</h2>
        <ol className="grid gap-3 md:grid-cols-3">
          {[['Choose', 'Pick your product and size.'], ['Fill the form', 'Name, mobile number and address. No account needed.'], ['Pay on delivery', 'We confirm your order, then the rider brings it to your door.']].map(([t, s], i) => (
            <li key={t} className="card flex gap-4"><span className="font-display text-4xl font-extrabold text-saffron">{i + 1}</span><div><p className="font-semibold">{t}</p><p className="text-sm text-dim">{s}</p></div></li>
          ))}
        </ol>
      </section></Reveal>

      <Reveal><section className="mx-auto max-w-7xl px-3 pt-14 sm:px-4" aria-labelledby="guides">
        <div className="mb-4 flex items-end justify-between"><h2 id="guides" className="section-title">Shopping guides and tips</h2><Link href="/blog" className="flex items-center gap-1 text-sm font-bold text-gold">All guides <ArrowRight size={15} /></Link></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {posts.map((p) => (
            <article key={p.slug} className="card">
              <h3 className="text-lg font-bold leading-snug"><Link href={`/blog/${p.slug}`}>{p.title}</Link></h3>
              <p className="mt-2 line-clamp-3 text-sm text-dim">{p.description}</p>
              <Link href={`/blog/${p.slug}`} className="mt-3 inline-block text-sm font-semibold text-gold">Read the guide ({p.mins} min)</Link>
            </article>
          ))}
        </div>
      </section></Reveal>

      <Reveal><section className="mx-auto max-w-7xl px-3 pt-14 sm:px-4" aria-labelledby="soc">
        <h2 id="soc" className="section-title mb-4">Find Mizanora everywhere</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {socials.map((s) => {
            const Icon = SOCIAL_ICONS[s.id];
            return (
              <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4 hover:border-gold">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-raised text-gold"><Icon /></span>
                <span><b className="block">{s.label}</b><span className="text-sm text-dim">{s.note}</span></span>
              </a>
            );
          })}
        </div>
      </section></Reveal>

      <Reveal><DailyReminder /></Reveal>

      <Reveal><section className="mx-auto max-w-7xl px-3 pt-14 sm:px-4" aria-labelledby="earn">
        <div className="overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-[#0B6B45] via-[#0E8556] to-[#073D28] p-6 text-white shadow-xl sm:p-9">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wider">Earn with us</p>
              <h2 id="earn" className="mt-3 font-display text-2xl font-extrabold sm:text-3xl">Share products, earn 10% to 50% commission</h2>
              <p className="mt-2 text-white/90">No investment and no stock. You share a link, the customer pays cash on delivery, and your commission lands in your wallet after delivery. Built for Pakistan: JazzCash, Easypaisa and bank payouts.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/worker" className="btn-gold !py-2.5">Join as a worker</Link>
                <Link href="/team" className="btn-ghost !border-white/40 !py-2.5 !text-white">Meet the team &amp; workers</Link>
              </div>
            </div>
            <div className="grid shrink-0 grid-cols-2 gap-3 text-center text-white sm:w-64">
              {[['10%', 'Starting commission'], ['50%', 'Top level'], ['8 din', 'Delivery se wallet tak'], ['0 Rs', 'Joining fee']].map(([a, b]) => (
                <div key={b} className="rounded-2xl bg-white/10 p-3">
                  <p className="font-display text-xl font-extrabold">{a}</p>
                  <p className="text-[0.7rem] text-white/85">{b}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section></Reveal>

      <Reveal><section className="mx-auto max-w-3xl px-4 pt-14" aria-labelledby="faq">
        <h2 id="faq" className="section-title mb-4">Questions people ask</h2>
        {FAQ.slice(0, 6).map(([q, a]) => (
          <details key={q} className="mb-2.5 rounded-xl border border-line bg-surface px-4">
            <summary className="cursor-pointer py-3.5 font-semibold">{q}</summary>
            <p className="pb-4 text-dim">{a}</p>
          </details>
        ))}
        <Link href="/faq" className="mt-3 inline-block text-sm font-semibold text-gold">More answers</Link>
      </section></Reveal>
      <Reveal><section className="mx-auto max-w-4xl px-4 pt-14" aria-labelledby="about-mz">
        <h2 id="about-mz" className="section-title mb-3">Online shopping in Pakistan, made simple</h2>
        <div className="space-y-3 text-[0.98rem] leading-7 text-dim">
          <p>Mizanora is an online market for Pakistan. You can browse <Link href="/products" className="font-semibold text-gold underline underline-offset-4">all products</Link>, open a category, pick your size and order in about a minute. You pay in cash when the parcel reaches your door, so you never pay before you see what you ordered.</p>
          <p>New to buying online? Start with our <Link href="/blog/online-shopping-in-pakistan-beginners-guide" className="font-semibold text-gold underline underline-offset-4">beginner's guide to online shopping in Pakistan</Link>, learn <Link href="/blog/cash-on-delivery-pakistan" className="font-semibold text-gold underline underline-offset-4">how cash on delivery works</Link> and <Link href="/blog/how-to-spot-fake-online-shops-pakistan" className="font-semibold text-gold underline underline-offset-4">how to spot fake online shops</Link>.</p>
        </div>
      </section></Reveal>
      <JsonLd data={faqJsonLd(FAQ.slice(0, 6))} />
    </>
  );
}
