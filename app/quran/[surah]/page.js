import { notFound } from 'next/navigation';
import { pageMeta, breadcrumbJsonLd } from '@/lib/seo';
import { absUrl } from '@/lib/config';
import { PageHead } from '@/components/Prose';
import JsonLd from '@/components/JsonLd';
import QuranReader from '@/components/QuranReader';
import { getQuranConfig, getSurah } from '@/lib/quranServer';
import { RECITERS, TRANSLATIONS, slugOfSurah, surahInfo, SURAHS } from '@/lib/quran';

// /quran/36-ya-sin : one page per surah with the full text (Arabic + translation), a player and the recitation.
export const revalidate = 604800; // a week: the text never changes
export const dynamicParams = true;
export function generateStaticParams() { return []; } // pages are made the first time somebody (or Google) opens them, then kept

const numOf = (slug) => { const n = parseInt(String(slug).split('-')[0], 10); return Number.isInteger(n) && n >= 1 && n <= 114 ? n : 0; };

export async function generateMetadata({ params }) {
  const { surah } = await params;
  const n = numOf(surah);
  if (!n) return {};
  const s = surahInfo(n);
  return pageMeta({
    title: `Surah ${s.name} (${s.n}): Quran with Urdu translation and recitation`,
    description: `Read Surah ${s.name}, ${s.ayat} ayat, with Urdu translation and listen to the recitation ayah by ayah. The ayah on the screen follows the voice. Mizanora Quran.`,
    path: `/quran/${slugOfSurah(n)}`,
  });
}

export default async function SurahPage({ params }) {
  const { surah } = await params;
  const n = numOf(surah);
  if (!n) notFound();
  const cfg = await getQuranConfig();
  const rec = RECITERS.some((r) => r[0] === cfg.reciter) ? cfg.reciter : RECITERS[0][0];
  const tr = TRANSLATIONS.some((r) => r[0] === cfg.translation) ? cfg.translation : 'ur.jalandhry';
  let data = null;
  try { data = await getSurah(n, rec, tr); } catch (e) { console.error('surah page:', e.message); }
  // The text could not be read for the moment: fail this render on purpose. A failed render is never stored (the last good page stays, or the
  // visitor can simply try again), whereas a page saying "not reachable" would have been kept for a whole week.
  if (!data || !data.arOk) throw new Error('quran text unavailable');
  const s = surahInfo(n);
  const crumbs = [['/', 'Home'], ['/quran', 'Quran'], [`/quran/${slugOfSurah(n)}`, `Surah ${s.name}`]];
  const ld = {
    '@context': 'https://schema.org', '@type': 'WebPage', name: `Surah ${s.name}`, url: absUrl(`/quran/${slugOfSurah(n)}`),
    about: { '@type': 'Thing', name: 'The Holy Quran' }, inLanguage: ['ar', 'ur'], isPartOf: { '@id': absUrl('/#website') },
  };
  return (
    <>
      <PageHead title={`Surah ${s.name} (${s.n})`} intro={`${s.ayat} ayat. Listen to the recitation: the ayah on the screen is the ayah being recited.`} crumbs={[['/', 'Home'], ['/quran', 'Quran'], [null, `Surah ${s.name}`]]} />
      <div className="mx-auto max-w-4xl px-3 py-6 sm:px-4">
        {data ? <QuranReader data={data} cfg={cfg} /> : (
          <p className="rounded-2xl bg-raised p-5 text-dim">The Quran service is not reachable right now. Please open this page again in a few minutes.</p>
        )}
        <p className="mt-6 text-xs text-faint">Arabic text: Tanzil.net (Uthmani). Translations and recitation: AlQuran Cloud and Islamic Network. For questions of tafsir and fiqh please ask a qualified scholar.</p>
      </div>
      <JsonLd data={[breadcrumbJsonLd(crumbs), ld]} />
    </>
  );
}
