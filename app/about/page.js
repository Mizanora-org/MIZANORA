import Link from 'next/link';
import { SITE } from '@/lib/config';
import { pageMeta, breadcrumbJsonLd } from '@/lib/seo';
import { PageHead, Prose } from '@/components/Prose';
import JsonLd from '@/components/JsonLd';
import { CREDIT, FOUNDER } from '@/lib/team';

export const metadata = pageMeta({
  title: 'About Mizanora, a Halal-Minded Pakistani Store',
  description: 'Mizanora is a Pakistani online store built on honest dealing, clear prices and friendly WhatsApp support. Learn what we stand for.',
  path: '/about',
});

export default function About() {
  return (
    <>
      <PageHead title="About Mizanora" intro="Quality products, honest dealing, and a real conversation before every order." crumbs={[['/', 'Home'], [null, 'About']]} />
      <Prose>
        <h2>Who we are</h2>
        <p>Mizanora is a Pakistani online store based in {SITE.city}. We sell quality products and deliver across Pakistan. Our name is our promise: <em>mizan</em> means balance and fairness.</p>
        <h2>How we work</h2>
        <p>You choose a product and place your order in one short form. You pay cash on delivery. Before we dispatch, we confirm the order with you by phone or message, so there are no surprises. If you need help at any time, our WhatsApp support team is there for you.</p>
        <h2>What we stand for</h2>
        <ul>
          <li><strong>Honest descriptions.</strong> Products are described as they are.</li>
          <li><strong>Price before commitment.</strong> You always know the full cost first.</li>
          <li><strong>Respect for your time.</strong> Real replies, not automated runarounds.</li>
          <li><strong>Halal-minded trade.</strong> We avoid anything clearly haram and deal fairly. Read our <Link href="/blog/what-is-halal-shopping">halal shopping guide</Link>.</li>
        </ul>
        <h2>Who built Mizanora</h2>
        <p>Mizanora is built and maintained by <strong>{FOUNDER.name}</strong> - {FOUNDER.role}. He wrote the website, the phone-friendly design, the Urdu and English voice assistant <em>Noor</em>, the worker programme and the file-based catalogue that keeps the shop working even on a day the free database limit is finished. The rest of the team (support, dispatch, catalogue and workers) is on the <Link href="/team">team page</Link>.</p>
        <p className="text-sm text-faint">{CREDIT}</p>
        <h2>Find us</h2>
        <p>See all our <Link href="/connect">official accounts</Link>, or go to the <Link href="/contact">contact page</Link>.</p>
      </Prose>
      <JsonLd data={breadcrumbJsonLd([['/', 'Home'], ['/about', 'About']])} />
    </>
  );
}
