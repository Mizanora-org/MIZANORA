import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPost, getPosts } from '@/lib/blog';
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
  return { ...pageMeta({ title: p.title, description: p.description, path: `/blog/${p.slug}`, type: 'article' }),
    openGraph: { ...pageMeta({ title: p.title, description: p.description, path: `/blog/${p.slug}` }).openGraph, type: 'article', publishedTime: p.date } };
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
  const related = getPosts().filter((x) => x.slug !== p.slug).slice(0, 2);
  const ld = {
    '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, description: p.description,
    datePublished: p.date, dateModified: p.date, wordCount: p.words, inLanguage: 'en',
    image: p.image || absUrl('/img/hero-banner.jpg'), mainEntityOfPage: absUrl(`/blog/${p.slug}`),
    author: { '@type': 'Person', name: p.author || 'Muaaz Iqbal', jobTitle: 'Founder & Developer', url: absUrl('/team'), worksFor: { '@type': 'Organization', name: SITE.name, url: absUrl('/') } },
    publisher: { '@type': 'Organization', name: SITE.name, logo: { '@type': 'ImageObject', url: absUrl('/icons/icon-512.png') } },
  };
  return (
    <>
      <PageHead title={p.title} intro={p.description} crumbs={[['/', 'Home'], ['/blog', 'Blog'], [null, 'Guide']]} />
      <article className="prose-mz mx-auto max-w-3xl px-4 py-8">
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
          <Link key={r.slug} href={`/blog/${r.slug}`} className="card !no-underline"><b className="block text-cream">{r.title}</b><span className="text-sm text-dim">{r.description}</span></Link>
        ))}</div>
      </article>
      <JsonLd data={[ld, breadcrumbJsonLd([['/', 'Home'], ['/blog', 'Blog'], [`/blog/${p.slug}`, p.title]])]} />
    </>
  );
}
