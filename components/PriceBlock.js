'use client';
import { formatPKR } from '@/lib/format';
import { useRefPricing } from '@/lib/refClient';

// The price line of a product page. Normal visitors see the shop price (and the shop's compare price).
// A visitor who came through a worker's link sees THAT worker's selling price, and the worker's market rate struck through
// (with the discount) when the market rate is higher than the selling price.
export default function PriceBlock({ id, price, comparePrice = 0 }) {
  const v = useRefPricing(id, price, comparePrice);
  return (
    <p className="mt-4 flex flex-wrap items-baseline gap-3">
      <span className="text-3xl font-bold text-gold">{formatPKR(v.price)}</span>
      {v.compare > v.price && <span className="text-lg text-faint line-through">{formatPKR(v.compare)}</span>}
      {v.off > 0 && <span className="rounded-full bg-gold px-2.5 py-1 text-xs font-bold text-ink">Save {v.off}%</span>}
    </p>
  );
}
