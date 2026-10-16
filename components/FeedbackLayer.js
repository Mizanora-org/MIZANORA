'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { sfx } from '@/lib/sound';

// Global feel: a soft tap sound on buttons, and the "Added to cart" style messages.
export default function FeedbackLayer() {
  const [t, setT] = useState(null);

  useEffect(() => {
    const onClick = (e) => {
      const el = e.target.closest && e.target.closest('button, [role="button"], a.btn-gold, a.btn-sun, a.btn-ghost, label.btn-ghost');
      if (!el || el.disabled || el.closest('[data-nosound]')) return;
      // Buttons with their own sound (add to cart, wishlist, coupon, place order) play that one instead.
      if (el.tagName === 'BUTTON' && /add to (cart|bag)|wish|apply|place (your )?order|confirm/i.test(`${el.getAttribute('aria-label') || ''} ${el.textContent || ''}`)) return;
      sfx.tap();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  useEffect(() => {
    let h;
    const show = (e) => { setT({ ...e.detail, id: Date.now() }); clearTimeout(h); h = setTimeout(() => setT(null), 3200); };
    window.addEventListener('mz-toast', show);
    return () => { window.removeEventListener('mz-toast', show); clearTimeout(h); };
  }, []);

  if (!t) return null;
  return (
    <div key={t.id} role="status" aria-live="polite" data-nosound className="mz-anim pointer-events-none fixed inset-x-0 bottom-[calc(4.6rem+env(safe-area-inset-bottom))] z-[90] flex justify-center px-4 md:bottom-6" style={{ animation: 'mz-toast .3s ease-out' }}>
      <div className="pointer-events-auto flex max-w-sm items-center gap-3 rounded-full bg-[#12201A] py-2.5 pl-3 pr-4 text-sm font-semibold text-white shadow-2xl">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-gold"><Check size={15} /></span>
        <span>{t.msg}</span>
        {t.href && <Link href={t.href} className="font-extrabold text-saffron underline-offset-4 hover:underline">{t.label || 'View'}</Link>}
      </div>
    </div>
  );
}
