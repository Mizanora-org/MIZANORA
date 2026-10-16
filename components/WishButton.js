'use client';
import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { getWish, toggleWish } from '@/lib/wish';
import { addToWishlist } from '@/lib/metaPixel';
import { sfx } from '@/lib/sound';

export default function WishButton({ product, className = '', small = false }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const sync = () => setOn(getWish().includes(product.id));
    sync();
    window.addEventListener('mz-wish', sync);
    return () => window.removeEventListener('mz-wish', sync);
  }, [product.id]);
  return (
    <button type="button" aria-pressed={on} aria-label={on ? 'Remove from wishlist' : 'Save to wishlist'}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (toggleWish(product.id)) { sfx.wish(); addToWishlist(product); } else sfx.tap(); }}
      className={`grid place-items-center rounded-full border border-line bg-white/95 shadow-sm transition active:scale-90 ${small ? 'h-8 w-8' : 'h-11 w-11'} ${on ? 'text-red-600' : 'text-faint hover:text-red-600'} ${className}`}>
      <Heart size={small ? 17 : 22} fill={on ? 'currentColor' : 'none'} />
    </button>
  );
}
