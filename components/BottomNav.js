'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Clapperboard, Home, Music4, ShoppingBag, Tv } from 'lucide-react';
import { useCart } from './CartProvider';

// Phone-app style tab bar. Hidden on desktop and on /admin.
// The Reels tab opens the reels in a RANDOM order. Tapping it again while already on Reels mixes them again.
//
// v18 fixes:
//   * the cart number now sits on the icon (before it floated over the middle of the icon)
//   * "Shop" also lights up on the category pages, not only on /products
//   * the active tab gets a soft pill, so the bar reads at a glance
export default function BottomNav() {
  const path = usePathname() || '/';
  const { count } = useCart();
  if (path.startsWith('/admin')) return null;

  // match: the extra paths that should also light the tab up.
  // v57: this is the app's real navigation now — a media app's tabs, not a blog's.
  // Home · Movies · Songs · Quran · Live TV · Shop (with the cart badge).
  const tabs = [
    { href: '/', label: 'Home', Icon: Home },
    { href: '/movies', label: 'Movies', Icon: Clapperboard, match: ['/movies/world', '/movies/calendar', '/movies/actors', '/movies/actor/'] },
    { href: '/songs', label: 'Songs', Icon: Music4, match: ['/songs/artist/'] },
    { href: '/quran', label: 'Quran', Icon: BookOpen, match: ['/hadith', '/islamic'] },
    { href: '/live', label: 'Live', Icon: Tv, match: ['/live-channel'] },
    { href: '/products', label: 'Shop', Icon: ShoppingBag, match: ['/category/', '/product/', '/cart', '/deals'] },
  ];


  const on = (t) => (t.href === '/' ? path === '/' : path.startsWith(t.href) || (t.match || []).some((m) => path.startsWith(m)));
  const again = (href) => {
    if (href === '/reels' && path === '/reels') window.dispatchEvent(new Event('mz-reels-shuffle'));
  };

  return (
    <nav aria-label="App menu" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(18,32,26,.08)] backdrop-blur-md md:hidden">
      <ul className="grid grid-cols-6">
        {tabs.map((t) => {
          const active = on(t);
          const { href, label, Icon } = t;
          return (
            <li key={href}>
              <Link href={href} onClick={() => again(href)} aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center gap-0.5 py-2 text-[0.66rem] font-semibold transition ${active ? 'text-gold' : href === '/reels' ? 'text-saffron' : 'text-faint'}`}>
                {/* the icon sits in its own box, so the cart number can sit on its corner */}
                <span className={`relative grid place-items-center rounded-full px-2.5 py-0.5 transition ${active ? 'bg-gold/10' : href === '/reels' && !active ? 'bg-saffron/15' : ''}`}>
                  <Icon size={21} strokeWidth={active ? 2.5 : 2} />
                  {href === '/products' && count > 0 && (
                    <span className="absolute -right-0.5 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-saffron px-1 text-[0.6rem] font-bold text-[#2B1B00] shadow-sm">{count}</span>
                  )}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
