import Link from 'next/link';
import { notFound } from 'next/navigation';
import { pageMeta, faqJsonLd } from '@/lib/seo';
import { absUrl } from '@/lib/config';
import { PageHead } from '@/components/Prose';
import JsonLd from '@/components/JsonLd';
import ProductAds from '@/components/ProductAds';
import ToolRunner from '@/components/tools/ToolRunner';
import { GROUP_BLOG, TOOLS, TOOL_GROUPS, getTool, relatedTools } from '@/lib/tools';
import { getPost } from '@/lib/blog';

export const revalidate = 3600;
export const dynamicParams = false;
export const generateStaticParams = () => TOOLS.map((t) => ({ slug: t.slug }));

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const t = getTool(slug); if (!t) return {};
  return { ...pageMeta({ title: `${t.title} - Free Online`, description: `${t.short} Free, fast, works on mobile, no sign-up. ${t.keywords.slice(0, 4).join(', ')}.`, path: `/tools/${t.slug}` }), keywords: [...t.keywords, 'mizanora', 'free online tool'] };
}

export default async function ToolPage({ params }) {
  const { slug } = await params;
  const t = getTool(slug); if (!t) notFound();
  const group = TOOL_GROUPS.find((g) => g[0] === t.group);
  const post = getPost(GROUP_BLOG[t.group]);
  const ld = [
    { '@context': 'https://schema.org', '@type': 'WebApplication', name: t.title, url: absUrl(`/tools/${t.slug}`), description: t.short, applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any (web browser)', inLanguage: ['en', 'ur'], offers: { '@type': 'Offer', price: '0', priceCurrency: 'PKR' }, keywords: t.keywords.join(', '), isPartOf: { '@id': absUrl('/#org') } },
    faqJsonLd(t.faq),
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [['Home', '/'], ['Tools', '/tools'], [t.title, `/tools/${t.slug}`]].map(([n, u], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: absUrl(u) })) },
  ];
  return (
    <>
      <JsonLd data={ld} />
      <PageHead title={t.title} intro={t.short} crumbs={[['/', 'Home'], ['/tools', 'Tools'], [null, t.title]]} />
      <section className="mx-auto max-w-3xl px-4 py-6">
        <div className="card card-gold"><ToolRunner slug={t.slug} /></div>

        <h2 className="mt-10 font-display text-2xl font-extrabold">Questions and answers</h2>
        <div className="mt-3 space-y-3">{t.faq.map(([q, a]) => <div key={q} className="card"><h3 className="font-bold">{q}</h3><p className="mt-1 text-dim">{a}</p></div>)}</div>

        <h2 className="mt-10 font-display text-2xl font-extrabold">Related tools</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">{relatedTools(t.slug, 6).map((r) => <li key={r.slug}><Link href={`/tools/${r.slug}`} className="block rounded-xl border border-line bg-surface p-3 hover:border-gold"><b className="text-sm">{r.title}</b></Link></li>)}</ul>

        {post && <p className="mt-8 rounded-2xl bg-raised p-4 text-sm">Read more: <Link href={`/blog/${post.slug}`} className="font-bold text-gold underline">{post.title}</Link></p>}
        <p className="mt-6 text-xs text-faint">Searches people use: {t.keywords.join(' · ')}. Group: <Link href={`/tools#${t.group}`} className="underline">{group ? group[1] : 'Tools'}</Link>. This tool works in your browser and does not send your data anywhere.</p>
      </section>
      <ProductAds seed={t.slug} title="Shop smart while you are here" />
    </>
  );
}
