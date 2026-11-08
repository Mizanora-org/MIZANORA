import Link from 'next/link';
import { Rss } from 'lucide-react';
import { getPosts, postCards, NEWS_CATEGORIES, CATEGORY_LABELS, CATEGORY_BLURBS } from '@/lib/blog';
import { pageMeta, breadcrumbJsonLd } from '@/lib/seo';
import { absUrl } from '@/lib/config';
import { PageHead } from '@/components/Prose';
import JsonLd from '@/components/JsonLd';
import NewsDesk from '@/components/NewsDesk';

// v37: the news desk. World news, science and technology - written for Pakistani readers,
// with the date on everything and the sources named where a number is quoted.
export const revalidate = 1800;

export const metadata = pageMeta({
  title: 'Mizanora News Desk: World, Science and Technology (Pakistan)',
  description: 'World news, science discoveries and technology explained for Pakistan: what happened, what it changes here, and what it means for your money, your phone and your shopping.',
  path: '/news',
});

export default function NewsPage() {
  const posts = getPosts();
  const news = posts.filter((p) => NEWS_CATEGORIES.includes(p.category));
  const cards = postCards().filter((p) => NEWS_CATEGORIES.includes(p.category));

  return (
    <>
      <PageHead
        title="News desk"
        intro="World, science and technology — written for Pakistani readers, dated, and sourced."
        crumbs={[['/', 'Home'], [null, 'News']]}
      />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-dim">
            <b className="text-cream">{news.length} dispatches.</b> No rehashed press releases: each one says what
            happened, why it matters here, and where the number came from.
          </p>
          <Link href="/news/feed.xml" className="btn-ghost"><Rss size={14} /> RSS</Link>
        </div>

        {news.length ? (
          <NewsDesk posts={cards} labels={CATEGORY_LABELS} />
        ) : (
          <p className="rounded-2xl border border-line bg-surface p-6 text-dim">Dispatches are being written. Check back shortly.</p>
        )}

        <section className="mt-10 grid gap-3 sm:grid-cols-3">
          {NEWS_CATEGORIES.map((slug) => {
            const count = news.filter((p) => p.category === slug).length;
            return (
              <Link key={slug} href={`/blog/category/${slug}`} className="card !no-underline">
                <span className="mz-tag">{count} dispatches</span>
                <b className="mt-2 block text-lg text-cream">{CATEGORY_LABELS[slug]}</b>
                <span className="mt-1 block text-sm text-dim">{CATEGORY_BLURBS[slug]}</span>
              </Link>
            );
          })}
        </section>
      </div>
      <JsonLd data={[
        breadcrumbJsonLd([['/', 'Home'], ['/news', 'News']]),
        {
          '@context': 'https://schema.org', '@type': 'CollectionPage',
          name: 'Mizanora news desk', url: absUrl('/news'),
          description: 'World news, science and technology explained for Pakistani readers.',
          mainEntity: { '@type': 'ItemList', numberOfItems: news.length, itemListElement: news.slice(0, 40).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: absUrl(`/blog/${p.slug}`), name: p.title })) },
        },
      ]} />
    </>
  );
}
