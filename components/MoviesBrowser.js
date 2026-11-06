'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Film,
  Globe2,
  Loader2,
  Play,
  Search,
  Sparkles,
  Star,
  Tv,
  X,
} from 'lucide-react';
import MoviePosterCard from '@/components/MoviePosterCard';
import SafeImg from '@/components/SafeImg';
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

const QUICK_SEARCHES = ['Jawan', 'The Legend of Maula Jatt', 'Parizaad', 'Inception', 'Oppenheimer', 'Squid Game', 'Interstellar', 'Ertugrul'];
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

  const [world, setWorld] = useState({ loading: false, items: [], sources: [], error: '', forQuery: '' });

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

  // Automatic infinite scroll loader
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

  // Live world-catalogue search: this is what finds ANY movie / series, not just the stored feed.
  useEffect(() => {
    const term = trimmedQ;
    if (term.length < 2 || isValidImdbId(term)) {
      setWorld({ loading: false, items: [], sources: [], error: '', forQuery: term });
      return undefined;
    }
    let alive = true;
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    setWorld((w) => ({ ...w, loading: true, error: '' }));
    const timer = setTimeout(async () => {
      try {
        const typeParam = format === 'movie' || format === 'series' ? `&type=${format}` : '';
        const res = await fetch(`/api/movies/search?q=${encodeURIComponent(term)}&limit=24${typeParam}`, {
          signal: ctrl ? ctrl.signal : undefined,
        });
        const json = await res.json().catch(() => ({}));
        if (!alive) return;
        if (json && json.ok) {
          setWorld({ loading: false, items: json.items || [], sources: json.sources || [], error: '', forQuery: term });
        } else {
          setWorld({ loading: false, items: [], sources: [], error: (json && json.error) || 'World search is unavailable right now.', forQuery: term });
        }
      } catch (e) {
        if (!alive || (e && e.name === 'AbortError')) return;
        setWorld({ loading: false, items: [], sources: [], error: 'Could not reach the world catalogue. Check your connection.', forQuery: term });
      }
    }, 420);

    return () => {
      alive = false;
      clearTimeout(timer);
      if (ctrl) ctrl.abort();
    };
  }, [trimmedQ]);

  const resetFilters = () => {
    setQ('');
    setFormat('all');
    setRegion('all');
    setGenre('all');
    setSort('latest');
    setVisibleCount(BATCH_SIZE);
  };

  const worldItems = world.items || [];
  const localKeys = new Set(filtered.map((m) => (m.imdbId || m.slug).toLowerCase()));
  const outsideLibrary = worldItems.filter((m) => !localKeys.has(String(m.imdbId || m.slug || '').toLowerCase()));

  return (
    <section id="explore-movies" className="mx-auto max-w-7xl scroll-mt-20 px-3 pt-8 sm:px-4" aria-label="Browse movies and series">
      <div className="rounded-3xl border border-line bg-surface p-4 shadow-sm sm:p-5">
        {/* Search + IMDb ID instant lookup */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
            <input
              type="search"
              value={q}
              onChange={(e) => { setQ(e.target.value); setVisibleCount(BATCH_SIZE); }}
              placeholder="Search ANY movie, drama, actor, genre or IMDb ID (tt1375666, Jawan, Parizaad)…"
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

        {/* Quick search chips */}
        {!trimmedQ && (
          <div className="no-sb mt-2.5 flex gap-1.5 overflow-x-auto pb-1">
            <span className="shrink-0 py-1 text-[0.7rem] font-bold uppercase tracking-wider text-faint">Try:</span>
            {QUICK_SEARCHES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setQ(s)}
                className="shrink-0 rounded-full border border-line bg-raised px-2.5 py-1 text-[0.7rem] font-bold text-dim transition hover:border-gold hover:text-gold"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Format tabs */}
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

        {/* Region tabs */}
        <div className="no-sb mt-2.5 flex gap-1.5 overflow-x-auto pb-1">
          {MOVIE_REGIONS.map((r) => {
            const on = region === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => { setRegion(r.id); setVisibleCount(BATCH_SIZE); }}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold transition ${
                  on ? 'border-gold bg-gold/10 text-gold' : 'border-line bg-surface text-dim hover:border-gold hover:text-gold'
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        {/* Genre chips */}
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

      {/* ---------- WORLD CATALOGUE RESULTS (IMDb / TMDB / TVmaze) ---------- */}
      {trimmedQ.length >= 2 && !imdbHit && (
        <div className="mt-4 rounded-3xl border border-gold/30 bg-gradient-to-br from-[#04231a] via-[#07281d] to-[#0f2233] p-3.5 text-white shadow-lg sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="inline-flex items-center gap-1 text-[0.66rem] font-extrabold uppercase tracking-wider text-[#F5B83D]">
                <Globe2 size={12} /> World catalogue · IMDb + TMDB + TVmaze
              </p>
              <h3 className="mt-0.5 font-display text-base font-extrabold sm:text-lg">
                “{trimmedQ}” — every match from the global catalogue
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[0.62rem] font-bold">
              {(world.sources || []).map((s) => (
                <span key={s.source} className="rounded-full bg-white/15 px-2 py-0.5">{s.source} · {s.count}</span>
              ))}
              {world.loading && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5">
                  <Loader2 size={11} className="animate-spin" /> searching…
                </span>
              )}
            </div>
          </div>

          {world.error && <p className="mt-2 rounded-lg bg-rose-500/20 px-2.5 py-1.5 text-xs font-semibold text-rose-100">{world.error}</p>}

          {world.loading && outsideLibrary.length === 0 ? (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-xl bg-white/10" />
              ))}
            </div>
          ) : outsideLibrary.length > 0 ? (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {outsideLibrary.slice(0, 12).map((m) => (
                <Link
                  key={m.imdbId || m.slug}
                  href={m.href || `/movies/${m.imdbId || m.slug}`}
                  prefetch={false}
                  className="group flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 p-2 transition hover:border-[#F5B83D]/60 hover:bg-white/10"
                >
                  <span className="relative h-16 w-11 shrink-0 overflow-hidden rounded-md bg-white/10">
                    {m.poster ? (
                      <SafeImg src={m.poster} alt={m.title} className="h-full w-full object-cover" />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-[0.62rem] font-bold text-white/60">
                        {m.type === 'series' ? <Tv size={14} /> : <Film size={14} />}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 text-xs font-extrabold text-white group-hover:text-[#F5B83D]">{m.title}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[0.62rem] font-semibold text-white/60">
                      <span>{m.year || '—'}</span>
                      <span>· {m.type === 'series' ? 'Series' : 'Movie'}</span>
                      {m.rating > 0 && <span className="inline-flex items-center gap-0.5 text-[#F5B83D]"><Star size={9} fill="currentColor" />{Number(m.rating).toFixed(1)}</span>}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-[0.6rem] font-mono text-[#F5B83D]/85">
                      {m.imdbId || 'Mizanora'} {m.inLibrary ? '· in library' : ''}
                    </span>
                  </span>
                  <ArrowRight size={14} className="shrink-0 text-white/45 transition group-hover:translate-x-0.5 group-hover:text-[#F5B83D]" />
                </Link>
              ))}
            </div>
          ) : (
            !world.loading && (
              <p className="mt-2 text-xs text-white/70">
                No extra titles outside the library — the matches above are already on Mizanora.
              </p>
            )
          )}

          {outsideLibrary.length > 12 && (
            <p className="mt-2 text-[0.68rem] text-white/55">
              Showing the 12 best matches. Open an IMDb ID directly (e.g. <span className="font-mono text-[#F5B83D]">tt22084616</span>) to reach any other title instantly.
            </p>
          )}
        </div>
      )}

      {/* ---------- LIBRARY RESULTS ---------- */}
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
          <p className="font-display text-lg font-extrabold text-cream">
            {world.loading ? 'Searching the world catalogue…' : 'No titles matched those filters'}
          </p>
          <p className="mt-1 text-sm text-dim">
            {imdbHit
              ? `Tap below to look up IMDb ID ${imdbHit} directly.`
              : trimmedQ
                ? `“${trimmedQ}” is not in the stored library — check the world-catalogue matches above, or paste its IMDb ID.`
                : 'Try clearing a region or genre filter, or search by actor name or IMDb ID (like tt1375666).'}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {imdbHit && (
              <button type="button" onClick={() => router.push(`/movies/${imdbHit}`)} className="btn-gold text-xs">
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
