import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBlogCategories, getPostsByCategory, CATEGORY_LABELS, postCards } from '@/lib/blog';
import { pageMeta, breadcrumbJsonLd } from '@/lib/seo';
import { absUrl } from '@/lib/config';
import { PageHead } from '@/components/Prose';
import JsonLd from '@/components/JsonLd';
import BlogBrowser from '@/components/BlogBrowser';

// v36: one hub page per topic. Google can now crawl /blog/category/islamic and find every
// Islamic guide from one address - before, the only way in was the single /blog list.
export const dynamicParams = false;
export const generateStaticParams = () => getBlogCategories().map((c) => ({ slug: c.slug }));

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const cat = getBlogCategories().find((c) => c.slug === slug);
  if (!cat) return {};
  return pageMeta({
    title: `${cat.label} guides — Mizanora blog (${cat.count} articles)`,
    description: cat.blurb || `${cat.count} Mizanora guides about ${cat.label}.`,
    path: `/blog/category/${cat.slug}`,
  });
}

export default async function BlogCategory({ params }) {
  const { slug } = await params;
  const cats = getBlogCategories();
  const cat = cats.find((c) => c.slug === slug);
  if (!cat) notFound();
  const posts = getPostsByCategory(slug);
  const cards = postCards().filter((p) => p.category === slug).map((p) => ({ ...p, categoryLabel: CATEGORY_LABELS[p.category] || p.category }));

  return (
    <>
      <PageHead title={`${cat.label} guides`} intro={cat.blurb} crumbs={[['/', 'Home'], ['/blog', 'Blog'], [null, cat.label]]} />
      <div className="mx-auto max-w-6xl px-4 py-8">
        <nav aria-label="Other topics" className="mb-7 flex flex-wrap gap-2">
          {cats.map((c) => (
            <Link key={c.slug} href={`/blog/category/${c.slug}`} className={`mz-chip${c.slug === slug ? ' is-on' : ''}`}>
              {c.label} <i>{c.count}</i>
            </Link>
          ))}
        </nav>
        <BlogBrowser posts={cards} categories={[]} />
      </div>
      <JsonLd data={[
        breadcrumbJsonLd([['/', 'Home'], ['/blog', 'Blog'], [`/blog/category/${cat.slug}`, cat.label]]),
        {
          '@context': 'https://schema.org', '@type': 'CollectionPage',
          name: `${cat.label} guides`, description: cat.blurb, url: absUrl(`/blog/category/${cat.slug}`),
          mainEntity: { '@type': 'ItemList', numberOfItems: posts.length, itemListElement: posts.slice(0, 50).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: absUrl(`/blog/${p.slug}`), name: p.title })) },
        },
      ]} />
    </>
  );
}
