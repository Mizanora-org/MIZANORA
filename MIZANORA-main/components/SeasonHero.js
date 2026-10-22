import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { seasonFor } from '@/lib/season';
import HijriChip from './HijriChip';

// winter: [left %, delay s, fall seconds, drift px]
const SNOW = [[6, 0, 6, 14], [14, 1.2, 7, -10], [22, 2.4, 5.5, 12], [31, .6, 6.5, -14], [40, 3, 7.5, 10], [48, 1.8, 5.8, -8], [57, .3, 6.8, 14], [65, 2.2, 6.2, -12], [73, 1, 7.2, 8], [81, 3.4, 5.6, -10], [89, 1.5, 6.6, 12], [95, 2.8, 7, -6]];
const STARS = [[10, 20, 9], [24, 70, 7], [38, 25, 10], [55, 75, 8], [66, 18, 8], [80, 68, 10], [91, 40, 7]];

// A small hanging lantern (fanoos)
function Lantern({ className = '', delay = '0s' }) {
  return (
    <div className={`mz-lantern absolute top-0 ${className}`} style={{ animationDelay: delay }} aria-hidden="true">
      <span className="mx-auto block h-5 w-px bg-[#F2D27A]/70 sm:h-8" />
      <svg width="26" height="42" viewBox="0 0 40 64" className="-mt-px">
        <path d="M20 2v6M13 8h14l-3 6H16z" fill="#F2B84B" />
        <path d="M11 14h18c4 8 4 20 0 28H11C7 34 7 22 11 14z" fill="#F29F05" fillOpacity=".95" stroke="#FDE68A" strokeWidth="1.2" />
        <path d="M20 14v28M14 15c-2 9-2 18 0 27M26 15c2 9 2 18 0 27" stroke="#7A3B05" strokeOpacity=".55" strokeWidth="1" fill="none" />
        <ellipse cx="20" cy="28" rx="5" ry="8" fill="#FFF3C4" />
        <path d="M11 42h18l-2 6H13z" fill="#F2B84B" />
      </svg>
    </div>
  );
}

// Compact seasonal + Islamic welcome strip at the top of the home page.
export default function SeasonHero({ hasPicks = false, mode }) {
  const s = seasonFor(new Date(), mode);
  if (!s) return null;
  return (
    <section className="mx-auto max-w-7xl px-3 pt-3 sm:px-4 sm:pt-4" aria-label={`${s.urdu} collection`}>
      <div className={`relative isolate overflow-hidden rounded-2xl bg-gradient-to-br ${s.hero} px-4 pb-4 pt-7 text-white shadow-[0_12px_30px_-16px_rgba(0,0,0,.6)] sm:px-8 sm:pb-6 sm:pt-8`}>
        <div className="mz-geo-light absolute inset-0 -z-10 opacity-50" aria-hidden="true" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_80%_10%,rgba(255,214,120,.3),transparent_60%)]" aria-hidden="true" />
        {STARS.map(([x, y, sz], i) => (
          <span key={i} aria-hidden="true" className="mz-star absolute -z-10 text-[#FFE9A8]" style={{ left: `${x}%`, top: `${y}%`, fontSize: sz, animationDelay: `${(i % 5) * 0.6}s` }}>✦</span>
        ))}
        <svg className="mz-moon absolute right-3 top-3 sm:right-16 sm:top-4" width="38" height="38" viewBox="0 0 64 64" aria-hidden="true">
          <path d="M42 8a24 24 0 1 0 14 38A20 20 0 0 1 42 8z" fill="#FFE9A8" />
          <path d="M50 14l1.8 3.7 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6z" fill="#FFE9A8" />
        </svg>
        {s.id === 'winter' && (
          <>
            {SNOW.map(([x, d, t, dx], i) => <span key={i} aria-hidden="true" className="mz-hero-snow absolute -z-10 rounded-full bg-white" style={{ left: `${x}%`, top: 0, width: 3 + (i % 3) * 2, height: 3 + (i % 3) * 2, animationDuration: `${t}s`, animationDelay: `${d}s`, '--dx': `${dx}px`, opacity: 0.85 }} />)}
            <svg aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-10 w-full sm:h-14" viewBox="0 0 400 60" preserveAspectRatio="none"><path d="M0 60V38l40-18 36 20 52-30 48 28 44-22 56 26 40-20 48 22 36-14v50z" fill="#fff" fillOpacity=".16" /><path d="M0 60V46l54-14 42 14 62-18 52 18 70-16 60 16 60-12v26z" fill="#fff" fillOpacity=".24" /></svg>
          </>
        )}
        <Lantern className="left-[5%]" />
        <Lantern className="left-[14%] hidden sm:block" delay="-2s" />
        <Lantern className="right-[26%] hidden md:block" delay="-3.4s" />

        <div className="relative mx-auto max-w-xl text-center">
          <p lang="ar" dir="rtl" className="font-arabic mz-rise text-xl leading-[1.8] text-[#FFE9A8] sm:text-2xl">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</p>
          <h2 className="mz-rise font-display text-xl font-extrabold leading-tight sm:text-3xl" style={{ animationDelay: '.2s' }}>{s.title}</h2>
          <p className="mz-rise mt-1 hidden text-sm text-white/85 sm:block" style={{ animationDelay: '.35s' }}>{s.subtitle}</p>
          <HijriChip className="mz-rise mt-2 justify-center" />
          <div className="mz-rise mt-3 flex items-center justify-center gap-2.5" style={{ animationDelay: '.5s' }}>
            <a href={hasPicks ? '#season-picks' : '/products'} className="btn-sun !gap-1.5 !px-4 !py-2 text-sm"><Sparkles size={16} /> {s.urdu} picks</a>
            <Link href="/products" className="inline-flex items-center gap-1.5 rounded-full border border-white/50 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10">Sab products <ArrowRight size={15} /></Link>
          </div>
        </div>
      </div>
    </section>
  );
}
