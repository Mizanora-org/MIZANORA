import Link from 'next/link';
import { ArrowRight, ExternalLink, Film, RotateCw, Search, Sparkles, Tv } from 'lucide-react';
import MoviePosterCard from '@/components/MoviePosterCard';
import { seedFeatured } from '@/lib/imdbSeed';

// Mizanora v56 — the page a visitor lands on when a title's metadata could not be fetched.
//
// Before this existed, such a page was mostly empty: a warning box, then blank poster/cast rows.
// That is the "khali page" problem. The rules now:
//
//   * say honestly what failed and what still works (the player, the IMDb link),
//   * keep the page OUT of Google (`noindex` in metadata) until it fills in,
//   * never leave the visitor with nothing to tap: a search box, the popular shelf, the film/series
//     facts we DO know from the committed id pool (type + year), and a retry.
export default function TitleStubPanel({ movie }) {
  const picks = seedFeatured(12);
  const isSeries = movie.type === 'series';
  const year = movie.year || 0;

  return (
    <section className="mx-auto max-w-7xl px-3 pt-4 sm:px-4" aria-labelledby="stub-heading">
      <div className="overflow-hidden rounded-3xl border border-amber-300/60 bg-amber-50/80">
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2 text-[0.7rem] font-extrabold uppercase tracking-wider text-amber-800">
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1">
              {isSeries ? <Tv size={12} /> : <Film size={12} />} {isSeries ? 'Series' : 'Movie'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-mono">{movie.imdbId}</span>
            {year ? <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1">{year}</span> : null}
          </div>

          <h2 id="stub-heading" className="mt-2.5 font-display text-lg font-extrabold text-amber-950 sm:text-xl">
            Is title ki official tafseel abhi load nahi ho saki
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-7 text-amber-900">
            Poster, cast aur story IMDb se aati hai — is waqt wo jawab nahi de raha. <b>Player neeche maujood hai</b> aur
            yeh IMDb ID se seedha chalta hai, is liye aap abhi bhi dekh sakte hain. Thori dair baad retry karein to page
            khud bhar jayega.
          </p>

          <ul className="mt-2 grid gap-1 text-xs font-semibold text-amber-900/85 sm:grid-cols-2">
            <li>✅ Play servers (agar admin ne set kiye hain) chalta rahega</li>
            <li>✅ Official IMDb page ka link</li>
            <li>✅ 16,000+ titles ka snapshot search</li>
            <li>⏳ Cast, poster, episodes — IMDb jawab dete hi</li>
          </ul>

          <form action="/search" method="get" className="mt-4 rounded-2xl bg-white p-2 shadow-sm sm:flex sm:items-center sm:gap-2">
            <label htmlFor="stub-q" className="sr-only">Search another title</label>
            <div className="relative flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6b7d73]" />
              <input
                id="stub-q"
                name="q"
                type="search"
                placeholder="Doosri movie ya series search karein…"
                className="w-full rounded-xl border border-transparent bg-transparent py-2.5 pl-9 pr-3 text-sm font-semibold text-[#0B3D28] outline-none placeholder:text-[#6b7d73] focus:border-[#0B6B45]/40"
              />
            </div>
            <button type="submit" className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#0B6B45] px-5 py-2.5 text-sm font-extrabold text-white sm:mt-0 sm:w-auto">
              Search
            </button>
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={`/api/movies/refresh?slug=${encodeURIComponent(movie.imdbId)}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-600 px-3.5 py-2 text-xs font-extrabold text-white hover:brightness-95"
            >
              <RotateCw size={13} /> Retry now
            </a>
            <a
              href={`https://www.imdb.com/title/${movie.imdbId}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500 px-3.5 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100"
            >
              Open on IMDb <ExternalLink size={12} />
            </a>
            <Link
              href="/movies"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500 px-3.5 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100"
            >
              Movies home <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </div>

      {picks.length > 0 && (
        <div className="pt-6">
          <div className="mb-3 flex items-center gap-1.5">
            <Sparkles size={14} className="text-gold" />
            <h3 className="section-title !mb-0 !text-lg">Jab tak wait karein — yeh popular hain</h3>
          </div>
          <div className="no-sb -mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-2 sm:grid sm:grid-cols-3 sm:gap-3.5 sm:overflow-visible sm:px-0 lg:grid-cols-6">
            {picks.map((m, i) => (
              <div key={m.imdbId || m.slug} className="w-[42vw] max-w-[185px] shrink-0 snap-start sm:w-auto sm:max-w-none">
                <MoviePosterCard movie={m} priority={i === 0} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
