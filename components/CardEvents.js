'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCartActions } from './CartProvider';
import { addToCart, addToWishlist } from '@/lib/metaPixel';
import { getWish, toggleWish } from '@/lib/wish';

// ONE listener for every product card on the page: heart, share, "Add to cart" and tap-to-prefetch.
// Cards themselves are plain HTML, so even a page with 200 products stays light.
export default function CardEvents() {
  const { add } = useCartActions();
  const router = useRouter();

  useEffect(() => {
    let wish = new Set(getWish());
    const paintHeart = (b) => {
      const on = wish.has(b.dataset.id);
      if (on) b.dataset.on = '1'; else delete b.dataset.on;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.setAttribute('aria-label', on ? 'Remove from wishlist' : 'Save to wishlist');
      b.dataset.s = '1';
    };
    const paintAll = () => document.querySelectorAll('[data-act="wish"]').forEach(paintHeart);
    // Cards added later (infinite scroll, filters) get their heart state when they appear.
    let raf = 0;
    const paintNew = () => { raf = 0; document.querySelectorAll('[data-act="wish"]:not([data-s])').forEach(paintHeart); };
    const mo = new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(paintNew); });
    // First paint of the hearts waits a moment so it never races with hydration.
    const first = setTimeout(() => { paintAll(); mo.observe(document.body, { childList: true, subtree: true }); }, 500);
    const onWish = () => { wish = new Set(getWish()); paintAll(); };
    window.addEventListener('mz-wish', onWish);
    window.addEventListener('storage', onWish);

    const flash = (b) => { b.dataset.done = '1'; setTimeout(() => { delete b.dataset.done; }, 1700); };

    const onClick = (e) => {
      const b = e.target.closest && e.target.closest('[data-act]');
      if (!b) return;
      const d = b.dataset;
      if (d.act === 'wish') {
        e.preventDefault();
        if (toggleWish(d.id)) addToWishlist({ id: d.id, name: d.name, price: Number(d.price) });
      } else if (d.act === 'add') {
        e.preventDefault();
        const p = { id: d.id, slug: d.slug, name: d.name, price: Number(d.price) || 0, images: d.img ? [d.img] : [] };
        add(p, { qty: 1 });
        addToCart(p, 1);
        flash(b);
      } else if (d.act === 'share') {
        e.preventDefault();
        const url = `${window.location.origin}/product/${d.slug}`;
        (async () => {
          try { if (navigator.share) { await navigator.share({ title: d.name, url }); return; } } catch (_) { return; }
          try { await navigator.clipboard.writeText(url); flash(b); } catch (_) { /* clipboard blocked */ }
        })();
      }
    };

    // Start loading a product page the moment a finger / mouse touches its card (not for every card on the screen).
    const seen = new Set();
    const warm = (e) => {
      const a = e.target.closest && e.target.closest('a[data-pf]');
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href || seen.has(href)) return;
      seen.add(href);
      try { router.prefetch(href); } catch (_) { /* ignore */ }
    };

    document.addEventListener('click', onClick);
    document.addEventListener('touchstart', warm, { passive: true });
    document.addEventListener('mouseover', warm, { passive: true });
    return () => {
      clearTimeout(first); mo.disconnect(); if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('mz-wish', onWish); window.removeEventListener('storage', onWish);
      document.removeEventListener('click', onClick);
      document.removeEventListener('touchstart', warm);
      document.removeEventListener('mouseover', warm);
    };
  }, [add, router]);

  return null;
}
