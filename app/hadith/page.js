import { pageMeta } from '@/lib/seo';
import ProductAds from '@/components/ProductAds';
import { PageHead } from '@/components/Prose';
import HadithReader from '@/components/HadithReader';

// v61: STATIC page (hadith text is bundled, it never changes at runtime). No `revalidate` on purpose: every regeneration is an ISR
// write (Hobby: 200K / 30 days) plus a full origin transfer. Rebuilt on deploy.

export const metadata = pageMeta({
  title: 'Hadith: Sahih Bukhari, Muslim, Abu Dawud, Tirmidhi, Nasai, Ibn Majah',
  description: 'Read the major hadith books in Urdu, English and Arabic: Sahih al-Bukhari, Sahih Muslim, Abu Dawud, Tirmidhi, Nasai, Ibn Majah, Muwatta Malik, Forty Hadith. Search, listen and ask the assistant.',
  path: '/hadith',
});

export default function HadithPage() {
  return (
    <>
      <PageHead title="Hadees" intro="Bari kutub-e-hadees: Bukhari, Muslim, Abu Dawud, Tirmidhi, Nasai, Ibn Majah aur mazeed. Urdu, English aur Arabic mein." crumbs={[['/', 'Home'], [null, 'Hadith']]} />
      <section className="mx-auto max-w-3xl px-4 py-6"><HadithReader /></section>
      <ProductAds seed="hadith" title="Shop on Mizanora" />
    </>
  );
}
