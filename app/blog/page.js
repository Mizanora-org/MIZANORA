import Link from 'next/link';
import { getPosts, postCards, getBlogCategories, CATEGORY_LABELS } from '@/lib/blog';
import { pageMeta, breadcrumbJsonLd } from '@/lib/seo';
import { PageHead } from '@/components/Prose';
import JsonLd from '@/components/JsonLd';
import BlogBrowser from '@/components/BlogBrowser';

export const metadata = pageMeta({
  title: 'Shopping Blog: Online Shopping Guides and Tips for Pakistan',
  description: 'Shopping guides for Pakistan: how to buy online safely, compare prices, choose sizes, save money, sale season tips, cash on delivery, plus the story of Muaaz Iqbal and Mizanora.',
  path: '/blog',
});

export default function BlogIndex() {
  const all = getPosts();
  const cats = getBlogCategories();
  const cards = postCards().map((p) => ({ ...p, categoryLabel: CATEGORY_LABELS[p.category] || p.category }));
  const latest = all.slice(0, 3);

  return (
    <>
      <PageHead title="Mizanora Shopping Blog" intro="Fresh guides and tips for shopping smart and shopping halal in Pakistan." crumbs={[['/', 'Home'], [null, 'Blog']]} />

      <div className="mx-auto max-w-6xl px-4 py-8">
        <p className="mb-6 text-dim">
          <b className="text-cream">{all.length} guides</b> — written for Pakistani shoppers, workers and small shop owners.
          Everything here is free, and every guide links to the next one you will need.
        </p>

        {/* Fresh on the blog - the three newest guides get real links right at the top. */}
        <section aria-labelledby="fresh" className="mb-8 rounded-3xl border border-line bg-surface p-5">
          <h2 id="fresh" className="section-title mb-3">New this week</h2>
          <ul className="grid gap-2 sm:grid-cols-3">
            {latest.map((p) => (
              <li key={p.slug}>
                <Link href={`/blog/${p.slug}`} className="block rounded-2xl bg-raised p-3 !no-underline transition hover:bg-raised/70">
                  <span className="mz-tag">{CATEGORY_LABELS[p.category] || p.category}</span>
                  <b className="mt-2 block text-cream">{p.title}</b>
                  <span className="mt-1 block text-xs text-faint">{p.date} · {p.mins} min read</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Category shelves: one page per topic, so Google has a hub to crawl for each. */}
        <section aria-labelledby="shelves" className="mb-9">
          <h2 id="shelves" className="section-title mb-3">Browse by topic</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cats.map((c) => (
              <Link key={c.slug} href={`/blog/category/${c.slug}`} className="card !no-underline">
                <span className="mz-tag">{c.count} guides</span>
                <b className="mt-2 block text-lg text-cream">{c.label}</b>
                <span className="mt-1 block text-sm text-dim">{c.blurb}</span>
              </Link>
            ))}
          </div>
        </section>

        <h2 className="section-title mb-3">Every guide</h2>
        <BlogBrowser posts={cards} categories={cats} />
      </div>

      <JsonLd data={[
        breadcrumbJsonLd([['/', 'Home'], ['/blog', 'Blog']]),
        {
          '@context': 'https://schema.org', '@type': 'Blog',
          name: 'Mizanora shopping blog',
          description: 'Shopping guides for Pakistan and the story of Mizanora and its founder, Muaaz Iqbal.',
          blogPost: latest.map((p) => ({ '@type': 'BlogPosting', headline: p.title, description: p.description, datePublished: p.date })),
        },
      ]} />
    </>
  );
}
