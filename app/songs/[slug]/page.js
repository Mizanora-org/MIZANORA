import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Music2, ShieldCheck, Disc3 } from 'lucide-react';
import { pageMeta, breadcrumbJsonLd } from '@/lib/seo';
import { absUrl } from '@/lib/config';
import JsonLd from '@/components/JsonLd';
import SongDetailPlayer from '@/components/SongDetailPlayer';
import SongDirectLoader from '@/components/SongDirectLoader';
import { songIdFromSlug, clockTime, artistSlug, SONG_QUERIES } from '@/lib/songs';
import { getSongById, searchSongs, getTrendingSongs } from '@/lib/songsServer';

export const revalidate = 3600;

async function load(slug) {
  const id = songIdFromSlug(slug);
  if (!id) return null;
  return getSongById(id).catch(() => null);
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const song = await load(slug);
  if (!song) {
    return pageMeta({ title: 'Song not found', path: `/songs/${slug}`, noindex: true });
  }
  const artists = (song.artists || []).join(', ') || 'Mizanora';
  return {
    ...pageMeta({
      title: `${song.title} — ${artists} | Full Song Online`,
      description: `Listen to ${song.title} by ${artists}${song.album ? ` from ${song.album}` : ''}${song.year ? ` (${song.year})` : ''} online on Mizanora. ${clockTime(song.duration)} · ${song.language || 'music'} · artwork, album and free streaming.`,
      path: `/songs/${song.slug}`,
      image: song.image || '/img/hero-banner.jpg',
      type: 'music.song',
    }),
    keywords: [song.title, ...(song.artists || []), song.album || '', 'song online', 'listen song free'].filter(Boolean),
  };
}

export default async function SongPage({ params }) {
  const { slug } = await params;
  const song = await load(slug);
  if (!song) {
    const rawId = songIdFromSlug(slug);
    if (!rawId) notFound();
    // The catalogue did not answer (mirror down / offline preview). The browser gets one more try.
    return <SongDirectLoader id={rawId} slug={slug} />;
  }

  const related = song.artists && song.artists.length
    ? await searchSongs(song.artists[0], 12).catch(() => ({ items: [] }))
    : { items: [] };
  const trending = await getTrendingSongs(12).catch(() => []);
  const queue = [...related.items, ...trending].filter((s, i, arr) => s && s.id !== song.id && arr.findIndex((x) => x && x.id === s.id) === i).slice(0, 12);
  const artists = song.artists || [];

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'MusicRecording',
    name: song.title,
    url: absUrl(`/songs/${song.slug}`),
    ...(song.image ? { image: song.image } : {}),
    ...(song.duration ? { duration: `PT${Math.floor(song.duration / 60)}M${song.duration % 60}S` } : {}),
    ...(song.language ? { inLanguage: song.language } : {}),
    ...(song.year ? { datePublished: String(song.year) } : {}),
    byArtist: artists.length ? artists.map((name) => ({ '@type': 'MusicGroup', name })) : [{ '@type': 'MusicGroup', name: 'Various Artists' }],
    ...(song.album ? { inAlbum: { '@type': 'MusicAlbum', name: song.album } } : {}),
  };

  return (
    <>
      <JsonLd data={[ld, breadcrumbJsonLd([['/', 'Home'], ['/songs', 'Songs'], [`/songs/${song.slug}`, song.title]])]} />

      <div className="mx-auto max-w-7xl px-3 pt-4 sm:px-4">
        <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1.5 text-xs font-bold text-faint">
          <Link href="/" className="hover:text-gold">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href="/songs" className="hover:text-gold">Songs</Link>
          <span aria-hidden="true">/</span>
          <span className="line-clamp-1 text-dim">{song.title}</span>
        </nav>
      </div>

      <section className="mx-auto max-w-7xl px-3 sm:px-4">
        <SongDetailPlayer song={song} queue={queue} />
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-3 pt-6 sm:px-4 lg:grid-cols-12">
        <article className="rounded-3xl border border-line bg-surface p-5 shadow-sm lg:col-span-8">
          <h2 className="font-display text-xl font-extrabold text-cream">About this song</h2>
          <p className="mt-2 text-sm leading-7 text-dim">
            <strong className="text-cream">{song.title}</strong>
            {artists.length ? <> — {artists.map((a, i) => (
              <span key={a}>
                <Link href={`/songs/artist/${artistSlug(a)}`} className="font-semibold text-gold hover:underline">{a}</Link>
                {i < artists.length - 1 ? ', ' : ''}
              </span>
            ))}</> : null}
            {song.album ? <>, album <strong className="text-cream">{song.album}</strong></> : null}
            {song.year ? <> ({song.year})</> : null}. Duration {clockTime(song.duration)}
            {song.language ? `, ${song.language}` : ''}. Mizanora ke apne player mein sunne ke liye upar Play dabayein — koi signup,
            koi app install nahi. Player progress, volume aur next / previous support karta hai, is liye poora queue
            sunna aasan hai.
          </p>
          <p className="mt-3 text-sm leading-7 text-dim">
            Music third-party catalogue se stream hota hai (JioSaavn-style public API). Agar koi track load na ho to
            agla track try karein ya{' '}
            <Link href="/songs" className="font-bold text-gold hover:underline">songs search</Link> se doosra version chunein.
            Gaane ka page Google par bhi index hota hai — artist, album, duration aur artwork ke saath{' '}
            <span className="font-semibold text-cream">MusicRecording</span> structured data.
          </p>
        </article>

        <aside className="rounded-3xl border border-line bg-surface p-5 shadow-sm lg:col-span-4">
          <h2 className="font-display text-lg font-extrabold text-cream">Track details</h2>
          <dl className="mt-3 space-y-2 text-sm">
            {artists.length > 0 && (
              <div className="flex justify-between gap-2 border-b border-line pb-2">
                <dt className="text-faint">Artist</dt>
                <dd className="text-right font-bold text-cream">
                  {artists.map((a, i) => (
                    <span key={a}>
                      <Link href={`/songs/artist/${artistSlug(a)}`} className="text-gold hover:underline">{a}</Link>
                      {i < artists.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </dd>
              </div>
            )}
            {song.album && (
              <div className="flex justify-between gap-2 border-b border-line pb-2">
                <dt className="text-faint">Album</dt>
                <dd className="text-right font-bold text-cream">{song.album}</dd>
              </div>
            )}
            {song.year > 0 && (
              <div className="flex justify-between gap-2 border-b border-line pb-2">
                <dt className="text-faint">Year</dt>
                <dd className="text-right font-bold text-cream">{song.year}</dd>
              </div>
            )}
            {song.language && (
              <div className="flex justify-between gap-2 border-b border-line pb-2">
                <dt className="text-faint">Language</dt>
                <dd className="text-right font-bold text-cream">{song.language}</dd>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <dt className="text-faint">Duration</dt>
              <dd className="font-bold tabular-nums text-cream">{clockTime(song.duration)}</dd>
            </div>
          </dl>
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-raised p-3 text-[0.7rem] font-semibold text-dim">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-gold" />
            Links third-party catalogue ke hain; Mizanora unhe host nahi karta. Personal listening ke liye.
          </p>
        </aside>
      </section>

      {queue.length > 0 && (
        <section className="mx-auto max-w-7xl px-3 pt-8 pb-16 sm:px-4" aria-labelledby="more-songs">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-gold">Keep listening</p>
              <h2 id="more-songs" className="section-title">More songs {artists[0] ? `like ${artists[0]}` : 'to play'}</h2>
            </div>
            <Link href="/songs" className="inline-flex items-center gap-1 text-xs font-extrabold text-gold hover:underline">
              <ArrowLeft size={13} /> All songs
            </Link>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {queue.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-2.5 transition hover:border-gold">
                <Link href={`/songs/${s.slug}`} className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-raised">
                  {s.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                  ) : <span className="grid h-full w-full place-items-center text-gold"><Disc3 size={18} /></span>}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/songs/${s.slug}`} className="line-clamp-1 text-sm font-extrabold text-cream hover:text-gold">{s.title}</Link>
                  <p className="line-clamp-1 text-[0.68rem] font-semibold text-dim">{(s.artists || []).join(', ') || '—'}</p>
                </div>
                <span className="text-[0.65rem] font-bold tabular-nums text-faint">{clockTime(s.duration)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-3 pb-16 sm:px-4">
        <h2 className="font-display text-lg font-extrabold text-cream">Browse more moods</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {SONG_QUERIES.slice(0, 8).map((t) => (
            <Link key={t} href={`/songs?q=${encodeURIComponent(t)}`} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-3 py-1.5 text-[0.7rem] font-extrabold text-dim hover:border-gold hover:text-gold">
              <Music2 size={12} /> {t}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
