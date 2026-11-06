import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Disc3, Mic2, Music2, Play } from 'lucide-react';
import { pageMeta, breadcrumbJsonLd } from '@/lib/seo';
import { absUrl } from '@/lib/config';
import JsonLd from '@/components/JsonLd';
import SongBrowser from '@/components/SongBrowser';
import { artistNameFromSlug, artistSlug, clockTime } from '@/lib/songs';
import { getArtistSongs, getTrendingArtists } from '@/lib/songsServer';

export const revalidate = 3600;

const titleCase = (slug) => artistNameFromSlug(slug);

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const name = titleCase(slug);
  return {
    ...pageMeta({
      title: `${name} Songs — Listen Online | Mizanora`,
      description: `Listen to the best of ${name} on Mizanora: top songs, latest tracks and albums, streamed in the Mizanora player. Free, no signup.`,
      path: `/songs/artist/${slug}`,
    }),
    keywords: [`${name} songs`, `${name} new song`, `${name} hits`, 'listen songs online', 'mizanora songs'],
  };
}

export default async function ArtistPage({ params }) {
  const { slug } = await params;
  if (!slug || slug.length > 80) notFound();
  const name = titleCase(slug);

  const [{ items }, trendingArtists] = await Promise.all([
    getArtistSongs(name, 30).catch(() => ({ items: [] })),
    getTrendingArtists(10).catch(() => []),
  ]);
  if (!items.length) {
    // No catalogue answer (mirror down) — still show a real page, never a bare 404.
    return (
      <>
        <div className="mx-auto max-w-3xl px-4 py-14 text-center">
          <p className="text-xs font-extrabold uppercase tracking-wider text-gold">Singer</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold text-cream">{name}</h1>
          <p className="mt-3 text-sm leading-7 text-dim">
            Music catalogue abhi jawab nahi de rahi, is liye {name} ke gaane load nahi ho sake. Thori dair baad page
            refresh karein — ya Mizanora songs search se seedha try karein.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/songs" className="rounded-full bg-gold px-4 py-2 text-sm font-extrabold text-white">Songs search</Link>
            <Link href={`/songs?q=${encodeURIComponent(name)}`} className="rounded-full border border-line px-4 py-2 text-sm font-bold text-dim hover:border-gold hover:text-gold">Try “{name}”</Link>
          </div>
        </div>
        {trendingArtists.length > 0 && (
          <section className="mx-auto max-w-7xl px-3 pb-16 sm:px-4">
            <h2 className="font-display text-lg font-extrabold text-cream">Popular singers</h2>
            <ArtistStrip artists={trendingArtists} />
          </section>
        )}
      </>
    );
  }

  const cover = items[0].image || '';
  const artists = items.flatMap((s) => s.artists || []);
  const featured = [...new Set(artists)].filter((a) => artistSlug(a) === slug || artistSlug(a).includes(slug)).slice(0, 3);

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'MusicGroup',
    name,
    url: absUrl(`/songs/artist/${slug}`),
    ...(cover ? { image: cover } : {}),
    ...(items.length ? { track: items.slice(0, 12).map((s) => ({ '@type': 'MusicRecording', name: s.title, url: absUrl(`/songs/${s.slug}`) })) } : {}),
  };
  const listLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${name} songs`,
    itemListElement: items.slice(0, 20).map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: s.title,
      url: absUrl(`/songs/${s.slug}`),
    })),
  };

  return (
    <>
      <JsonLd data={[ld, listLd, breadcrumbJsonLd([['/', 'Home'], ['/songs', 'Songs'], [`/songs/artist/${slug}`, name]])]} />

      <div className="mx-auto max-w-7xl px-3 pt-4 sm:px-4">
        <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1.5 text-xs font-bold text-faint">
          <Link href="/" className="hover:text-gold">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href="/songs" className="hover:text-gold">Songs</Link>
          <span aria-hidden="true">/</span>
          <span className="line-clamp-1 text-dim">{name}</span>
        </nav>
      </div>

      <section className="mx-auto max-w-7xl px-3 sm:px-4">
        <div className="flex flex-col gap-5 overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-[#0B6B45] via-[#0B6B45] to-[#13293d] p-5 text-white shadow-sm sm:flex-row sm:items-center sm:p-7">
          <div className="h-32 w-32 shrink-0 overflow-hidden rounded-full border-4 border-white/25 bg-black/20 sm:h-40 sm:w-40">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover} alt={name} className="h-full w-full object-cover" />
            ) : <span className="grid h-full w-full place-items-center"><Mic2 size={40} /></span>}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.18em] text-[#F5B83D]">Singer · Artist</p>
            <h1 className="mt-1 font-display text-3xl font-extrabold leading-tight sm:text-4xl">{name}</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/85">
              {items.length} tracks · {featured.length ? featured.join(', ') : name} · Mizanora player mein seedha play karein.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-extrabold">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1"><Music2 size={12} /> {items.length} songs</span>
              {items[0].album && <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1"><Disc3 size={12} /> {items[0].album}</span>}
              <Link href={`/songs?q=${encodeURIComponent(name)}`} className="inline-flex items-center gap-1 rounded-full bg-[#F5B83D] px-3 py-1 text-[#2B1B00]">
                Search more <ArrowRight size={12} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="pt-6 pb-20">
        <SongBrowser initialSongs={items} topics={[name, 'Latest', 'Hits']} initialQuery="" />
      </div>

      <section className="mx-auto max-w-7xl px-3 pb-16 sm:px-4">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-gold">Top tracks</p>
            <h2 className="section-title">{name} ke mashhoor gaane</h2>
          </div>
          <Link href="/songs" className="inline-flex items-center gap-1 text-xs font-extrabold text-gold hover:underline">All songs <ArrowRight size={13} /></Link>
        </div>
        <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {items.slice(0, 15).map((s, i) => (
            <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="w-6 text-center text-xs font-extrabold tabular-nums text-faint">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <Link href={`/songs/${s.slug}`} className="line-clamp-1 text-sm font-extrabold text-cream hover:text-gold">{s.title}</Link>
                <p className="line-clamp-1 text-[0.68rem] font-semibold text-dim">{(s.artists || []).join(', ')}{s.album ? ` · ${s.album}` : ''}</p>
              </div>
              <span className="text-[0.65rem] font-bold tabular-nums text-faint">{clockTime(s.duration)}</span>
              <Link href={`/songs/${s.slug}`} aria-label={`Open ${s.title}`} className="rounded-full p-1.5 text-gold hover:bg-raised"><Play size={14} fill="currentColor" /></Link>
            </li>
          ))}
        </ol>
      </section>

      {trendingArtists.filter((a) => a.slug !== slug).length > 0 && (
        <section className="mx-auto max-w-7xl px-3 pb-16 sm:px-4">
          <h2 className="font-display text-lg font-extrabold text-cream">More singers to explore</h2>
          <ArtistStrip artists={trendingArtists.filter((a) => a.slug !== slug)} />
        </section>
      )}
    </>
  );
}

function ArtistStrip({ artists }) {
  return (
    <div className="no-sb mt-3 flex gap-3 overflow-x-auto pb-2">
      {artists.map((a) => (
        <Link key={a.slug} href={`/songs/artist/${a.slug}`} className="w-24 shrink-0 text-center">
          <span className="mx-auto block h-20 w-20 overflow-hidden rounded-full border border-line bg-raised">
            {a.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
            ) : <span className="grid h-full w-full place-items-center text-gold"><Mic2 size={20} /></span>}
          </span>
          <span className="mt-1.5 block truncate text-[0.7rem] font-extrabold text-cream hover:text-gold">{a.name}</span>
        </Link>
      ))}
    </div>
  );
}
