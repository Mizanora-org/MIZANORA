'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Pencil, X } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { SITE } from '@/lib/config';

const QuickEditModal = dynamic(() => import('./QuickEditModal'), { ssr: false });
const PENCIL = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const LINKS = [['/admin/products', 'Products'], ['/admin/banners', 'Banners'], ['/admin/reels', 'Video feed'], ['/admin/orders', 'Orders'], ['/admin/ai', 'AI Manager'], ['/admin/dashboard', 'Dashboard']];

// ADMIN EDIT LAYER (only for the shop owner, nothing is added for visitors). A pencil appears on every product card on every page
// (home, shelves, categories, search) and on the product page. Tap it, change the name, price, photos, stock, then save: no need to go to the
// admin panel. The server and Firestore rules still check the owner on every save.
export default function AdminEditLayer() {
  const { user } = useAuth();
  const path = usePathname() || '/';
  const [open, setOpen] = useState('');
  const [menu, setMenu] = useState(false);
  const [off, setOff] = useState(false);

  const isAdmin = useMemo(() => {
    if (!user) return false;
    const email = String(user.email || '').toLowerCase();
    if ((SITE.adminEmails || []).includes(email)) return true;
    try { return localStorage.getItem('mz_admin_uid') === user.uid; } catch { return false; }
  }, [user]);
  const active = isAdmin && !off && !path.startsWith('/admin');

  useEffect(() => { try { setOff(localStorage.getItem('mz_qe_off') === '1'); } catch (_) { /* ignore */ } }, []);
  const toggle = () => { const v = !off; setOff(v); try { localStorage.setItem('mz_qe_off', v ? '1' : '0'); } catch (_) { /* ignore */ } };

  useEffect(() => {
    if (!active) { document.querySelectorAll('[data-qe-btn]').forEach((b) => b.remove()); document.querySelectorAll('[data-qe]').forEach((c) => c.removeAttribute('data-qe')); return undefined; }
    let raf = 0;
    const paint = () => {
      raf = 0;
      document.querySelectorAll('article[data-card][data-pid]:not([data-qe])').forEach((card) => {
        card.setAttribute('data-qe', '1');
        const holder = card.querySelector('.aspect-square') || card;
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('data-qe-btn', card.getAttribute('data-pid'));
        b.setAttribute('aria-label', 'Edit this product');
        b.className = 'absolute bottom-2 left-2 z-20 grid h-8 w-8 place-items-center rounded-full bg-amber-400 text-black shadow-lg ring-2 ring-white';
        b.innerHTML = PENCIL;
        holder.appendChild(b);
      });
    };
    const later = () => { if (!raf) raf = requestAnimationFrame(paint); };
    const onClick = (e) => {
      const b = e.target.closest && e.target.closest('[data-qe-btn]');
      if (!b) return;
      e.preventDefault(); e.stopPropagation();
      setOpen(b.getAttribute('data-qe-btn'));
    };
    paint();
    const mo = new MutationObserver(later);
    mo.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', onClick, true);
    return () => { mo.disconnect(); document.removeEventListener('click', onClick, true); if (raf) cancelAnimationFrame(raf); };
  }, [active, path]);

  const close = useCallback(() => setOpen(''), []);
  if (!isAdmin || path.startsWith('/admin')) return null;
  const onProduct = path.startsWith('/product/') ? decodeURIComponent(path.split('/')[2] || '') : '';

  return (
    <>
      <div className="fixed bottom-[calc(4.6rem+env(safe-area-inset-bottom))] left-3 z-[55] flex flex-col items-start gap-2 md:bottom-4">
        {menu && (
          <div className="w-48 rounded-2xl border border-line bg-white p-2 text-sm shadow-xl">
            <div className="mb-1 flex items-center justify-between px-2 text-xs font-extrabold uppercase tracking-wide text-faint"><span>Owner tools</span><button type="button" aria-label="Close" onClick={() => setMenu(false)}><X size={14} /></button></div>
            {LINKS.map(([h, l]) => <Link key={h} href={h} className="block rounded-lg px-2 py-1.5 font-semibold text-cream hover:bg-raised">{l}</Link>)}
            <button type="button" onClick={toggle} className="mt-1 w-full rounded-lg bg-raised px-2 py-1.5 text-left font-semibold text-dim">{off ? 'Show edit pencils' : 'Hide edit pencils'}</button>
          </div>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={() => setMenu((v) => !v)} aria-label="Owner tools" className="grid h-11 w-11 place-items-center rounded-full bg-amber-400 text-black shadow-xl ring-2 ring-white"><Pencil size={18} /></button>
          {active && onProduct && <button type="button" onClick={() => setOpen(onProduct)} className="rounded-full bg-amber-400 px-4 text-sm font-extrabold text-black shadow-xl ring-2 ring-white">Edit this product</button>}
        </div>
      </div>
      {open && active && <QuickEditModal id={open} onClose={close} />}
    </>
  );
}
