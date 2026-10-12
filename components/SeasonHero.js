import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { seasonFor } from '@/lib/season';
import HijriChip from './HijriChip';

const STARS = [[8, 14, 10], [18, 62, 7], [27, 28, 12], [38, 78, 8], [47, 18, 9], [58, 55, 11], [66, 12, 7], [74, 70, 10], [84, 30, 8], [92, 60, 12], [14, 85, 9], [52, 88, 7]];

function Lantern({ side }) {
  return (
    <div className={`mz-lantern absolute top-0 ${side === 'l' ? 'left-[7%]' : 'right-[9%] hidden sm:block'}`} style={{ animationDelay: side === 'l' ? '0s' : '-2.2s' }} aria-hidden="true">
      <span className="mx-auto block h-10 w-px bg-[#F2D27A]/70 sm:h-14" />
      <svg width="40" height="64" viewBox="0 0 40 64" className="-mt-px">
        <path d="M20 2v6M13 8h14l-3 6H16z" fill="#F2B84B" />
        <path d="M11 14h18c4 8 4 20 0 28H11C7 34 7 22 11 14z" fill="#F29F05" fillOpacity=".9" stroke="#FDE68A" strokeWidth="1.2" />
        <path d="M20 14v28M14 15c-2 9-2 18 0 27M26 15c2 9 2 18 0 27" stroke="#7A3B05" strokeOpacity=".55" strokeWidth="1" fill="none" />
        <ellipse cx="20" cy="28" rx="5" ry="8" fill="#FFF3C4" />
        <path d="M11 42h18l-2 6H13z" fill="#F2B84B" /><circle cx="20" cy="52" r="2.2" fill="#F2B84B" />
      </svg>
    </div>
  );
}

// The seasonal + Islamic welcome banner at the top of the home page.
export default function SeasonHero({ hasPicks = false }) {
  const s = seasonFor();
  if (!s) return null;
  return (
    <section className="mx-auto max-w-7xl px-3 pt-3 sm:px-4 sm:pt-4" aria-label={`${s.urdu} collection`}>
      <div className={`mz-hero-bg relative isolate overflow-hidden rounded-3xl bg-gradient-to-br ${s.hero} px-5 pb-9 pt-14 text-white shadow-[0_20px_50px_-20px_rgba(0,0,0,.55)] sm:px-10 sm:pb-12 sm:pt-16`}>
        <div className="mz-geo-light absolute inset-0 -z-10 opacity-60" aria-hidden="true" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_70%_20%,rgba(255,214,120,.28),transparent_60%)]" aria-hidden="true" />

        {STARS.map(([x, y, sz], i) => (
          <span key={i} aria-hidden="true" className="mz-star absolute -z-10 text-[#FFE9A8]" style={{ left: `${x}%`, top: `${y}%`, fontSize: sz, animationDelay: `${(i % 6) * 0.55}s` }}>✦</span>
        ))}
        <svg className="mz-moon absolute right-5 top-5 sm:right-24 sm:top-7" width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
          <path d="M42 8a24 24 0 1 0 14 38A20 20 0 0 1 42 8z" fill="#FFE9A8" />
          <path d="M50 14l1.8 3.7 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6z" fill="#FFE9A8" />
        </svg>
        <Lantern side="l" />
        <Lantern side="r" />

        <div className="relative mx-auto max-w-2xl text-center">
          <HijriChip className="mz-rise justify-center" />
          <p className="font-arabic mz-rise mt-3 text-3xl leading-[1.9] text-[#FFE9A8] sm:text-4xl" style={{ animationDelay: '.15s' }} lang="ar" dir="rtl">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</p>
          <p className="mz-rise mt-1 text-xs font-bold uppercase tracking-[0.25em] text-saffron" style={{ animationDelay: '.3s' }}>{s.kicker}</p>
          <h2 className="mz-rise mt-2 font-display text-3xl font-extrabold leading-tight sm:text-5xl" style={{ animationDelay: '.45s' }}>{s.title}</h2>
          <p className="mz-rise mx-auto mt-3 max-w-xl text-sm text-white/85 sm:text-base" style={{ animationDelay: '.6s' }}>{s.subtitle}</p>
          <div className="mz-rise mt-6 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: '.75s' }}>
            <a href={hasPicks ? '#season-picks' : '/products'} className="btn-sun"><Sparkles size={18} /> {s.urdu} picks dekhein</a>
            <Link href="/products" className="inline-flex items-center gap-2 rounded-full border border-white/50 px-6 py-3.5 text-[0.95rem] font-semibold text-white transition hover:bg-white/10">Sab products <ArrowRight size={16} /></Link>
          </div>
        </div>
      </div>
    </section>
  );
}
