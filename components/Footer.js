import Link from 'next/link';
import { SITE } from '@/lib/config';
import { SOCIAL_ICONS } from './Icons';
import FxToggle from './FxToggle';

export default function Footer({ categories = [] }) {
  const socials = SITE.social.filter((s) => s.url);
  return (
    <footer className="no-print mt-16 bg-surface pb-28 md:pb-10">
      <div className="mz-band" aria-hidden="true" />
      <p lang="ar" dir="rtl" className="font-arabic pt-6 text-center text-2xl text-gold">بِسْمِ اللَّهِ تَوَكَّلْنَا عَلَى اللَّهِ</p>
      <p className="text-center text-xs text-faint">Jazakallah khair for shopping with Mizanora</p>
      <FxToggle />
      <div className="mb-8" />
      <div className="mx-auto grid max-w-7xl gap-8 border-t border-line px-4 pt-10 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <p className="font-display text-2xl font-bold tracking-[0.14em]">MIZANORA</p>
          <p className="mt-3 max-w-sm text-sm text-dim">{SITE.tagline} A Pakistani online store built on honest dealing. Cash on delivery across Pakistan. WhatsApp support is always here to help.</p>
          <div className="mt-4 flex gap-3">
            {socials.map((s) => {
              const Icon = SOCIAL_ICONS[s.id];
              return <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="grid h-10 w-10 place-items-center rounded-full bg-raised text-gold hover:bg-line"><Icon size={20} /></a>;
            })}
          </div>
        </div>
        <FooterCol title="Shop" links={[['/products', 'All products'], ...categories.slice(0, 5).map((c) => [`/category/${c.slug}`, c.name]), ['/cart', 'Cart']]} />
        <FooterCol title="Help" links={[['/workers', 'Earn with Mizanora'], ['/reels', 'Reels'], ['/account', 'My account'], ['/track', 'Track order'], ['/wishlist', 'Wishlist'], ['/how-to-order', 'How to order'], ['/faq', 'FAQ'], ['/returns', 'Returns'], ['/contact', 'Contact support'], ['/connect', 'Official accounts']]} />
        <FooterCol title="Company" links={[['/about', 'About us'], ['/blog', 'Blog'], ['/privacy-policy', 'Privacy policy'], ['/terms', 'Terms of use']]} />
      </div>
      <p className="mx-auto mt-8 max-w-7xl border-t border-line px-4 pt-5 text-xs text-faint">© {new Date().getFullYear()} Mizanora, {SITE.city}.</p>
    </footer>
  );
}

function FooterCol({ title, links }) {
  return (
    <div>
      <h2 className="mb-3 font-sans text-sm font-semibold text-cream">{title}</h2>
      <ul className="space-y-2">
        {links.map(([href, label]) => <li key={href}><Link href={href} className="text-sm text-dim hover:text-gold">{label}</Link></li>)}
      </ul>
    </div>
  );
}
