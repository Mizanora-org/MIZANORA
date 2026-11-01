import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPost, getPosts, relatedPosts, CATEGORY_LABELS } from '@/lib/blog';
import { absUrl, SITE } from '@/lib/config';
import { pageMeta, breadcrumbJsonLd } from '@/lib/seo';
import { PageHead } from '@/components/Prose';
import JsonLd from '@/components/JsonLd';

export const dynamicParams = false;
export const generateStaticParams = () => getPosts().map((p) => ({ slug: p.slug }));

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const p = getPost(slug);
  if (!p) return {};
  const image = p.image || undefined; // v36: a guide with a picture shares a real preview card
  return { ...pageMeta({ title: p.title, description: p.description, path: `/blog/${p.slug}`, type: 'article', ...(image ? { image } : {}) }),
    openGraph: { ...pageMeta({ title: p.title, description: p.description, path: `/blog/${p.slug}`, ...(image ? { image } : {}) }).openGraph, type: 'article', publishedTime: p.date, ...(image ? { images: [{ url: image }] } : {}) },
    ...(p.tagList && p.tagList.length ? { keywords: p.tagList.join(', ') } : {}) };
}

function Cta() {
  return (
    <div className="my-8 rounded-2xl border border-bronze bg-surface p-6 text-center">
      <p className="font-display text-2xl font-semibold">Ready to order?</p>
      <p className="mt-1 text-dim">Pay cash on delivery anywhere in Pakistan.</p>
      <Link href="/products" className="btn-gold mt-4">Shop products</Link>
    </div>
  );
}

export default async function BlogPost({ params }) {
  const { slug } = await params;
  const p = getPost(slug);
  if (!p) notFound();
  const [before, after] = p.html.split('<!--cta-->');
  // v36: guides that really belong together (same topic / shared tags), not just the newest two.
  const related = relatedPosts(p, 3);
  const catLabel = CATEGORY_LABELS[p.category] || p.category;
  const ld = {
    '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, description: p.description,
    datePublished: p.date, dateModified: p.date, wordCount: p.words, inLanguage: 'en',
    image: p.image ? (p.image.startsWith('http') ? p.image : absUrl(p.image)) : absUrl('/img/hero-banner.jpg'),
    mainEntityOfPage: absUrl(`/blog/${p.slug}`),
    articleSection: catLabel, ...(p.tagList && p.tagList.length ? { keywords: p.tagList.join(', ') } : {}),
    author: { '@type': 'Person', name: p.author || 'Muaaz Iqbal', jobTitle: 'Founder & Developer', url: absUrl('/team'), worksFor: { '@type': 'Organization', name: SITE.name, url: absUrl('/') } },
    publisher: { '@type': 'Organization', name: SITE.name, logo: { '@type': 'ImageObject', url: absUrl('/icons/icon-512.png') } },
  };
  return (
    <>
      <PageHead title={p.title} intro={p.description} crumbs={[['/', 'Home'], ['/blog', 'Blog'], [null, 'Guide']]} />
      <article className="prose-mz mx-auto max-w-3xl px-4 py-8">
        <p className="mb-4 text-sm text-faint">
          <Link href={`/blog/category/${p.category}`} className="mz-tag !no-underline">{catLabel}</Link>
        </p>
        <p className="mb-6 text-sm text-faint">Published {p.date} · {p.mins} min read · By <b className="text-dim">{p.author || 'Muaaz Iqbal'}</b>, Founder &amp; Developer · <Link href="/team" className="font-semibold text-gold underline underline-offset-4">team page</Link></p>
        {p.heads.length > 2 && (
          <nav aria-label="In this guide" className="mb-8 rounded-2xl border border-line bg-surface p-4">
            <p className="mb-2 font-display text-xl font-semibold">In this guide</p>
            <ol className="!mb-0 text-sm">{p.heads.map((h) => <li key={h.id}><a href={`#${h.id}`} className="!no-underline">{h.text}</a></li>)}</ol>
          </nav>
        )}
        <div dangerouslySetInnerHTML={{ __html: before }} />
        <Cta />
        {after && <div dangerouslySetInnerHTML={{ __html: after }} />}
        <h2>Keep reading</h2>
        <div className="grid gap-3">{related.map((r) => (
          <Link key={r.slug} href={`/blog/${r.slug}`} className="card !no-underline">
            <span className="mz-tag">{CATEGORY_LABELS[r.category] || r.category}</span>
            <b className="mt-2 block text-cream">{r.title}</b>
            <span className="text-sm text-dim">{r.description}</span>
          </Link>
        ))}</div>
        <p className="mt-4 text-sm"><Link href={`/blog/category/${p.category}`} className="font-semibold text-gold underline underline-offset-4">Every {catLabel} guide →</Link></p>
      </article>
      <JsonLd data={[ld, breadcrumbJsonLd([['/', 'Home'], ['/blog', 'Blog'], [`/blog/category/${p.category}`, catLabel], [`/blog/${p.slug}`, p.title]])]} />
    </>
  );
}
