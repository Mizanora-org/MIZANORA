import Link from 'next/link';
import { Activity, ArrowRight, Eye, Users } from 'lucide-react';
import { pageMeta, breadcrumbJsonLd } from '@/lib/seo';
import { PageHead } from '@/components/Prose';
import JsonLd from '@/components/JsonLd';
import PublicStats from '@/components/PublicStats';

// v37: a public window into how the shop is doing. Open numbers build more trust than a badge:
// anyone can see how many people are here and which guides are read most.
//
// Privacy is the whole design: /api/stats returns TOTALS only. No visitor ids, no presence
// records, no order data, no search words - the admin dashboard keeps those behind a sign-in.
export const revalidate = 60;

export const metadata = pageMeta({
  title: 'Mizanora live stats: visitors, traffic and most-read guides',
  description: 'Open numbers from the Mizanora shop: how many people are on the site right now, 14 days of traffic, and the guides Pakistan reads most. Totals only - no personal data.',
  path: '/stats',
});

export default function StatsPage() {
  return (
    <>
      <PageHead
        title="Live stats"
        intro="Open numbers from the shop: who is here now, 14 days of traffic, and what people read most."
        crumbs={[['/', 'Home'], [null, 'Stats']]}
      />
      <div className="mx-auto max-w-5xl px-4 py-8">
        <PublicStats />

        <section className="mt-10 rounded-2xl border border-line bg-surface p-5">
          <h2 className="flex items-center gap-2 text-lg font-extrabold"><Eye size={18} /> What you can and cannot see here</h2>
          <div className="mt-2 grid gap-4 text-sm text-dim sm:grid-cols-2">
            <div>
              <b className="text-cream">Shown</b>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>How many people are on the site right now</li>
                <li>Page views and visitors per day, last 14 days</li>
                <li>The busiest pages — a path, never a person</li>
                <li>Device split (mobile / tablet / desktop) and where visitors come from</li>
              </ul>
            </div>
            <div>
              <b className="text-cream">Never shown</b>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>Names, phone numbers, addresses or order contents</li>
                <li>Individual visitors, their ids or their pages</li>
                <li>Search words people type (those can hold personal details)</li>
                <li>Anything from the shop&apos;s own dashboard</li>
              </ul>
            </div>
          </div>
          <p className="mt-3 text-xs text-faint">
            Counting skips bots and crawlers, and a browser that asks not to be tracked is never counted.
            Numbers refresh once a minute. Looking for something specific?{' '}
            <Link href="/contact" className="font-semibold text-gold underline underline-offset-4">Ask us on WhatsApp</Link>.
          </p>
        </section>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[['/products', 'Shop everything', ArrowRight], ['/blog', 'Read the guides', Activity], ['/team', 'Who builds this', Users]].map(([href, label, Icon]) => (
            <Link key={href} href={href} className="card flex items-center justify-between !no-underline">
              <b className="text-cream">{label}</b>
              <Icon size={16} className="text-gold" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </div>
      <JsonLd data={breadcrumbJsonLd([['/', 'Home'], ['/stats', 'Stats']])} />
    </>
  );
}
