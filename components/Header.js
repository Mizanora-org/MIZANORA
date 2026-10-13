'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Heart, Menu, ShoppingBag, UserRound, X } from 'lucide-react';
import { useCart } from './CartProvider';
import InstallButton from './InstallButton';
import SearchBox from './SearchBox';

// App-style header: solid brand bar with logo, big search and cart; category strip below on desktop.
export default function Header({ categories = [] }) {
  const [open, setOpen] = useState(false);
  const { count } = useCart();

  const searchForm = (id, cls = '') => <SearchBox id={id} className={cls} categories={categories} />;

  return (
    <header className="sticky top-0 z-40 bg-gold text-white shadow-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 sm:h-16 sm:gap-3 sm:px-4">
        <button className="rounded-full p-2 md:hidden" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
        <Link href="/" className="flex shrink-0 items-center gap-2 font-display text-lg font-extrabold tracking-wide sm:text-2xl" onClick={() => setOpen(false)}>
          <Image src="/icons/icon-192.png" alt="" width={34} height={34} className="rounded-lg" priority />
          <span className="hidden min-[380px]:inline">MIZANORA</span>
        </Link>
        {searchForm('s-d', 'hidden flex-1 md:mx-auto md:block md:max-w-2xl')}
        <div className="ml-auto flex items-center gap-1">
          <div className="hidden xl:block"><InstallButton className="!border-white/60 !bg-transparent !px-4 !py-2 text-sm !text-white" /></div>
          <Link href="/wishlist" aria-label="Wishlist" className="hidden rounded-full p-2.5 hover:bg-white/10 sm:block"><Heart size={24} /></Link>
          <Link href="/account" aria-label="My account" className="hidden rounded-full p-2.5 hover:bg-white/10 md:block"><UserRound size={25} /></Link>
          <Link href="/cart" aria-label={`Cart, ${count} items`} className="relative rounded-full p-2.5 hover:bg-white/10">
            <ShoppingBag size={25} />
            {count > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-saffron px-1 text-xs font-bold text-[#2B1B00]">{count}</span>}
          </Link>
        </div>
      </div>

      <div className="px-3 pb-2.5 md:hidden">{searchForm('s-m')}</div>

      <nav aria-label="Categories" className="hidden bg-white text-cream shadow-sm md:block">
        <ul className="no-sb mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 text-sm">
          <li><Link href="/products" className="block whitespace-nowrap px-3 py-2.5 font-bold text-gold hover:bg-raised">All products</Link></li>
          {categories.slice(0, 12).map((c) => (
            <li key={c.slug}><Link href={`/category/${c.slug}`} className="block whitespace-nowrap px-3 py-2.5 text-dim hover:bg-raised hover:text-gold">{c.name}</Link></li>
          ))}
          <li className="ml-auto"><Link href="/reels" className="block whitespace-nowrap px-3 py-2.5 font-bold text-saffron hover:text-gold">Reels</Link></li>
          <li><Link href="/blog" className="block whitespace-nowrap px-3 py-2.5 font-semibold text-dim hover:text-gold">Shopping blog</Link></li>
          <li><Link href="/track" className="block whitespace-nowrap px-3 py-2.5 text-dim hover:text-gold">Track order</Link></li>
          <li><Link href="/how-to-order" className="block whitespace-nowrap px-3 py-2.5 text-dim hover:text-gold">How to order</Link></li>
          <li><Link href="/contact" className="block whitespace-nowrap px-3 py-2.5 text-dim hover:text-gold">Support</Link></li>
        </ul>
      </nav>

      {open && (
        <nav className="max-h-[70vh] overflow-y-auto bg-white px-4 pb-4 text-cream md:hidden" aria-label="Mobile">
          {[['/products', 'All products'], ...categories.map((c) => [`/category/${c.slug}`, c.name]), ['/account', 'My account and orders'], ['/workers', 'Earn: Worker program'], ['/wishlist', 'Wishlist'], ['/track', 'Track order'], ['/reels', 'Reels: watch and shop'], ['/blog', 'Shopping blog'], ['/how-to-order', 'How to order'], ['/about', 'About'], ['/contact', 'Support']].map(([href, label]) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} className="block border-b border-line py-3.5 text-base">{label}</Link>
          ))}
          <div className="pt-4"><InstallButton full /></div>
        </nav>
      )}
    </header>
  );
}
