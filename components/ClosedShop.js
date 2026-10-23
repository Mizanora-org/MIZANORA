import { SITE } from '@/lib/config';
import { describeHours } from '@/lib/shopHours';
import Link from 'next/link';

// Shown outside the shop hours (v24). Server component: no Firebase, no images. The Quran player is mounted next to it by the layout.
export default function ClosedShop({ hours }) {
  return (
    <main className="grid min-h-[100dvh] place-items-center bg-[#0B6B45] px-5 py-10 text-center text-white">
      <meta name="robots" content="noindex" />
      <div className="mx-auto max-w-md">
        <p className="text-5xl" aria-hidden="true">🌙</p>
        <h1 className="mt-3 text-3xl font-extrabold">{SITE.name} abhi band hai</h1>
        <p className="mt-4 rounded-2xl bg-white/10 p-4 text-base leading-relaxed">{(hours && hours.closedMessage) || 'Dukaan ka waqt khatam ho gaya hai. Tab tak Allah ka kalaam suniye.'}</p>
        <p className="mt-4 text-sm font-semibold text-[#F5B83D]">{describeHours(hours)}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Link className="rounded-full bg-[#F5B83D] px-5 py-3 font-bold text-[#0B6B45]" href="/quran">Quran padhein</Link>
          <Link className="rounded-full bg-white/15 px-5 py-3 font-bold text-white" href="/hadith">Hadees</Link>
          <a className="rounded-full bg-white px-5 py-3 font-bold text-[#0B6B45]" href={`https://wa.me/${SITE.whatsapp}`} rel="noopener noreferrer">WhatsApp</a>
        </div>
        <p className="mt-5 text-xs text-white/75">Aap ke pehle se diye gaye orders mehfooz hain.</p>
      </div>
    </main>
  );
}
