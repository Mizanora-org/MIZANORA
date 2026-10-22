'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Check, Plus } from 'lucide-react';
import { useCart } from './CartProvider';
import { addToCart } from '@/lib/metaPixel';

// One-tap "Add" on product cards. Products that need a size send the shopper to the product page instead.
export default function QuickAdd({ p }) {
  const { add } = useCart();
  const [done, setDone] = useState(false);
  if (!p.inStock) return <span className="block rounded-full bg-raised py-2 text-center text-xs font-semibold text-faint">Sold out</span>;
  if (p.sizes.length) {
    return <Link href={`/product/${p.slug}`} className="block rounded-full border border-gold py-2 text-center text-xs font-semibold text-gold hover:bg-gold/10">Choose options</Link>;
  }
  return (
    <button type="button" onClick={() => { add(p, { qty: 1 }); addToCart(p, 1); setDone(true); setTimeout(() => setDone(false), 1800); }}
      className="flex w-full items-center justify-center gap-1.5 rounded-full bg-gold py-2 text-xs font-bold text-white hover:bg-goldhi" aria-live="polite">
      {done ? <><Check size={14} /> Added</> : <><Plus size={14} /> Add to cart</>}
    </button>
  );
}
