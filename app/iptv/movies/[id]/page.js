import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Clapperboard, Play, Star } from 'lucide-react';
import { pageMeta, breadcrumbJsonLd } from '@/lib/seo';
import { absUrl } from '@/lib/config';
import JsonLd from '@/components/JsonLd';
import { findPublicMovie, getPublicLibrary } from '@/lib/iptvPublic';

export const revalidate = 300;

export async function generateMetadata({ params }) {
  const { id } = await params;
  const movie = await findPublicMovie(id);
  // Root app/loading.js ki wajah se missing id par HTTP 200 mil sakta hai — is liye noindex lazmi.
  if (!movie) return pageMeta({ title: 'Movie not found', description: 'Yeh movie library mein nahi mili.', path: `/iptv/movies/${id}`, noindex: true });
  return pageMeta({
    title: `${movie.name}${movie.year ? ` (${movie.year})` : ''} — Mizanora IPTV`,
    description: `${movie.name} ${movie.year ? `(${movie.year})` : ''} Mizanora IPTV par — ${movie.rating ? `IMDb ${movie.rating}/10, ` : ''}${movie.group}. Xtream apps aur browser player par HD mein dekhein.`,
    path: `/iptv/movies/${id}`,
    ...(movie.poster ? { image: movie.poster } : {}),
  });
}

export default async function MoviePage({ params }) {
  const { id } = await params;
  const movie = await findPublicMovie(id);
  if (!movie) notFound();
  const lib = await getPublicLibrary();
  const related = lib.movies.filter((m) => m.id !== movie.id && m.group === movie.group).slice(0, 10);

  const ld = [
    breadcrumbJsonLd([['/', 'Home'], ['/iptv', 'IPTV'], ['/iptv/movies', 'Movies'], [`/iptv/movies/${id}`, movie.name]]),
    {
      '@context': 'https://schema.org',
      '@type': 'Movie',
      name: movie.name,
      ...(movie.year ? { datePublished: String(movie.year) } : {}),
      ...(movie.poster ? { image: movie.poster } : {}),
      ...(movie.plot ? { description: movie.plot } : {}),
      ...(movie.group ? { genre: movie.group } : {}),
      ...(movie.imdbId ? { sameAs: `https://www.imdb.com/title/${movie.imdbId}/` } : {}),
      ...(movie.rating ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: movie.rating, bestRating: 10, ratingCount: 100 } } : {}),
      url: absUrl(`/iptv/movies/${id}`),
    },
  ];

  return (
    <>
      <JsonLd data={ld} />
      <div className="mx-auto max-w-5xl px-4 py-8">
        <nav className="mb-4 text-[11px] text-faint">
          <Link href="/iptv" className="hover:text-gold">IPTV</Link> · <Link href="/iptv/movies" className="hover:text-gold">Movies</Link> · <span className="text-dim">{movie.name}</span>
        </nav>

        <div className="grid gap-5 sm:grid-cols-[16rem_1fr]">
          <div className="overflow-hidden rounded-2xl border border-line bg-raised">
            {movie.poster
              ? <img src={movie.poster} alt={movie.name} className="aspect-[2/3] w-full object-cover" />
              : <div className="grid aspect-[2/3] place-items-center text-faint"><Clapperboard size={34} /></div>}
          </div>

          <div className="space-y-3">
            <div>
              <h1 className="font-display text-2xl font-black text-cream">{movie.name} {movie.year ? <span className="text-dim">({movie.year})</span> : null}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                {movie.rating > 0 && <span className="flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 font-bold text-gold"><Star size={10} /> IMDb {movie.rating}</span>}
                {movie.group && <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-dim">{movie.group}</span>}
                {movie.runtime && <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-dim">{movie.runtime}</span>}
                {movie.imdbId && <a href={`https://www.imdb.com/title/${movie.imdbId}/`} target="_blank" rel="noopener noreferrer" className="rounded-full border border-line bg-surface px-2 py-0.5 text-dim hover:text-gold">IMDb page</a>}
              </div>
            </div>

            {movie.plot && <p className="text-sm leading-relaxed text-dim">{movie.plot}</p>}

            <dl className="grid gap-1 text-xs text-dim sm:grid-cols-2">
              {movie.director && <div><dt className="text-[10px] uppercase tracking-wider text-faint">Director</dt><dd>{movie.director}</dd></div>}
              {movie.cast && <div><dt className="text-[10px] uppercase tracking-wider text-faint">Cast</dt><dd className="line-clamp-2">{movie.cast}</dd></div>}
            </dl>

            <div className="flex flex-wrap gap-2 pt-1">
              <Link href="/iptv/player" className="btn-gold"><Play size={15} /> Browser par dekhein</Link>
              <Link href="/iptv/start" className="btn-ghost">Free trial <ArrowRight size={14} /></Link>
              <Link href="/iptv" className="btn-ghost">Plans</Link>
            </div>
            <p className="text-[11px] text-faint">
              Browser player mein apni line ka username/password daalein — yahi login Xtream apps (TiviMate, Smarters) mein bhi chalta hai.
            </p>
          </div>
        </div>

        {!!related.length && (
          <section className="mt-8">
            <h2 className="mb-2 font-display text-base font-bold text-cream">Isi category se</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {related.map((m) => (
                <Link key={m.id} href={`/iptv/movies/${m.id}`} className="overflow-hidden rounded-xl border border-line bg-surface hover:border-gold/40">
                  {m.poster ? <img src={m.poster} alt={m.name} loading="lazy" className="aspect-[2/3] w-full object-cover" /> : <div className="grid aspect-[2/3] place-items-center text-faint"><Clapperboard size={20} /></div>}
                  <p className="truncate p-2 text-[11px] font-semibold text-cream">{m.name}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
