import Link from 'next/link';
import { ArrowRight, Music2, Radio, Sparkles } from 'lucide-react';
import { pageMeta, breadcrumbJsonLd } from '@/lib/seo';
import { absUrl } from '@/lib/config';
import { PageHead } from '@/components/Prose';
import JsonLd from '@/components/JsonLd';
import SongBrowser from '@/components/SongBrowser';
import ResumeListening from '@/components/ResumeListening';
import { SONG_QUERIES, cdnProxy } from '@/lib/songs';
import { getTrendingArtists, getTrendingSongs } from '@/lib/songsServer';
import { ARTIST_PROFILES } from '@/lib/artistProfiles';

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
  const [trending, artists] = await Promise.all([
    getTrendingSongs(24).catch(() => []),
    getTrendingArtists(10).catch(() => []),
  ]);

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

      <ResumeListening />

      {artists.length > 0 && (
        <section className="mx-auto max-w-7xl px-3 pt-6 sm:px-4" aria-labelledby="singers">
          <div className="mb-2 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-gold">Singers</p>
              <h2 id="singers" className="section-title">Popular artists</h2>
            </div>
          </div>
          <div className="no-sb flex gap-3 overflow-x-auto pb-2">
            {artists.map((a) => (
              <Link key={a.slug} href={`/songs/artist/${a.slug}`} className="w-24 shrink-0 text-center">
                <span className="mx-auto block h-20 w-20 overflow-hidden rounded-full border border-line bg-raised">
                  {cdnProxy(a.image) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cdnProxy(a.image)} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                  ) : <span className="grid h-full w-full place-items-center text-gold"><Music2 size={20} /></span>}
                </span>
                <span className="mt-1.5 block truncate text-[0.7rem] font-extrabold text-cream hover:text-gold">{a.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* v57: a stable singers directory — real profiles, so this page has substance even when the
          music mirror is down (search and the browser below still work either way). */}
      <section className="mx-auto max-w-7xl px-3 pt-6 sm:px-4" aria-labelledby="singers-az">
        <div className="mb-2 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-gold">Singers A–Z</p>
            <h2 id="singers-az" className="section-title">Legendary voices</h2>
          </div>
          <Link href="/songs" className="text-xs font-extrabold text-gold hover:underline">All songs</Link>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ARTIST_PROFILES.map((a) => (
            <li key={a.slug}>
              <Link href={`/songs/artist/${a.slug}`} className="flex h-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 transition hover:border-gold">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold/10 text-sm font-extrabold text-gold">
                  {a.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-extrabold text-cream">{a.name}</span>
                  <span className="block truncate text-[0.68rem] font-semibold text-faint">{a.genres.join(' · ')}</span>
                  <span className="block truncate text-[0.66rem] text-dim">{a.knownFor.slice(0, 2).join(', ')}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {trending.length === 0 && (
        <p className="mx-auto mt-4 max-w-7xl rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 sm:mx-3">
          Music mirror se abhi jawab nahi aaya. Search abhi bhi kaam karega (browser khud mirror try karta hai), aur
          aap <Link href="/admin/songs" className="font-extrabold underline">mirror status</Link> dekh sakte hain.
        </p>
      )}

      <div className="pt-6 pb-24">
        <SongBrowser initialSongs={trending} topics={SONG_QUERIES} initialQuery={initialQuery} />
      </div>
    </>
  );
}
