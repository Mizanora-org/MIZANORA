import Link from 'next/link';
import { Check, Heart, Plus, Share2 } from 'lucide-react';
import CardMedia from './CardMedia';
import { firstVideo } from '@/lib/media';
import { formatPKR, discountPct } from '@/lib/format';

// A product card is plain markup (no state, no per-card listeners). The heart, share and "Add to cart" buttons are
// handled by ONE global listener (components/CardEvents.js) through the data-act attributes below.
// Result: 150 cards on a page cost almost nothing to hydrate, so taps and scrolling stay smooth.
export default function ProductCard({ p, priority = false }) {
  const off = discountPct(p.price, p.comparePrice);
  const img = (p.images && p.images[0]) || p.image || '';
  const video = firstVideo(p); // a product whose media is a video still gets a beautiful card
  const needsOptions = p.hasOptions !== undefined ? p.hasOptions : Boolean(p.sizes && p.sizes.length);
  return (
    <article data-card="1" data-pslug={p.slug} className="mz-card group flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-[0_1px_3px_rgba(18,32,26,.06)]">
      <div className="relative flex-1">
        <div className="absolute right-2 top-2 z-10 flex flex-col gap-1.5">
          <button type="button" data-act="wish" data-id={p.id} data-name={p.name} data-price={p.price} aria-label="Save to wishlist" className="mz-iconbtn mz-heart h-8 w-8">
            <Heart size={17} />
          </button>
          <button type="button" data-act="share" data-slug={p.slug} data-name={p.name} aria-label={`Share ${p.name}`} className="mz-iconbtn h-8 w-8">
            <Share2 size={16} className="ic-idle" /><Check size={16} className="ic-done text-gold" />
          </button>
        </div>
        <Link href={`/product/${p.slug}`} prefetch={false} data-pf="1" className="block">
          <div className="relative aspect-square bg-raised">
            {img || video ? (
              <CardMedia img={img} video={video} alt={p.name} priority={priority} sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 20vw" />
            ) : (
              <div className="grid h-full place-items-center font-display text-3xl text-bronze">M</div>
            )}
            {!p.inStock && <span className="absolute bottom-2 left-2 rounded-md bg-cream/80 px-2 py-0.5 text-xs font-bold text-white">Sold out</span>}
            {off > 0 && <span className="absolute left-2 top-2 rounded-md bg-gradient-to-r from-red-600 to-[#E0342B] px-2 py-0.5 text-xs font-extrabold text-white shadow-[0_2px_8px_-2px_rgba(220,38,38,.8)]">-{off}%</span>}
          </div>
          <div className="p-3">
            <h3 className="line-clamp-2 min-h-[2.5rem] font-sans text-sm font-medium leading-snug text-cream">{p.name}</h3>
            <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
              <span className="text-base font-bold text-gold sm:text-lg">{formatPKR(p.price)}</span>
              {p.comparePrice > p.price && <span className="text-xs text-faint line-through">{formatPKR(p.comparePrice)}</span>}
            </p>
            <p className="mt-1 text-[0.7rem] font-semibold text-gold">Cash on delivery</p>
          </div>
        </Link>
      </div>
      <div className="px-3 pb-3">
        {!p.inStock ? (
          <span className="block rounded-full bg-raised py-2 text-center text-xs font-semibold text-faint">Sold out</span>
        ) : needsOptions ? (
          <Link href={`/product/${p.slug}`} prefetch={false} data-pf="1" className="block rounded-full border border-gold py-2 text-center text-xs font-semibold text-gold active:bg-gold/10">Choose options</Link>
        ) : (
          <button type="button" data-act="add" data-id={p.id} data-slug={p.slug} data-name={p.name} data-price={p.price} data-img={img}
            className="mz-add flex w-full items-center justify-center gap-1.5 rounded-full bg-gold py-2 text-xs font-bold text-white active:bg-goldhi">
            <span className="qa-idle inline-flex items-center gap-1.5"><Plus size={14} /> Add to cart</span>
            <span className="qa-done items-center gap-1.5"><Check size={14} /> Added</span>
          </button>
        )}
      </div>
    </article>
  );
}
