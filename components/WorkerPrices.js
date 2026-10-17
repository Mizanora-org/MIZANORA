'use client';
import { useEffect } from 'react';
import { captureRef, getMarkups, getMarkets, getRef } from '@/lib/refClient';
import { sellView } from '@/lib/workers';
import { formatPKR } from '@/lib/format';

// Product cards are plain server HTML (no per-card JavaScript, see ProductCard). When a visitor arrives through a worker's link,
// this ONE script rewrites the price line of every card on screen (home, shelves, categories, search results, infinite scroll)
// to the worker's selling price and market rate. Visitors without a worker link: it does nothing at all.
export default function WorkerPrices() {
  useEffect(() => {
    let mk = {}, mt = {}, on = false, raf = 0;
    const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

    const paint = (card) => {
      const id = card.dataset.pid;
      const m = Number(mk[id]) || 0, k = Number(mt[id]) || 0;
      const sig = `${m}|${k}`;
      if ((card.dataset.wp || '') === (m || k ? sig : '')) return;
      const orig = card.querySelector('[data-pr]');
      const badge = card.querySelector('[data-pb]');
      const old = card.querySelector('[data-wprice]'); if (old) old.remove();
      const oldB = card.querySelector('[data-wbadge]'); if (oldB) oldB.remove();
      if (!m && !k) { if (orig) orig.style.display = ''; if (badge) badge.style.display = ''; delete card.dataset.wp; return; }
      if (!orig) return;
      const base = Number(card.dataset.base) || 0, shopCmp = Number(card.dataset.cmp) || 0;
      const v = sellView(base, m, k);
      // the worker's market rate wins; with none, the shop's own compare price is kept when it is still higher than the new price
      const cmp = v.off ? v.market : (shopCmp > v.sell ? shopCmp : 0);
      const off = cmp ? Math.round(((cmp - v.sell) / cmp) * 100) : 0;
      const p = el('p', orig.className);
      p.setAttribute('data-wprice', '1');
      p.append(el('span', 'text-base font-bold text-gold sm:text-lg', formatPKR(v.sell)));
      if (cmp) p.append(el('span', 'text-xs text-faint line-through', formatPKR(cmp)));
      orig.style.display = 'none';
      orig.after(p);
      if (badge) badge.style.display = 'none';
      if (off > 0) {
        const holder = card.querySelector('.aspect-square');
        if (holder) { const b = el('span', 'absolute left-2 top-2 rounded-md bg-gradient-to-r from-red-600 to-[#E0342B] px-2 py-0.5 text-xs font-extrabold text-white shadow-[0_2px_8px_-2px_rgba(220,38,38,.8)]', `-${off}%`); b.setAttribute('data-wbadge', '1'); holder.append(b); }
      }
      card.dataset.wp = sig;
    };
    const sweep = () => { raf = 0; if (on) document.querySelectorAll('article[data-card][data-pid]').forEach(paint); };
    const later = () => { if (!raf) raf = requestAnimationFrame(sweep); };
    const load = () => { mk = getMarkups(); mt = getMarkets(); on = Boolean(getRef()) && (Object.keys(mk).length > 0 || Object.keys(mt).length > 0); later(); };

    const mo = new MutationObserver(later);
    captureRef().finally(() => { load(); mo.observe(document.body, { childList: true, subtree: true }); });
    window.addEventListener('mz-ref-prices', load);
    return () => { mo.disconnect(); window.removeEventListener('mz-ref-prices', load); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return null;
}
