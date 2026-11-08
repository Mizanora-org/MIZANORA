import Link from 'next/link';
import { BookOpen, Clapperboard, ScrollText, Tv, Wrench, ArrowRight } from 'lucide-react';
import Reveal from '@/components/Reveal';
import { TOOLS } from '@/lib/tools';
import { tvSlug } from '@/lib/liveTv';
import LiveBadge from '@/components/LiveBadge';

// The home page "hub" (v25/v50): five big doors (Quran, Hadith, Live TV, Movies & Series, Tools), a strip of live channels and the most used tools.
// Everything is plain server markup: no extra JavaScript is sent to the visitor.
const FEATURED = ['zakat-calculator', 'linux-commands-cheat-sheet', 'unit-converter', 'percentage-calculator', 'loan-emi-calculator', 'qibla-direction', 'json-formatter-validator', 'keyword-generator'];

export default function HomeHub({ tv }) {
  // Scan once for the active count; build stable slugs only until the first 18 visible
  // channels. A 100k-channel archive must not allocate 100k link objects on the home page.
  const seen = new Map(), chans = [];
  let activeCount = 0;
  for (const [i, c] of (tv?.enabled ? tv.channels : []).entries()) {
    if (!c.off) activeCount++;
    if (chans.length >= 18) continue;
    const base = tvSlug(c.name) || `channel-${i + 1}`;
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    if (!c.off) chans.push({ c, slug: n === 1 ? base : `${base}-${n}` });
  }
  const feat = FEATURED.map((s) => TOOLS.find((t) => t.slug === s)).filter(Boolean);
  const doors = [
    { href: '/quran', Icon: BookOpen, title: 'Quran', sub: 'Read, listen, Urdu translation', bg: 'from-[#0B6B45] to-[#06402a]' },
    { href: '/hadith', Icon: ScrollText, title: 'Hadith', sub: 'Bukhari, Muslim and 7 more books', bg: 'from-[#1E3A5F] to-[#0F2440]' },
    { href: '/live', Icon: Tv, title: 'Live TV', sub: activeCount ? `${activeCount} channels, switch with one tap` : 'Channels coming soon', bg: 'from-[#B91C1C] to-[#5f0f0f]' },
    { href: '/movies', Icon: Clapperboard, title: 'Movies & Series', sub: 'Trailers, cast, calendar & legal films', bg: 'from-[#4C1D95] to-[#1E1B4B]' },
    { href: '/tools', Icon: Wrench, title: 'Free tools', sub: `${TOOLS.length} tools: zakat, linux, calculators`, bg: 'from-[#F29F05] to-[#B45309]' },
  ];
  return (
    <>
      <Reveal><section className="mx-auto max-w-7xl px-3 pt-6 sm:px-4" aria-label="Mizanora explore">
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          {doors.map(({ href, Icon, title, sub, bg }) => (
            <li key={href}><Link href={href} className={`group relative block h-full overflow-hidden rounded-3xl bg-gradient-to-br ${bg} p-4 text-white shadow-lg transition hover:-translate-y-1 sm:p-5`}>
              <Icon size={64} className="absolute -bottom-3 -right-3 opacity-15 transition group-hover:scale-110" aria-hidden="true" />
              <Icon size={26} aria-hidden="true" />
              <h2 className="mt-3 font-display text-xl font-extrabold sm:text-2xl">{title}</h2>
              {href === '/live' && chans.length > 0 && <span className="mb-1 mt-1.5 block"><LiveBadge state="live" label={`${activeCount} on air`} size="xs" /></span>}
              <p className="mt-1 text-xs text-white/85 sm:text-sm">{sub}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#F5B83D]">Open <ArrowRight size={13} /></span>
            </Link></li>
          ))}
        </ul>
      </section></Reveal>

      {chans.length > 0 && (
        <Reveal><section className="mx-auto max-w-7xl px-3 pt-8 sm:px-4" aria-labelledby="hub-tv">
          <div className="mb-3 flex items-end justify-between gap-4"><div><p className="flex items-center gap-2"><LiveBadge state="live" label="Live now" /><span className="text-xs font-bold uppercase tracking-wider text-red-600">{activeCount} channels on air</span></p><h2 id="hub-tv" className="section-title">Live TV channels</h2></div><Link href="/live" className="flex items-center gap-1 whitespace-nowrap text-sm font-bold text-gold">All channels <ArrowRight size={15} /></Link></div>
          <ul className="no-sb -mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-2">
            {chans.map(({ c, slug }) => (
              <li key={slug} className="shrink-0 snap-start"><Link href={`/live/${slug}`} prefetch={false} className="flex w-36 flex-col items-center gap-2 rounded-2xl border border-line bg-surface p-3 text-center transition hover:border-gold sm:w-40">
                {c.logo ? <img src={c.logo} alt="" className="h-14 w-14 rounded-xl bg-white object-contain" loading="lazy" referrerPolicy="no-referrer" /> : <span className="grid h-14 w-14 place-items-center rounded-xl bg-raised font-bold text-gold">TV</span>}
                <span className="line-clamp-2 text-sm font-bold leading-tight">{c.name}</span><LiveBadge state="live" label="LIVE" size="xs" />
              </Link></li>
            ))}
          </ul>
        </section></Reveal>
      )}

      <Reveal><section className="mx-auto max-w-7xl px-3 pt-8 sm:px-4" aria-labelledby="hub-tools">
        <div className="mb-3 flex items-end justify-between gap-4"><h2 id="hub-tools" className="section-title">Popular free tools</h2><Link href="/tools" className="flex items-center gap-1 whitespace-nowrap text-sm font-bold text-gold">All {TOOLS.length} tools <ArrowRight size={15} /></Link></div>
        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {feat.map((t) => <li key={t.slug}><Link href={`/tools/${t.slug}`} className="card card-gold block h-full transition hover:-translate-y-0.5 hover:border-gold"><h3 className="font-extrabold leading-snug">{t.title}</h3><p className="mt-1 line-clamp-2 text-sm text-dim">{t.short}</p></Link></li>)}
        </ul>
      </section></Reveal>
    </>
  );
}
