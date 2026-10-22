'use client';
import { useEffect, useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { formatPKR } from '@/lib/format';

// Phone only: a bar with the price and an Order button that follows you once the main buy box scrolls out of view.
export default function StickyBuy({ name, price, hasOptions }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const box = document.getElementById('buy-box');
    if (!box || !('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(box);
    return () => io.disconnect();
  }, []);
  if (!show) return null;
  return (
    <div className="fixed inset-x-0 bottom-[calc(3.6rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-white/95 px-3 py-2 shadow-[0_-6px_18px_rgba(18,32,26,.12)] backdrop-blur md:hidden">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1"><p className="truncate text-xs text-dim">{name}</p><p className="text-lg font-extrabold text-gold">{formatPKR(price)}</p></div>
        <button type="button" className="btn-gold !px-5 !py-2.5" onClick={() => document.getElementById('buy-box')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><ShoppingBag size={18} /> {hasOptions ? 'Choose options' : 'Order now'}</button>
      </div>
    </div>
  );
}
