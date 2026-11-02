'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard, Tv, CalendarRange, Film, Users2, Wallet, ReceiptText, Clapperboard,
  SlidersHorizontal, Search, Bell, Menu, X, MessageCircle, Radio, ChevronRight, LogOut, PlayCircle,
} from 'lucide-react';
import { Logo, Badge, Avatar } from './ui';
import { BRAND } from '@/lib/data';

const NAV = [
  {
    group: 'Overview',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    group: 'Content',
    items: [
      { href: '/channels', label: 'Live channels', icon: Tv, badge: '2.4k' },
      { href: '/epg', label: 'EPG guide', icon: CalendarRange },
      { href: '/library', label: 'Movies & series', icon: Film },
    ],
  },
  {
    group: 'Business',
    items: [
      { href: '/resellers', label: 'Resellers', icon: Users2, badge: '12' },
      { href: '/users', label: 'Subscribers', icon: PlayCircle },
      { href: '/billing', label: 'Billing & collection', icon: ReceiptText },
    ],
  },
  {
    group: 'Prototype',
    items: [
      { href: '/studio', label: 'Videos & ads', icon: Clapperboard },
      { href: '/watch', label: 'Player preview', icon: Radio },
      { href: '/settings', label: 'Settings', icon: SlidersHorizontal },
    ],
  },
];

function Clock() {
  const [now, setNow] = useState(null);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    setNow(new Date());
    return () => clearInterval(t);
  }, []);
  if (!now) return <span className="num text-xs text-faint">--:--</span>;
  const pkt = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
  const hh = String(pkt.getHours()).padStart(2, '0');
  const mm = String(pkt.getMinutes()).padStart(2, '0');
  const ss = String(pkt.getSeconds()).padStart(2, '0');
  return (
    <span className="num hidden items-center gap-1.5 text-xs font-semibold text-dim sm:flex">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald pulse-dot text-emerald" />
      {hh}:{mm}:{ss} <span className="text-faint">PKT</span>
    </span>
  );
}

export default function Shell({ children }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [pathname]);

  const current = NAV.flatMap((g) => g.items).find((i) => pathname.startsWith(i.href));

  return (
    <div className="min-h-screen lg:pl-[268px]">
      {/* ------------------------------------------------------------ sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[268px] flex-col border-r border-line bg-[#04110b]/95 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-4 pb-4 pt-5">
          <Link href="/dashboard" aria-label="Mizanora IPTV home"><Logo size={38} withText /></Link>
          <button onClick={() => setOpen(false)} className="btn btn-icon btn-ghost lg:hidden"><X size={16} /></button>
        </div>

        <nav className="flex-1 overflow-y-auto scroll-thin px-3 pb-4">
          {NAV.map((g) => (
            <div key={g.group} className="mb-4">
              <p className="mb-1.5 px-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-faint/70">{g.group}</p>
              {g.items.map((it) => {
                const active = pathname.startsWith(it.href);
                return (
                  <Link key={it.href} href={it.href} className={`nav-item ${active ? 'active' : ''}`}>
                    <it.icon size={17} />
                    <span className="flex-1">{it.label}</span>
                    {it.badge && <span className="rounded-md bg-white/8 px-1.5 py-0.5 text-[10px] font-bold text-dim">{it.badge}</span>}
                    {active && <ChevronRight size={13} className="text-gold" />}
                  </Link>
                );
              })}
            </div>
          ))}

          <div className="mt-2 overflow-hidden rounded-2xl border border-gold/25 bg-gradient-to-br from-gold/[0.12] to-transparent p-3.5">
            <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-goldsoft">
              <Wallet size={13} /> Cycle {BRAND.cycle.from}–{BRAND.cycle.to} {BRAND.cycle.month}
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-dim">
              Rs 10.02L collected of Rs 12.86L. 4 resellers pending.
            </p>
            <Link href="/billing" className="mt-2.5 flex items-center gap-1 text-[11px] font-bold text-gold hover:underline">
              Open collection <ChevronRight size={12} />
            </Link>
          </div>
        </nav>

        <div className="border-t border-line p-3">
          <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.04] px-2.5 py-2">
            <Avatar name={BRAND.operator} tone="gold" />
            <div className="min-w-0 flex-1">
              <b className="block truncate text-xs font-bold">{BRAND.operator}</b>
              <small className="text-[10px] text-faint">Main admin · 2FA on</small>
            </div>
            <Link href="/login" className="btn btn-icon btn-ghost" aria-label="Log out"><LogOut size={14} /></Link>
          </div>
        </div>
      </aside>

      {open && <button aria-label="Close menu" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" />}

      {/* -------------------------------------------------------------- topbar */}
      <header className="sticky top-0 z-30 border-b border-line bg-[#04100a]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-3 px-4 sm:px-6">
          <button onClick={() => setOpen(true)} className="btn btn-icon btn-ghost lg:hidden" aria-label="Open menu"><Menu size={17} /></button>
          <div className="hidden min-w-0 items-center gap-2 text-sm sm:flex">
            <span className="text-faint">Panel</span>
            <ChevronRight size={13} className="text-faint" />
            <b className="truncate font-bold">{current?.label || 'Dashboard'}</b>
          </div>

          <div className="relative ml-auto hidden w-full max-w-xs md:block">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input className="input pl-9 pr-14" placeholder="Search channels, resellers, MAC…" aria-label="Search" />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-line bg-white/5 px-1.5 py-0.5 text-[10px] text-faint">⌘K</kbd>
          </div>

          <Clock />

          <a href={`https://wa.me/92${BRAND.jazzcash.replace(/\D/g, '').slice(1)}`} target="_blank" rel="noreferrer"
            className="btn btn-ghost hidden items-center gap-1.5 sm:inline-flex" title="WhatsApp support">
            <MessageCircle size={15} className="text-[#25D366]" /> WhatsApp
          </a>

          <button className="btn btn-icon btn-ghost relative" aria-label="Notifications">
            <Bell size={16} />
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-gold" />
          </button>

          <Link href="/login" className="hidden"><Badge tone="gold">Admin</Badge></Link>
        </div>
      </header>

      {/* ---------------------------------------------------------------- page */}
      <main key={pathname} className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 slide-in">
        {children}
      </main>
    </div>
  );
}
