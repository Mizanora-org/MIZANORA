'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'firebase/auth';
import {
  Bot, Clock, ImageOff, Images, LayoutDashboard, LogOut, Menu, Package, Plug, Power,
  Search, ShoppingBag, Star, TicketPercent, Upload, Users, Video, FileSpreadsheet, Archive, X,
} from 'lucide-react';
import { authClient } from '@/lib/firebase-client';
import { adminHit } from '@/lib/adminSearch';
import { useAdminSearch } from '@/components/AdminSearch';

// PROFESSIONAL ADMIN SIDEBAR. Two shapes:
//   * desktop (lg and up): a sticky sidebar with the shop name, the search box and the menu grouped like a real panel
//   * phone/tablet: a slim top bar with a menu button; the same menu opens as a drawer
// The search box writes into AdminSearchProvider, so the visible page (products, orders...) filters as you type.
export const ADMIN_MENU = [
  {
    title: 'Overview',
    items: [
      { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, hint: 'Visitors, sales, orders, funnel' },
      { href: '/admin/connections', label: 'Connections', icon: Plug, hint: 'Firestore, Realtime Database and GitHub test', tag: 'NEW' },
    ],
  },
  {
    title: 'Catalogue',
    items: [
      { href: '/admin/products', label: 'Products', icon: Package, hint: 'Add, edit, search live + archived products' },
      { href: '/admin/import', label: 'Import CSV', icon: Upload, hint: 'Supplier CSV into Firestore or the archive', tag: 'CSV' },
      { href: '/admin/convert', label: 'CSV converter', icon: FileSpreadsheet, hint: 'Markaz/Shopify CSV to Mizanora CSV' },
      { href: '/admin/archive', label: 'Archive', icon: Archive, hint: 'Old products as JSON files in your repo' },
      { href: '/admin/errors', label: 'Photo errors', icon: ImageOff, hint: 'Broken photos to fix' },
    ],
  },
  {
    title: 'Selling',
    items: [
      { href: '/admin/orders', label: 'Orders', icon: ShoppingBag, hint: 'Live orders, status, courier CSV' },
      { href: '/admin/coupons', label: 'Promo codes', icon: TicketPercent, hint: 'Codes, partners, commission' },
      { href: '/admin/workers', label: 'Workers', icon: Users, hint: 'Applications, commissions, payouts' },
    ],
  },
  {
    title: 'Content',
    items: [
      { href: '/admin/banners', label: 'Banners', icon: Images },
      { href: '/admin/reels', label: 'Reels', icon: Video },
      { href: '/admin/reviews', label: 'Reviews', icon: Star },
      { href: '/admin/assistant', label: 'AI Assistant', icon: Bot },
      { href: '/admin/searches', label: 'Searches', icon: Search, hint: 'What customers type in the shop' },
    ],
  },
  {
    title: 'System',
    items: [
      { href: '/admin/control', label: 'Control room', icon: Power, hint: 'Shut down, high alert, feature switches' },
    ],
  },
];

const FLAT = ADMIN_MENU.flatMap((g) => g.items.map((i) => ({ ...i, group: g.title })));

function Item({ item, on, onPick }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onPick}
      aria-current={on ? 'page' : undefined}
      className={`group flex items-start gap-2.5 rounded-xl px-2.5 py-2 text-sm transition ${on ? 'bg-gold text-white shadow-[0_6px_16px_-8px_rgba(11,107,69,.7)]' : 'text-dim hover:bg-raised hover:text-gold'}`}
    >
      <Icon size={17} className="mt-0.5 shrink-0" strokeWidth={on ? 2.4 : 2} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 font-semibold">
          <span className="truncate">{item.label}</span>
          {item.tag && <span className={`rounded px-1 text-[0.6rem] font-bold ${on ? 'bg-white/25 text-white' : 'bg-saffron/20 text-[#8A5A00]'}`}>{item.tag}</span>}
        </span>
        {item.hint && <span className={`block truncate text-[0.68rem] ${on ? 'text-white/75' : 'text-faint'}`}>{item.hint}</span>}
      </span>
    </Link>
  );
}

function NavBody({ pathname, q, setQ, email, close, onPick }) {
  const hits = useMemo(() => (q.trim() ? FLAT.filter((i) => adminHit(q, `${i.label} ${i.hint || ''} ${i.group}`)).slice(0, 6) : []), [q]);
  const open = (href) => pathname === href || pathname.startsWith(`${href}/`);
  return (
    <>
      <label htmlFor="admin-search" className="sr-only">Search in the admin panel</label>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <input
          id="admin-search"
          className="input !py-2.5 !pl-9 !pr-9 text-sm"
          placeholder="Search products, orders..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
          type="search"
        />
        {q !== '' && (
          <button type="button" aria-label="Clear search" onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-faint hover:text-gold">
            <X size={15} />
          </button>
        )}
      </div>
      <p className="mt-1.5 px-0.5 text-[0.68rem] leading-4 text-faint">
        {q.trim() ? `Filtering lists with “${q.trim()}”` : 'Type here: the open page filters itself. “Go to” finds a section too.'}
      </p>

      {hits.length > 0 && (
        <div className="mt-2 rounded-xl border border-line bg-raised p-1.5">
          <p className="px-2 py-1 text-[0.62rem] font-bold uppercase tracking-wide text-faint">Go to</p>
          {hits.map((i) => (
            <Link key={i.href} href={i.href} onClick={onPick} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-dim hover:bg-surface hover:text-gold">
              <i.icon size={14} /> <span className="font-semibold">{i.label}</span> <span className="truncate text-faint">{i.group}</span>
            </Link>
          ))}
        </div>
      )}

      <nav aria-label="Admin sections" className="mt-3 space-y-3">
        {ADMIN_MENU.map((g) => (
          <div key={g.title}>
            <p className="px-2.5 pb-1 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-faint">{g.title}</p>
            <div className="space-y-0.5">
              {g.items.map((item) => <Item key={item.href} item={item} on={open(item.href)} onPick={onPick} />)}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-4 border-t border-line pt-3">
        <p className="px-2.5 text-[0.7rem] text-faint">
          Signed in as<br /><b className="break-all text-dim">{email || 'admin'}</b>
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Link href="/" onClick={onPick} className="btn-ghost flex-1 !px-3 !py-2 text-[0.7rem]">Open shop</Link>
          <button type="button" onClick={() => signOut(authClient())} className="btn-ghost flex-1 !px-3 !py-2 text-[0.7rem]"><LogOut size={14} /> Sign out</button>
        </div>
        <Clock size={12} className="mx-auto mt-2 text-faint" aria-hidden="true" />
        {close}
      </div>
    </>
  );
}

export default function AdminNav({ email = '' }) {
  const pathname = usePathname() || '/admin';
  const { q, setQ } = useAdminSearch();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const brand = (
    <div className="flex items-center gap-2">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold text-sm font-extrabold text-white">M</span>
      <span className="font-display text-base font-extrabold tracking-wide">MIZANORA <span className="text-xs font-semibold text-faint">Admin</span></span>
    </div>
  );

  return (
    <>
      {/* Phone / tablet: slim top bar + drawer */}
      <div className="sticky top-0 z-30 -mx-3 mb-3 flex items-center gap-2 border-b border-line bg-ink/95 px-3 py-2 backdrop-blur sm:-mx-5 sm:px-5 lg:hidden">
        {brand}
        <div className="ml-auto flex items-center gap-1.5">
          <button type="button" onClick={() => setOpen(true)} className="relative grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface text-dim" aria-label="Admin menu" aria-expanded={open}>
            <Menu size={20} />
            {q.trim() && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-saffron" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute left-0 top-0 h-full w-[19rem] max-w-[88vw] overflow-y-auto border-r border-line bg-surface p-3 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              {brand}
              <button type="button" onClick={() => setOpen(false)} className="rounded-full p-2 text-dim" aria-label="Close menu"><X size={18} /></button>
            </div>
            <NavBody pathname={pathname} q={q} setQ={setQ} email={email} close={null} onPick={() => setOpen(false)} />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="sticky top-4 hidden h-fit max-h-[calc(100vh-2rem)] w-full overflow-y-auto rounded-2xl border border-line bg-surface p-3.5 shadow-[0_2px_14px_-4px_rgba(18,32,26,.12)] lg:block">
        {brand}
        <div className="mt-3"><NavBody pathname={pathname} q={q} setQ={setQ} email={email} close={null} onPick={null} /></div>
      </aside>

      {/* Quick actions that stay reachable while scrolling on the phone */}
      <div className="mb-3 flex gap-1.5 overflow-x-auto lg:hidden no-sb">
        {['/admin/dashboard', '/admin/products', '/admin/import', '/admin/orders', '/admin/connections'].map((href) => {
          const item = FLAT.find((i) => i.href === href);
          const on = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link key={href} href={href} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${on ? 'bg-gold text-white' : 'bg-raised text-dim'}`}>
              {item ? item.label : href.replace('/admin/', '')}
            </Link>
          );
        })}
      </div>
    </>
  );
}
