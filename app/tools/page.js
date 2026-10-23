import Link from 'next/link';
import { pageMeta } from '@/lib/seo';
import { absUrl } from '@/lib/config';
import { PageHead } from '@/components/Prose';
import JsonLd from '@/components/JsonLd';
import ProductAds from '@/components/ProductAds';
import ToolSearch from '@/components/ToolSearch';
import { TOOLS, TOOL_GROUPS, toolsIn } from '@/lib/tools';

export const metadata = {
  ...pageMeta({ title: 'Free Online Tools: Zakat Calculator, Linux Commands, Marla Converter and more', description: `${TOOLS.length} free online tools in Urdu and English: zakat calculator, Hijri date converter, Qibla finder, tasbih, percentage, discount, EMI, marla and kanal converter, Linux commands cheat sheet, chmod, cron, JSON, Base64, keyword generator. No sign-up.`, path: '/tools' }),
  keywords: ['free online tools', 'zakat calculator pakistan', 'linux commands', 'marla to square feet', 'online calculator', 'hijri date converter', 'qibla direction', 'json formatter', 'keyword generator', 'mizanora tools'],
};
export const revalidate = 3600;

export default function ToolsPage() {
  const ld = { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Mizanora free online tools', itemListElement: TOOLS.map((t, i) => ({ '@type': 'ListItem', position: i + 1, url: absUrl(`/tools/${t.slug}`), name: t.title })) };
  return (
    <>
      <JsonLd data={ld} />
      <PageHead title="Free Online Tools" intro={`${TOOLS.length} free tools that run in your browser. Nothing is uploaded, no sign-up.`} crumbs={[['/', 'Home'], [null, 'Tools']]} />
      <section className="mx-auto max-w-6xl px-4 py-6">
        <ToolSearch tools={TOOLS.map((t) => ({ slug: t.slug, title: t.title, short: t.short, group: t.group, kw: t.keywords.join(' ') }))} />
        {TOOL_GROUPS.map(([g, name, sub]) => (
          <div key={g} id={g} className="scroll-mt-24 pt-8" data-group={g}>
            <h2 className="section-title">{name}</h2><p className="text-sm text-dim">{sub}</p>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {toolsIn(g).map((t) => (
                <li key={t.slug} data-tool={t.slug}><Link href={`/tools/${t.slug}`} className="card card-gold block h-full transition hover:-translate-y-0.5 hover:border-gold"><h3 className="font-extrabold leading-snug">{t.title}</h3><p className="mt-1 text-sm text-dim">{t.short}</p></Link></li>
              ))}
            </ul>
          </div>
        ))}
        <p className="mt-10 text-sm text-dim">Need a tool that is not here? <Link href="/contact" className="font-bold text-gold underline">Tell us</Link> and we will add it. Read our <Link href="/blog" className="font-bold text-gold underline">guides</Link> too.</p>
      </section>
      <ProductAds seed="tools-hub" title="While you are here: shop smart" />
    </>
  );
}
