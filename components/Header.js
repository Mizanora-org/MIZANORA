'use client';
import SoundToggle from './SoundToggle';
import MusicToggle from './MusicToggle';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Heart, Menu, ShoppingBag, UserRound, X } from 'lucide-react';
import { useCart } from './CartProvider';
import InstallButton from './InstallButton';
import SearchBox from './SearchBox';

// App-style header: solid brand bar with logo, big search and cart; category strip below on desktop.
//
// FIXES IN v18 (the menu used to get stuck open):
//   * it closes when you tap outside it, when you press Esc, and when the page changes
//   * the page behind it does not scroll while the menu is open
//   * it slides down softly instead of appearing with a jump
//   * the category strip now shows which category you are on
export default function Header({ categories = [], music = null }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { count } = useCart();
  const path = usePathname() || '/';

  const searchForm = (id, cls = '') => <SearchBox id={id} className={cls} categories={categories} />;

  // A stronger shadow once the page is scrolled (a small detail that makes the bar feel solid).
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // The menu must close on every kind of "leave": another page, the Esc key, a tap outside.
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    // The menu button is NOT "outside": without this, the tap that opens the menu would first close
    // it (pointerdown) and the click right after would open it again.
    const away = (e) => {
      const t = e.target;
      if (menu.current && menu.current.contains(t)) return;
      if (toggle.current && toggle.current.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', away);
    // The page behind the menu must not scroll while the menu is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', away);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const menu = useRef(null);
  const toggle = useRef(null);
  // The current category in the desktop strip is highlighted.
  const catOn = (slug) => path === `/category/${slug}`;

  return (
    <>
      {/* The dim layer behind the open menu. It lives OUTSIDE the header on purpose: the header uses
          backdrop-blur, and a blurred element becomes the containing block of its fixed children. */}
      {open && <div className="fixed inset-0 z-30 bg-black/35 md:hidden" onClick={() => setOpen(false)} aria-hidden="true" />}
      <header className={`sticky top-0 z-[45] bg-gold/95 text-white shadow-md backdrop-blur-md transition-shadow ${scrolled ? 'shadow-[0_6px_24px_-8px_rgba(6,48,31,.6)]' : ''}`}>
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-4">
        <button ref={toggle} className="rounded-full p-2 transition active:scale-90 md:hidden" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
        <Link href="/" className="flex shrink-0 items-center gap-2 font-display text-lg font-extrabold tracking-wide sm:text-2xl" onClick={() => setOpen(false)}>
          <Image referrerPolicy="no-referrer" src="/icons/icon-192.png" alt="" width={34} height={34} className="rounded-lg" priority />
          <span className="hidden min-[380px]:inline">MIZANORA</span>
        </Link>
        {searchForm('s-d', 'hidden flex-1 md:mx-auto md:block md:max-w-2xl')}
        <div className="ml-auto flex items-center gap-1">
          <div className="hidden xl:block"><InstallButton className="!border-white/60 !bg-transparent !px-4 !py-2 text-sm !text-white" /></div>
          <SoundToggle className="text-white" />
          {/* The background music of the shop (Admin > Music). Hidden when no link is set. */}
          <MusicToggle enabled={Boolean(music && music.url)} className="text-white" />
          <Link href="/wishlist" aria-label="Wishlist" className="hidden rounded-full p-2.5 transition hover:bg-white/10 active:scale-90 sm:block"><Heart size={24} /></Link>
          <Link href="/account" aria-label="My account" className="hidden rounded-full p-2.5 transition hover:bg-white/10 active:scale-90 md:block"><UserRound size={25} /></Link>
          <Link href="/cart" aria-label={`Cart, ${count} items`} className="relative rounded-full p-2.5 transition hover:bg-white/10 active:scale-90">
            <ShoppingBag size={25} />
            {count > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-saffron px-1 text-xs font-bold text-[#2B1B00]">{count}</span>}
          </Link>
        </div>
      </div>

      <div className="px-3 pb-2.5 md:hidden">{searchForm('s-m')}</div>

      <nav aria-label="Categories" className="no-sb hidden bg-white text-cream shadow-sm md:block">
        <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 text-sm">
          <li><Link href="/products" className={`block whitespace-nowrap px-3 py-2.5 font-bold text-gold hover:bg-raised ${path === '/products' ? 'bg-raised' : ''}`}>All products</Link></li>
          {categories.slice(0, 12).map((c) => (
            <li key={c.slug}><Link href={`/category/${c.slug}`} className={`block whitespace-nowrap px-3 py-2.5 transition hover:bg-raised hover:text-gold ${catOn(c.slug) ? 'bg-raised font-bold text-gold' : 'text-dim'}`}>{c.name}</Link></li>
          ))}
          <li className="ml-auto"><Link href="/deals" className="block whitespace-nowrap px-3 py-2.5 font-extrabold text-red-600 hover:text-gold">Deals</Link></li>
          <li><Link href="/quran" className="block whitespace-nowrap px-3 py-2.5 font-semibold text-gold hover:text-goldhi">Quran</Link></li>
          <li><Link href="/hadith" className="block whitespace-nowrap px-3 py-2.5 font-semibold text-gold hover:text-goldhi">Hadith</Link></li>
          <li><Link href="/live" className="block whitespace-nowrap px-3 py-2.5 font-semibold text-gold hover:text-goldhi">Live TV</Link></li>
          <li><Link href="/tools" className="block whitespace-nowrap px-3 py-2.5 font-semibold text-gold hover:text-goldhi">Tools</Link></li>
          <li><Link href="/reels" className="block whitespace-nowrap px-3 py-2.5 font-bold text-saffron hover:text-gold">Reels</Link></li>
          <li><Link href="/blog" className="block whitespace-nowrap px-3 py-2.5 font-semibold text-dim hover:text-gold">Shopping blog</Link></li>
          <li><Link href="/track" className="block whitespace-nowrap px-3 py-2.5 text-dim hover:text-gold">Track order</Link></li>
          <li><Link href="/how-to-order" className="block whitespace-nowrap px-3 py-2.5 text-dim hover:text-gold">How to order</Link></li>
          <li><Link href="/contact" className="block whitespace-nowrap px-3 py-2.5 text-dim hover:text-gold">Support</Link></li>
        </ul>
      </nav>

      {/* The mobile menu. It sits inside the bar, so it can never cover the search field. */}
      {open && (
        <nav ref={menu} className="mz-drop max-h-[70vh] overflow-y-auto overscroll-contain bg-white px-4 pb-4 text-cream shadow-2xl md:hidden" aria-label="Mobile">
          {[['/deals', 'Deals: all discounts'], ['/quran', 'Quran: read and listen'], ['/hadith', 'Hadith: read and listen'], ['/live', 'Live TV'], ['/tools', 'Free tools: Zakat, Linux, calculators'], ['/search', 'Search tools, TV, Quran, blog'], ['/reviews', 'Customer reviews'], ['/products', 'All products'], ...categories.map((c) => [`/category/${c.slug}`, c.name]), ['/account', 'My account and orders'], ['/workers', 'Earn: Worker program'], ['/wishlist', 'Wishlist'], ['/track', 'Track order'], ['/reels', 'Reels: watch and shop'], ['/blog', 'Shopping blog'], ['/how-to-order', 'How to order'], ['/about', 'About'], ['/contact', 'Support']].map(([href, label]) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} className={`block border-b border-line py-3.5 text-base transition active:scale-[0.99] ${path === href ? 'font-bold text-gold' : ''}`}>{label}</Link>
          ))}
          <div className="pt-4"><InstallButton full /></div>
        </nav>
      )}
      </header>
    </>
  );
}
