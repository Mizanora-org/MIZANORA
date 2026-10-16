'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, Clapperboard, Home, LayoutGrid, ShoppingBag, UserRound } from 'lucide-react';
import { useCart } from './CartProvider';

// Phone-app style tab bar. Hidden on desktop and on /admin.
// The Reels tab opens the reels in a RANDOM order. Tapping it again while already on Reels mixes them again.
export default function BottomNav() {
  const path = usePathname() || '/';
  const { count } = useCart();
  if (path.startsWith('/admin')) return null;
  const tabs = [
    ['/', 'Home', Home], ['/products', 'Shop', LayoutGrid], ['/reels', 'Reels', Clapperboard],
    ['/blog', 'Blog', BookOpen], ['/cart', 'Cart', ShoppingBag], ['/account', 'Account', UserRound],
  ];
  const on = (h) => (h === '/' ? path === '/' : path.startsWith(h));
  const again = (href) => {
    if (href === '/reels' && path === '/reels') window.dispatchEvent(new Event('mz-reels-shuffle'));
  };
  return (
    <nav aria-label="App menu" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(18,32,26,.08)] md:hidden">
      <ul className="grid grid-cols-6">
        {tabs.map(([href, label, Icon]) => (
          <li key={href}>
            <Link href={href} onClick={() => again(href)} aria-current={on(href) ? 'page' : undefined}
              className={`relative flex flex-col items-center gap-0.5 py-2 text-[0.66rem] font-semibold ${on(href) ? 'text-gold' : href === '/reels' ? 'text-saffron' : 'text-faint'}`}>
              <span className={`grid place-items-center rounded-full ${href === '/reels' && !on(href) ? 'bg-saffron/15 px-2.5 py-0.5' : ''}`}>
                <Icon size={21} strokeWidth={on(href) ? 2.5 : 2} />
              </span>
              {label}
              {href === '/cart' && count > 0 && <span className="absolute right-[24%] top-1 grid h-4 min-w-4 place-items-center rounded-full bg-saffron px-1 text-[0.65rem] font-bold text-[#2B1B00]">{count}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
