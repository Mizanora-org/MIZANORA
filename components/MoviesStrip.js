import Link from 'next/link';
import { ArrowRight, Calendar, Clapperboard, Users } from 'lucide-react';
import MoviePosterCard from '@/components/MoviePosterCard';
import { getMoviesHub } from '@/lib/moviesServer';
import { searchMovies } from '@/lib/movies';

// Server-rendered Movies, Dramas & Trailers shelf that plugs into the Home page and Blog pages.
export default async function MoviesStrip({
  title = 'Movies, Pakistani Dramas & Trailers',
  subtitle = 'Official trailers, full cast & story details, release calendar, and free legal classic films.',
  region = 'all',
  count = 6,
  compact = false,
}) {
  let hub;
  try {
    hub = await getMoviesHub();
  } catch {
    return null;
  }
  if (!hub || !hub.config || !hub.config.enabled || !hub.movies.length) return null;
  const items = searchMovies('', hub.movies, { region, sort: 'trending', limit: count });
  if (!items.length) return null;

  return (
    <section className={`mx-auto ${compact ? 'max-w-5xl pt-8' : 'max-w-7xl pt-8'} px-3 sm:px-4`} aria-label="Movies and series on Mizanora">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-gold">
            <Clapperboard size={14} /> Mizanora Cinema &amp; Discovery
          </p>
          <h2 className="section-title mt-0.5">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-dim">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold sm:text-sm">
          <Link href="/movies/calendar" className="inline-flex items-center gap-1 text-dim hover:text-gold">
            <Calendar size={14} /> Calendar
          </Link>
          <Link href="/movies/actors" className="inline-flex items-center gap-1 text-dim hover:text-gold">
            <Users size={14} /> Actors
          </Link>
          <Link href="/movies" className="inline-flex items-center gap-1 text-gold hover:underline">
            Explore all ({hub.movies.length}) <ArrowRight size={15} />
          </Link>
        </div>
      </div>

      <div className="no-sb -mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-2 sm:grid sm:grid-cols-3 sm:gap-3.5 sm:overflow-visible sm:px-0 lg:grid-cols-6">
        {items.map((m, idx) => (
          <div key={m.slug} className="w-[42vw] max-w-[185px] shrink-0 snap-start sm:w-auto sm:max-w-none">
            <MoviePosterCard movie={m} priority={idx < 2} />
          </div>
        ))}
      </div>
    </section>
  );
}
