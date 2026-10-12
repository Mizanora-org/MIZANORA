import Link from 'next/link';
import Image from 'next/image';
import { formatPKR, discountPct } from '@/lib/format';
import QuickAdd from './QuickAdd';
import WishButton from './WishButton';
import ShareMini from './ShareMini';

export default function ProductCard({ p, priority = false }) {
  const off = discountPct(p.price, p.comparePrice);
  return (
    <article className="mz-lift group flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-[0_1px_3px_rgba(18,32,26,.06)] hover:border-gold/40 hover:shadow-xl">
      <div className="relative flex-1">
      <div className="absolute right-2 top-2 z-10 flex flex-col gap-1.5"><WishButton product={p} small /><ShareMini slug={p.slug} name={p.name} /></div>
      <Link href={`/product/${p.slug}`} className="block">
        <div className="relative aspect-square bg-raised">
          {p.images[0] ? (
            <Image src={p.images[0]} alt={p.name} fill priority={priority} sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 20vw" className="object-cover transition duration-300 group-hover:scale-105" />
          ) : (
            <div className="grid h-full place-items-center font-display text-3xl text-bronze">M</div>
          )}
          {!p.inStock && <span className="absolute bottom-2 left-2 rounded-md bg-cream/80 px-2 py-0.5 text-xs font-bold text-white">Sold out</span>}
          {off > 0 && <span className="absolute left-2 top-2 rounded-md bg-red-600 px-2 py-0.5 text-xs font-extrabold text-white">-{off}%</span>}
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
      <div className="px-3 pb-3"><QuickAdd p={p} /></div>
    </article>
  );
}
