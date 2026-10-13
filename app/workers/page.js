import Link from 'next/link';
import { BadgePercent, Banknote, Link2, ShieldCheck, TrendingUp, UserCheck } from 'lucide-react';
import { pageMeta, breadcrumbJsonLd, faqJsonLd } from '@/lib/seo';
import { PageHead } from '@/components/Prose';
import JsonLd from '@/components/JsonLd';
import { MIN_PAYOUT, REF_DAYS, TIERS } from '@/lib/workers';
import { formatPKR } from '@/lib/format';

export const metadata = pageMeta({
  title: 'Mizanora Worker Program: Earn 10% to 50% Commission on Delivered Orders',
  description: 'Join the Mizanora Worker Program in Pakistan. Share product links on WhatsApp and Facebook, earn 10% to 50% commission on delivered orders, and withdraw to JazzCash, Easypaisa or bank.',
  path: '/workers',
});

const FAQ = [
  ['Do I need money to join?', 'No. Joining is free. You need a Mizanora account, your CNIC and a phone. You never buy stock and you never handle parcels or cash.'],
  ['When do I get paid?', `Your commission becomes ready when the customer receives the order. You can then request a payout of ${formatPKR(MIN_PAYOUT)} or more to JazzCash, Easypaisa or your bank account.`],
  ['What if the order is cancelled or returned?', 'Cancelled and returned orders earn no commission. That is why a good delivery rate raises your level.'],
  ['Why do you need my CNIC?', 'To confirm every worker is a real adult and to stop fake accounts. The photos are stored privately and only the Mizanora admin can see them.'],
  ['How does the level system work?', 'Everyone starts at 10%. As more of your orders are delivered and your delivery rate stays high, you move up to 20%, 30%, 40% and 50%. Higher levels also unlock more expensive products.'],
  ['Can I set my own profit?', 'Yes, at the Elite level (50%) you can add your own profit on a product, up to 50% of its price. Customers who order through your link pay the shop price plus your profit.'],
];

export default function WorkersPage() {
  return (
    <>
      <PageHead title="Earn with Mizanora: the Worker Program" intro="Share products you like, earn commission on every delivered order. No investment, no stock, no parcels." crumbs={[['/', 'Home'], [null, 'Worker program']]} />
      <div className="mx-auto max-w-4xl space-y-10 px-4 py-8">
        <div className="flex flex-wrap gap-3"><Link href="/worker" className="btn-gold">Join as a worker</Link><Link href="/blog" className="btn-ghost">Read worker guides</Link></div>

        <section aria-labelledby="how">
          <h2 id="how" className="section-title mb-4">How it works</h2>
          <ol className="grid gap-3 sm:grid-cols-2">
            {[[UserCheck, 'Apply', 'Create a Mizanora account, send your CNIC and selfie. We check within 1 to 2 days.'], [Link2, 'Share', `Get your own link. Anyone who orders within ${REF_DAYS} days of opening it counts for you.`], [TrendingUp, 'Earn', 'Commission is added for every order. It becomes payable once the order is delivered.'], [Banknote, 'Withdraw', `Request a payout of ${formatPKR(MIN_PAYOUT)} or more to JazzCash, Easypaisa or bank.`]].map(([Icon, t, d], n) => (
              <li key={t} className="card flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold/10 text-gold"><Icon size={20} /></span><span><b className="block">{n + 1}. {t}</b><span className="text-dim">{d}</span></span></li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="levels">
          <h2 id="levels" className="section-title mb-2">Levels and commission</h2>
          <p className="mb-4 text-dim">Small workers start with cheaper products. As your delivered orders grow, your commission and the price of products you can earn on both grow.</p>
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="bg-raised text-dim"><tr><th className="p-3">Level</th><th className="p-3">Commission</th><th className="p-3">Products up to</th><th className="p-3">Needs</th></tr></thead>
              <tbody>{TIERS.map((t) => (
                <tr key={t.key} className="border-t border-line"><td className="p-3 font-bold">{t.name}</td><td className="p-3 font-extrabold text-gold">{t.rate}%</td><td className="p-3">{t.maxPrice ? formatPKR(t.maxPrice) : 'Any price + own profit'}</td><td className="p-3 text-dim">{t.needs.delivered ? `${t.needs.delivered} delivered, ${t.needs.rate}% delivery rate` : 'Just join'}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-faint">Commission is a percentage of the product price. Orders that use a promo code, and orders placed by the worker for themselves, do not earn commission.</p>
        </section>

        <section aria-labelledby="why" className="grid gap-3 sm:grid-cols-3">
          <h2 id="why" className="sr-only">Why join</h2>
          {[[ShieldCheck, 'Verified and fair', 'Every worker is verified. Earnings are tracked automatically per order.'], [BadgePercent, 'Free marketing kit', 'Download product photos and videos and copy ready captions.'], [Banknote, 'Pay on delivery model', 'Customers pay cash on delivery, so they trust your link more.']].map(([Icon, t, d]) => (
            <div key={t} className="card"><Icon className="text-gold" size={24} /><p className="mt-2 font-bold">{t}</p><p className="text-sm text-dim">{d}</p></div>
          ))}
        </section>

        <section aria-labelledby="faq">
          <h2 id="faq" className="section-title mb-3">Questions</h2>
          <div className="space-y-2">{FAQ.map(([q, a]) => <details key={q} className="card !p-4"><summary className="cursor-pointer font-bold">{q}</summary><p className="mt-2 text-dim">{a}</p></details>)}</div>
        </section>

        <p className="text-sm text-dim">Earnings depend on your own effort and are never guaranteed. Please promote honestly and never spam.</p>
        <Link href="/worker" className="btn-gold">Apply now</Link>
      </div>
      <JsonLd data={[breadcrumbJsonLd([['/', 'Home'], ['/workers', 'Worker program']]), faqJsonLd(FAQ)]} />
    </>
  );
}
