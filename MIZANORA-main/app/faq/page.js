import { FAQ } from '@/lib/faq';
import { pageMeta, faqJsonLd, breadcrumbJsonLd } from '@/lib/seo';
import { PageHead } from '@/components/Prose';
import JsonLd from '@/components/JsonLd';

export const metadata = pageMeta({
  title: 'FAQ: Ordering, Delivery and Payment',
  description: 'Answers to common questions about ordering from Mizanora, cash on delivery, sizes, delivery, returns and installing the app.',
  path: '/faq',
});

export default function FaqPage() {
  return (
    <>
      <PageHead title="Frequently asked questions" intro="Quick answers about ordering, delivery and trust." crumbs={[['/', 'Home'], [null, 'FAQ']]} />
      <div className="mx-auto max-w-3xl px-4 py-8">
        {FAQ.map(([q, a]) => (
          <details key={q} className="mb-2.5 rounded-xl border border-line bg-surface px-4">
            <summary className="cursor-pointer py-3.5 font-semibold">{q}</summary>
            <p className="pb-4 text-dim">{a}</p>
          </details>
        ))}
      </div>
      <JsonLd data={[faqJsonLd(FAQ), breadcrumbJsonLd([['/', 'Home'], ['/faq', 'FAQ']])]} />
    </>
  );
}
