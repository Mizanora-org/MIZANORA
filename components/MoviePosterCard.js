import Link from 'next/link';
import { Film, Play, Sparkles, Star, Tv } from 'lucide-react';
import SafeImg from '@/components/SafeImg';
import { posterHue, titleInitials, youtubeThumbUrl } from '@/lib/movies';

export default function MoviePosterCard({ movie, priority = false }) {
  if (!movie) return null;
  const hue = posterHue(movie.slug || movie.title);
  const hue2 = (hue + 48) % 360;
  const thumb = movie.posterSrc || movie.poster || youtubeThumbUrl(movie.trailerYoutubeId);
  const isFree = Boolean(movie.publicDomainStream);
  const isUpcoming = movie.status === 'upcoming';

  return (
    <Link
      href={`/movies/${movie.slug}`}
      prefetch={false}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm transition duration-200 hover:-translate-y-1 hover:border-gold hover:shadow-xl"
    >
      <div
        className="relative aspect-[2/3] w-full overflow-hidden"
        style={{
          background: `linear-gradient(155deg, hsl(${hue}, 58%, 24%) 0%, hsl(${hue2}, 64%, 11%) 100%)`,
        }}
      >
        {/* v58: the monogram layer sits UNDER the poster, so a title whose artwork is missing still
            looks designed instead of leaving an empty gradient box. */}
        <div className="absolute inset-0 flex h-full w-full flex-col items-center justify-center p-4 text-center text-white">
          <span className="grid h-16 w-16 place-items-center rounded-2xl border border-white/20 bg-white/10 font-display text-2xl font-extrabold tracking-wider backdrop-blur-sm">
            {titleInitials(movie.title)}
          </span>
          {movie.originalTitle && (
            <span className="mt-2.5 line-clamp-1 font-arabic text-base text-white/85">{movie.originalTitle}</span>
          )}
          <span className="mt-1 line-clamp-2 px-1 text-xs font-semibold text-white/75">{movie.director || movie.country}</span>
        </div>
        {thumb ? (
          <SafeImg
            src={thumb}
            alt={movie.title}
            loading={priority ? 'eager' : 'lazy'}
            className="relative h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : null}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />

        {/* Top badges */}
        <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-1.5">
          {isFree ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/95 px-2 py-0.5 text-[0.62rem] font-extrabold uppercase tracking-wide text-white shadow">
              <Play size={10} fill="currentColor" /> Free Film
            </span>
          ) : isUpcoming ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-saffron px-2 py-0.5 text-[0.62rem] font-extrabold uppercase tracking-wide text-[#2B1B00] shadow">
              <Sparkles size={10} /> Upcoming
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
              {movie.type === 'series' ? <Tv size={10} /> : <Film size={10} />}
              {movie.type === 'series' ? 'Series' : 'Movie'}
            </span>
          )}

          {movie.rating > 0 ? (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-black/75 px-2 py-0.5 text-[0.66rem] font-extrabold text-[#F5B83D] backdrop-blur-sm">
              <Star size={10} fill="currentColor" /> {movie.rating.toFixed(1)}
            </span>
          ) : (
            <span className="rounded-full bg-black/75 px-2 py-0.5 text-[0.64rem] font-bold text-white/90 backdrop-blur-sm">
              {movie.year}
            </span>
          )}
        </div>

        {/* Center hover play ring */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition duration-200 group-hover:opacity-100"
        >
          <span className="grid h-12 w-12 place-items-center rounded-full bg-gold/95 text-white shadow-xl ring-4 ring-white/25">
            <Play size={20} fill="currentColor" />
          </span>
        </span>

        {/* Bottom poster metadata */}
        <div className="absolute inset-x-2.5 bottom-2.5 text-white">
          <div className="flex flex-wrap items-center gap-1 text-[0.6rem] font-bold uppercase tracking-wider text-white/80">
            <span className="rounded bg-white/15 px-1.5 py-0.5 backdrop-blur-sm">{movie.region}</span>
            {movie.imdbId && <span className="rounded bg-black/50 px-1.5 py-0.5 font-mono text-[#F5B83D]">{movie.imdbId}</span>}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between p-2.5 sm:p-3">
        <div>
          <h3 className="line-clamp-1 font-display text-sm font-extrabold leading-snug text-cream group-hover:text-gold sm:text-base">
            {movie.title}
          </h3>
          <p className="mt-0.5 line-clamp-1 text-xs text-dim">
            {movie.year} · {(movie.genres || []).slice(0, 2).join(' · ')}
          </p>
        </div>
        <p className="mt-1.5 line-clamp-1 text-[0.68rem] font-semibold text-gold">
          {isFree ? 'Watch legal full movie →' : isUpcoming ? `Release: ${movie.releaseDate || movie.year} →` : 'Official trailer & cast →'}
        </p>
      </div>
    </Link>
  );
}
