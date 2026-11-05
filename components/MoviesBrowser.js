'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Film, Play, Search, Sparkles, Tv, X } from 'lucide-react';
import MoviePosterCard from '@/components/MoviePosterCard';
import {
  MOVIE_GENRES,
  MOVIE_REGIONS,
  isValidImdbId,
  searchMovies,
} from '@/lib/movies';

const FORMAT_TABS = [
  { id: 'all', label: 'All (Upcoming + Latest → Classics)', icon: null },
  { id: 'upcoming', label: 'Upcoming (Ane Wali)', icon: Sparkles },
  { id: 'movie', label: 'Movies', icon: Film },
  { id: 'series', label: 'Series & Dramas', icon: Tv },
  { id: 'free', label: 'Free Legal Films', icon: Play },
];

const BATCH_SIZE = 24;

export default function MoviesBrowser({
  movies = [],
  initialQuery = '',
  initialRegion = 'all',
  initialFormat = 'all',
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [format, setFormat] = useState(initialFormat);
  const [region, setRegion] = useState(initialRegion);
  const [genre, setGenre] = useState('all');
  const [sort, setSort] = useState('latest');
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const sentinelRef = useRef(null);

  const trimmedQ = q.trim();
  const imdbHit = isValidImdbId(trimmedQ) ? trimmedQ.toLowerCase() : '';

  const filtered = useMemo(
    () =>
      searchMovies(q, movies, {
        type: format === 'movie' || format === 'series' ? format : 'all',
        freeOnly: format === 'free',
        upcomingOnly: format === 'upcoming',
        region,
        genre,
        sort,
        limit: 2500,
      }),
    [q, movies, format, region, genre, sort],
  );

  const hasMore = visibleCount < filtered.length;
  const shown = filtered.slice(0, visibleCount);

  // Automatic infinite scroll loader ("ye auto load ho")
  useEffect(() => {
    if (!hasMore) return undefined;
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((n) => Math.min(filtered.length, n + BATCH_SIZE));
        }
      },
      { rootMargin: '420px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, filtered.length]);

  const resetFilters = () => {
    setQ('');
    setFormat('all');
    setRegion('all');
    setGenre('all');
    setSort('latest');
    setVisibleCount(BATCH_SIZE);
  };

  return (
    <section id="explore-movies" className="mx-auto max-w-7xl scroll-mt-20 px-3 pt-8 sm:px-4" aria-label="Browse movies and series">
      <div className="rounded-3xl border border-line bg-surface p-4 shadow-sm sm:p-5">
        {/* Search + IMDb ID Instant Lookup Bar */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
            <input
              type="search"
              value={q}
              onChange={(e) => { setQ(e.target.value); setVisibleCount(BATCH_SIZE); }}
              placeholder="Search movie, drama, actor, genre or IMDb ID (e.g. tt1375666, Maula Jatt, Parizaad)..."
              aria-label="Search movies, series, actors or IMDb ID"
              className="input !py-3 !pl-10 !pr-9 text-sm"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-faint hover:text-gold"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {imdbHit && (
              <button
                type="button"
                onClick={() => router.push(`/movies/${imdbHit}`)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-saffron px-4 py-3 text-xs font-extrabold text-[#2B1B00] shadow hover:brightness-95"
              >
                Open IMDb {imdbHit} <ArrowRight size={14} />
              </button>
            )}
            <label htmlFor="movies-sort" className="sr-only">Sort titles</label>
            <select
              id="movies-sort"
              value={sort}
              onChange={(e) => { setSort(e.target.value); setVisibleCount(BATCH_SIZE); }}
              className="rounded-xl border border-line bg-raised px-3 py-3 text-xs font-bold text-cream sm:text-sm"
            >
              <option value="latest">Sort: Upcoming &amp; Newest → Oldest</option>
              <option value="upcoming">Sort: Upcoming Calendar First</option>
              <option value="trending">Sort: Trending Spotlight</option>
              <option value="rating">Sort: Top Rated</option>
              <option value="oldest">Sort: Classics First (Oldest → Newest)</option>
              <option value="az">Sort: Title A–Z</option>
            </select>
          </div>
        </div>

        {/* Format Tabs */}
        <div className="no-sb mt-3.5 flex gap-2 overflow-x-auto pb-1">
          {FORMAT_TABS.map((t) => {
            const Icon = t.icon;
            const on = format === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => { setFormat(t.id); setVisibleCount(BATCH_SIZE); }}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-extrabold transition ${
                  on ? 'bg-gold text-white shadow-sm' : 'bg-raised text-cream hover:text-gold'
                }`}
              >
                {Icon && <Icon size={13} />}
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Region Tabs */}
        <div className="no-sb mt-2.5 flex gap-1.5 overflow-x-auto pb-1">
          {MOVIE_REGIONS.map((r) => {
            const on = region === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => { setRegion(r.id); setVisibleCount(BATCH_SIZE); }}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold transition ${
                  on
                    ? 'border-gold bg-gold/10 text-gold'
                    : 'border-line bg-surface text-dim hover:border-gold hover:text-gold'
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        {/* Genre Chips */}
        <div className="no-sb mt-2.5 flex gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setGenre('all')}
            className={`shrink-0 rounded-lg px-2.5 py-1 text-[0.7rem] font-bold transition ${
              genre === 'all' ? 'bg-saffron text-[#2B1B00]' : 'bg-ink text-dim hover:text-gold'
            }`}
          >
            All Genres
          </button>
          {MOVIE_GENRES.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => { setGenre(g); setVisibleCount(BATCH_SIZE); }}
              className={`shrink-0 rounded-lg px-2.5 py-1 text-[0.7rem] font-bold transition ${
                genre === g ? 'bg-saffron text-[#2B1B00]' : 'bg-ink text-dim hover:text-gold'
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-faint">
          <span>
            Auto-loaded <b className="text-cream">{shown.length}</b> of <b className="text-cream">{filtered.length}</b> titles
            {region !== 'all' ? ` in ${region}` : ''}
            {genre !== 'all' ? ` · ${genre}` : ''}
          </span>
          {(q || format !== 'all' || region !== 'all' || genre !== 'all' || sort !== 'latest') && (
            <button type="button" onClick={resetFilters} className="font-bold text-gold hover:underline">
              Reset all filters
            </button>
          )}
        </div>
      </div>

      {/* Results Poster Grid with Automatic Infinite Scroll */}
      {shown.length > 0 ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {shown.map((m) => (
              <MoviePosterCard key={m.slug} movie={m} />
            ))}
          </div>
          {hasMore && (
            <div ref={sentinelRef} className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setVisibleCount((n) => Math.min(filtered.length, n + BATCH_SIZE))}
                className="btn-ghost !px-6 !py-2.5 text-sm font-bold"
              >
                Auto-loading more… ({filtered.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="mt-4 rounded-3xl border border-line bg-surface p-6 text-center">
          <p className="font-display text-lg font-extrabold text-cream">No titles matched those filters</p>
          <p className="mt-1 text-sm text-dim">
            {imdbHit
              ? `Tap below to look up IMDb ID ${imdbHit} directly.`
              : 'Try clearing a region or genre filter, or search by actor name or IMDb ID (like tt1375666).'}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {imdbHit && (
              <button
                type="button"
                onClick={() => router.push(`/movies/${imdbHit}`)}
                className="btn-gold text-xs"
              >
                Open IMDb Title {imdbHit} →
              </button>
            )}
            <button type="button" onClick={resetFilters} className="btn-ghost text-xs">
              Show all Movies &amp; Series
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
