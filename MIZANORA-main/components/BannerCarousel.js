'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Swipeable, auto-moving banner slider (CSS scroll-snap, no library).
// A banner can be a photo (b.image) or a colour slide (b.bg) so the home page is never empty.
export default function BannerCarousel({ banners }) {
  const ref = useRef(null);
  const [i, setI] = useState(0);
  const paused = useRef(false);

  const go = useCallback((n) => {
    const el = ref.current;
    if (!el) return;
    const next = (n + banners.length) % banners.length;
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
    setI(next);
  }, [banners.length]);

  useEffect(() => {
    if (banners.length < 2) return undefined;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const t = setInterval(() => { if (!paused.current) go(i + 1); }, 4500);
    return () => clearInterval(t);
  }, [i, go, banners.length]);

  const onScroll = () => {
    const el = ref.current;
    if (el) setI(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <section aria-roledescription="carousel" aria-label="Offers" className="group relative">
      <div ref={ref} onScroll={onScroll} onTouchStart={() => { paused.current = true; }} onTouchEnd={() => { setTimeout(() => { paused.current = false; }, 6000); }}
        onMouseEnter={() => { paused.current = true; }} onMouseLeave={() => { paused.current = false; }}
        className="no-sb flex snap-x snap-mandatory overflow-x-auto scroll-smooth rounded-2xl">
        {banners.map((b, n) => (
          <Link key={b.id} href={b.link} className={`relative block aspect-[16/9] w-full shrink-0 snap-center overflow-hidden text-white sm:aspect-[16/6] ${b.image ? 'bg-raised' : b.bg || 'bg-gold'}`} aria-label={b.title || 'Offer'}>
            {b.image && <Image src={b.image} alt={b.title || 'Mizanora offer'} fill priority={n === 0} sizes="(max-width:1280px) 100vw, 1280px" className="object-cover" />}
            {(b.title || b.subtitle) && (
              <span className={`absolute inset-0 flex flex-col justify-center p-5 sm:p-12 ${b.image ? 'bg-gradient-to-r from-black/70 via-black/30 to-transparent' : ''}`}>
                {b.kicker && <span className="mb-1 w-fit rounded-full bg-saffron px-3 py-0.5 text-xs font-bold text-[#2B1B00]">{b.kicker}</span>}
                {b.title && <span className="max-w-md font-display text-2xl font-extrabold leading-tight sm:text-5xl">{b.title}</span>}
                {b.subtitle && <span className="mt-1.5 max-w-md text-sm text-white/90 sm:text-lg">{b.subtitle}</span>}
                <span className="mt-3 w-fit rounded-full bg-white px-5 py-2 text-sm font-bold text-gold">{b.cta}</span>
              </span>
            )}
          </Link>
        ))}
      </div>
      {banners.length > 1 && (
        <>
          <button type="button" aria-label="Previous offer" onClick={() => go(i - 1)} className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/90 p-2 text-cream shadow md:group-hover:block"><ChevronLeft size={20} /></button>
          <button type="button" aria-label="Next offer" onClick={() => go(i + 1)} className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/90 p-2 text-cream shadow md:group-hover:block"><ChevronRight size={20} /></button>
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
            {banners.map((b, n) => (
              <button key={b.id} aria-label={`Show offer ${n + 1}`} onClick={() => go(n)} className={`h-2 rounded-full transition-all ${n === i ? 'w-6 bg-saffron' : 'w-2 bg-white/60'}`} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
