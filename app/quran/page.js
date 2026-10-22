import Link from 'next/link';
import { pageMeta, breadcrumbJsonLd } from '@/lib/seo';
import { absUrl } from '@/lib/config';
import { PageHead } from '@/components/Prose';
import JsonLd from '@/components/JsonLd';
import { SURAHS, slugOfSurah } from '@/lib/quran';

export const revalidate = 86400;
export const metadata = pageMeta({
  title: 'Quran: read and listen, all 114 surahs with Urdu translation',
  description: 'Read and listen to the Holy Quran on Mizanora: all 114 surahs, Arabic text, Urdu translation and verse by verse recitation. The ayah on the screen follows the voice.',
  path: '/quran',
});

export default function QuranIndex() {
  const crumbs = [['/', 'Home'], ['/quran', 'Quran']];
  const list = { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: SURAHS.map((s) => ({ '@type': 'ListItem', position: s.n, name: `Surah ${s.name}`, url: absUrl(`/quran/${slugOfSurah(s.n)}`) })) };
  return (
    <>
      <PageHead title="The Holy Quran" intro="Read and listen. Choose a surah: the ayat appear one by one, in step with the recitation, with the Urdu translation." crumbs={[['/', 'Home'], [null, 'Quran']]} />
      <div className="mx-auto max-w-6xl px-3 py-8 sm:px-4">
        <div className="mb-6 flex flex-wrap gap-2">
          {[1, 36, 55, 67, 18, 112].map((n) => (
            <Link key={n} href={`/quran/${slugOfSurah(n)}`} className="btn-gold !px-4 !py-2 text-sm">Surah {SURAHS[n - 1].name}</Link>
          ))}
        </div>
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SURAHS.map((s) => (
            <li key={s.n}>
              <Link href={`/quran/${slugOfSurah(s.n)}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 transition hover:border-gold hover:shadow-md">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gold/10 text-sm font-extrabold text-gold">{s.n}</span>
                <span className="min-w-0"><b className="block truncate text-cream">Surah {s.name}</b><small className="text-faint">{s.ayat} ayat</small></span>
              </Link>
            </li>
          ))}
        </ol>
        <p className="mt-6 text-xs text-faint">Arabic text: Tanzil.net (Uthmani). Translations and recitation: AlQuran Cloud and Islamic Network.</p>
      </div>
      <JsonLd data={[breadcrumbJsonLd(crumbs), list]} />
    </>
  );
}
