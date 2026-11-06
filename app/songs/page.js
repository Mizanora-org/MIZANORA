import Link from 'next/link';
import { ArrowRight, Music2, Radio, Sparkles } from 'lucide-react';
import { pageMeta, breadcrumbJsonLd } from '@/lib/seo';
import { absUrl } from '@/lib/config';
import { PageHead } from '@/components/Prose';
import JsonLd from '@/components/JsonLd';
import SongBrowser from '@/components/SongBrowser';
import { SONG_QUERIES } from '@/lib/songs';
import { getTrendingSongs } from '@/lib/songsServer';

export const revalidate = 1800;

export const metadata = {
  ...pageMeta({
    title: 'Songs: Search & Play Urdu, Hindi and Punjabi Music Online',
    description:
      'Mizanora Songs — search any song, artist or film and play it right here. Atif Aslam, Coke Studio, Arijit Singh, Punjabi hits and more, with artwork, album and duration. Free, no signup.',
    path: '/songs',
  }),
  keywords: ['songs online', 'urdu songs', 'punjabi songs', 'atif aslam songs', 'coke studio songs', 'listen songs free', 'mizanora songs'],
};

export default async function SongsPage({ searchParams }) {
  const sp = await searchParams;
  const initialQuery = String((sp && sp.q) || '').slice(0, 80).trim();
  const trending = await getTrendingSongs(24).catch(() => []);

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Songs on Mizanora',
    description: 'Search and play songs online — Urdu, Hindi, Punjabi and world music.',
    url: absUrl('/songs'),
    hasPart: trending.slice(0, 12).map((s) => ({
      '@type': 'MusicRecording',
      name: s.title,
      url: absUrl(`/songs/${s.slug}`),
      byArtist: (s.artists || []).map((name) => ({ '@type': 'MusicGroup', name })),
      ...(s.duration ? { duration: `PT${Math.floor(s.duration / 60)}M${s.duration % 60}S` } : {}),
    })),
  };

  return (
    <>
      <JsonLd data={[ld, breadcrumbJsonLd([['/', 'Home'], ['/songs', 'Songs']])]} />
      <PageHead
        title="Songs"
        intro="Koi bhi gaana search karein — Urdu, Hindi, Punjabi, Coke Studio — aur wahin sunne lagein. Artwork, artist, album aur duration ke saath."
        crumbs={[['/', 'Home'], [null, 'Songs']]}
      />

      <section className="mx-auto max-w-7xl px-3 sm:px-4">
        <div className="overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-[#0B6B45] via-[#0B6B45] to-[#13293d] p-5 text-white shadow-sm sm:p-7">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[0.7rem] font-extrabold uppercase tracking-wider">
            <Sparkles size={12} /> Music · v54
          </p>
          <h2 className="mt-3 max-w-2xl font-display text-2xl font-extrabold leading-tight sm:text-4xl">
            Har gaana, ek hi jagah — <span className="text-[#F5B83D]">search karein aur sunne lagein</span>
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-white/85 sm:text-base">
            {trending.length > 0
              ? `${trending.length}+ tracks abhi tayyar hain — neeche search box se apni pasand ka gaana, artist ya film likhein.`
              : 'Neeche search box se apni pasand ka gaana, artist ya film likhein.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-[0.72rem] font-bold">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1"><Music2 size={12} /> Urdu · Hindi · Punjabi</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1"><Radio size={12} /> 320kbps jahan available</span>
            <Link href="/live" className="inline-flex items-center gap-1 rounded-full bg-[#F5B83D] px-3 py-1 text-[#2B1B00]">
              Live TV <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </section>

      <div className="pt-6 pb-24">
        <SongBrowser initialSongs={trending} topics={SONG_QUERIES} initialQuery={initialQuery} />
      </div>
    </>
  );
}
