import { Suspense } from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  ArrowRight,
  Calendar,
  Clock,
  Film,
  Globe2,
  Languages,
  Play,
  ShieldCheck,
  Sparkles,
  Star,
  Tv,
  Users,
} from 'lucide-react';
import { pageMeta, breadcrumbJsonLd } from '@/lib/seo';
import { absUrl } from '@/lib/config';
import { PageHead } from '@/components/Prose';
import JsonLd from '@/components/JsonLd';
import AdsInject from '@/components/AdsInject';
import ProductAds from '@/components/ProductAds';
import CinemaPlayer from '@/components/CinemaPlayer';
import SafeImg from '@/components/SafeImg';
import MovieListButton from '@/components/MovieListButton';
import MoviePosterCard from '@/components/MoviePosterCard';
import AvatarImg from '@/components/AvatarImg';
import TitleStubPanel from '@/components/TitleStubPanel';
import { getMovieCompanionProducts, resolveMovieOrSeries } from '@/lib/moviesServer';
import { getMovieServers } from '@/lib/movieServersServer';
import { cinemetaCatalog } from '@/lib/cinemeta';
import {
  STARTER_MOVIES,
  posterHue,
  relatedMovies,
  titleInitials,
  youtubeEmbedUrl,
  youtubeThumbUrl,
} from '@/lib/movies';

export const revalidate = 3600;

export function generateStaticParams() {
  return STARTER_MOVIES.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const { movie } = await resolveMovieOrSeries(slug);
  if (!movie) return {};
  if (movie.stub) {
    // Metadata unavailable right now: keep the page useful but out of the index until it fills in.
    return pageMeta({
      title: `IMDb ${movie.imdbId} — watch & title details`,
      description: `Title details for IMDb ${movie.imdbId} could not be loaded yet. The player and the official IMDb link are still available.`,
      path: `/movies/${movie.imdbId}`,
      noindex: true,
    });
  }
  const label = movie.type === 'series' ? 'Series Guide, Cast & Trailer' : 'Official Trailer, Cast & Story';
  const desc = `${movie.title} (${movie.year}) — ${movie.tagline || movie.story.slice(0, 150)} Explore cast, director ${movie.director || ''}, IMDb ${movie.imdbId || ''}, and legal streaming options on Mizanora.`;
  const heroImg = movie.posterSrc || movie.poster || movie.backdrop || youtubeThumbUrl(movie.trailerYoutubeId);
  const img = heroImg ? absUrl(heroImg) : undefined;
  return {
    ...pageMeta({
      title: `${movie.title} (${movie.year}) — ${label}`,
      description: desc.slice(0, 260),
      path: `/movies/${movie.slug}`,
      ...(img ? { image: img } : {}),
    }),
    keywords: [
      movie.title,
      `${movie.title} ${movie.year}`,
      `${movie.title} trailer`,
      `${movie.title} cast`,
      ...(movie.imdbId ? [movie.imdbId] : []),
      ...(movie.genres || []),
      movie.region,
    ],
  };
}

export default async function MovieDetailPage({ params }) {
  const { slug } = await params;
  const { movie, movies, config } = await resolveMovieOrSeries(slug);
  if (!movie) notFound();

  // If visitor entered via IMDb ID (/movies/tt1375666), redirect cleanly to canonical slug URL.
  if (slug.toLowerCase() !== movie.slug.toLowerCase()) {
    redirect(`/movies/${movie.slug}`);
  }

  const [companionProducts, serverCfg] = await Promise.all([
    config.ads && config.ads.enabled ? getMovieCompanionProducts(config.ads.slugs, movie.slug, 4) : Promise.resolve([]),
    getMovieServers(),
  ]);
  const playableCount = (serverCfg.servers || []).filter((s) => s.enabled !== false && (!s.scope || s.scope === 'all' || s.scope === movie.type)).length;
  let similar = relatedMovies(movie, movies, 6);
  if (!similar.length && movie.genres && movie.genres.length) {
    // v54: a title that came straight from IMDb has no neighbours in the shop's list yet, so the
    // "Similar" rail is filled from the same IMDb genre instead of staying empty.
    try {
      const extra = await cinemetaCatalog({ type: movie.type, genre: movie.genres[0], timeout: 5000 });
      similar = extra.filter((m) => m.imdbId !== movie.imdbId).slice(0, 6);
    } catch { similar = []; }
  }
  const hue = posterHue(movie.slug || movie.title);
  const thumb = movie.posterSrc || movie.poster || youtubeThumbUrl(movie.trailerYoutubeId);
  const ytEmbed = youtubeEmbedUrl(movie.trailerYoutubeId);

  const schemaType = movie.type === 'series' ? 'TVSeries' : 'Movie';
  const schemaLd = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    name: movie.title,
    ...(movie.originalTitle ? { alternateName: movie.originalTitle } : {}),
    description: movie.story || movie.tagline,
    url: absUrl(`/movies/${movie.slug}`),
    ...(thumb ? { image: thumb.startsWith('http') ? thumb : absUrl(thumb) } : {}),
    ...(movie.releaseDate ? { datePublished: movie.releaseDate } : { dateCreated: String(movie.year) }),
    genre: movie.genres || [],
    inLanguage: movie.language,
    countryOfOrigin: { '@type': 'Country', name: movie.country || movie.region },
    ...(movie.director ? { director: { '@type': 'Person', name: movie.director } } : {}),
    ...(movie.cast && movie.cast.length
      ? {
          actor: movie.cast.map((c) => ({
            '@type': 'Person',
            name: c.name,
            url: absUrl(`/movies/actor/${c.slug}`),
          })),
        }
      : {}),
    ...(movie.imdbId ? { sameAs: `https://www.imdb.com/title/${movie.imdbId}/` } : {}),
    ...(playableCount > 0
      ? {
          potentialAction: {
            '@type': 'WatchAction',
            target: absUrl(`/movies/${movie.slug}#player`),
            expectsAcceptanceOf: { '@type': 'Offer', category: 'Streaming' },
          },
        }
      : {}),
    ...(movie.rating > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: movie.rating,
            bestRating: 10,
            worstRating: 1,
            ratingCount: 250,
          },
        }
      : {}),
    ...(ytEmbed
      ? {
          trailer: {
            '@type': 'VideoObject',
            name: `${movie.title} (${movie.year}) Official Trailer`,
            description: movie.tagline || `Official trailer for ${movie.title}`,
            embedUrl: ytEmbed,
            thumbnailUrl: youtubeThumbUrl(movie.trailerYoutubeId),
            uploadDate: movie.releaseDate || `${movie.year}-01-01`,
          },
        }
      : {}),
  };

  return (
    <>
      <JsonLd
        data={[
          schemaLd,
          breadcrumbJsonLd([
            ['/', 'Home'],
            ['/movies', 'Movies & Series'],
            [`/movies/${movie.slug}`, movie.title],
          ]),
        ]}
      />

      <PageHead
        title={`${movie.title}${movie.stub ? '' : ` (${movie.year})`}`}
        intro={movie.tagline || `${movie.region} ${movie.type === 'series' ? 'Series' : 'Movie'} · ${movie.language}`}
        crumbs={[['/', 'Home'], ['/movies', 'Movies & Series'], [null, movie.title]]}
      />

      {movie.stub && <TitleStubPanel movie={movie} />}

      {/* Rich Cinema Identity Header */}
      <section className="mx-auto max-w-7xl px-3 pt-4 sm:px-4">
        <div
          className="relative overflow-hidden rounded-3xl p-4 text-white shadow-xl sm:p-6"
          style={{
            background: `linear-gradient(135deg, hsl(${hue}, 56%, 18%) 0%, #07281a 60%, #0c1724 100%)`,
          }}
        >
          {/* v58: the wide backdrop sits behind the poster, like the reference site's title page.
              Served from our own /api/poster route, so it loads even where metahub is blocked. */}
          {movie.backdropSrc ? (
            <SafeImg
              src={movie.backdropSrc}
              alt=""
              loading="eager"
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-35"
            />
          ) : null}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-black/10" />
          <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center">
            <div
              className="mx-auto flex h-48 w-32 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/20 shadow-lg sm:mx-0 sm:h-56 sm:w-40"
              style={{
                background: `linear-gradient(155deg, hsl(${hue}, 60%, 28%), hsl(${(hue + 45) % 360}, 65%, 11%))`,
              }}
            >
              {thumb ? (
                <SafeImg src={thumb} alt={movie.title} loading="eager" className="h-full w-full object-cover" />
              ) : (
                <span className="font-display text-3xl font-extrabold">{titleInitials(movie.title)}</span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 uppercase tracking-wider">
                  {movie.type === 'series' ? <Tv size={12} /> : <Film size={12} />}
                  {movie.type === 'series' ? 'Series / Drama' : 'Feature Film'}
                </span>
                {movie.publicDomainStream && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-1 font-extrabold text-[#042416]">
                    <ShieldCheck size={13} /> Free Legal Full Film
                  </span>
                )}
                {movie.status === 'upcoming' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-saffron px-3 py-1 font-extrabold text-[#2B1B00]">
                    <Sparkles size={12} /> Upcoming · {movie.releaseDate || movie.year}
                  </span>
                )}
                {movie.rating > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-3 py-1 font-extrabold text-[#F5B83D]">
                    <Star size={12} fill="currentColor" /> {movie.rating.toFixed(1)} / 10
                  </span>
                )}
                {movie.imdbId && (
                  <a
                    href={`https://www.imdb.com/title/${movie.imdbId}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-black/45 px-3 py-1 font-mono text-[#F5B83D] hover:underline"
                  >
                    IMDb: {movie.imdbId}
                  </a>
                )}
              </div>

              <h2 className="mt-2.5 font-display text-2xl font-extrabold leading-tight sm:text-4xl">
                {movie.title}{' '}
                <span className="font-normal text-white/75">({movie.year})</span>
              </h2>
              {movie.originalTitle && movie.originalTitle !== movie.title && (
                <p className="mt-1 font-arabic text-lg text-[#F5B83D]">{movie.originalTitle}</p>
              )}

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-semibold text-white/85 sm:text-sm">
                <span className="inline-flex items-center gap-1">
                  <Globe2 size={14} className="text-[#F5B83D]" /> {movie.country || movie.region}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Languages size={14} className="text-[#F5B83D]" /> {movie.language}
                </span>
                {movie.runtime > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Clock size={14} className="text-[#F5B83D]" />{' '}
                    {movie.type === 'series' ? `${movie.runtime} min / ep` : `${movie.runtime} min`}
                  </span>
                )}
                {movie.releaseDate && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar size={14} className="text-[#F5B83D]" /> {movie.releaseDate}
                  </span>
                )}
                <span className="rounded bg-white/15 px-2 py-0.5 text-xs">{movie.ageRating}</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {(movie.genres || []).map((g) => (
                  <Link
                    key={g}
                    href={`/movies?q=${encodeURIComponent(g)}`}
                    className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-bold text-white transition hover:bg-white/25"
                  >
                    {g}
                  </Link>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <a
                  href="#player"
                  className="inline-flex items-center gap-1.5 rounded-full bg-saffron px-4 py-2 text-xs font-extrabold text-[#2B1B00] shadow transition hover:brightness-95 sm:text-sm"
                >
                  <Play size={14} fill="currentColor" />
                  {playableCount > 0 ? `Watch Now (${playableCount} server${playableCount === 1 ? '' : 's'})` : 'Watch Trailer'}
                </a>
                <MovieListButton movie={movie} />
                <Link
                  href="/movies/calendar"
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/20 sm:text-sm"
                >
                  <Calendar size={14} /> Release calendar
                </Link>
                {movie.imdbId && (
                  <a
                    href={`https://www.imdb.com/title/${movie.imdbId}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/20 sm:text-sm"
                  >
                    <Star size={14} /> Rate on IMDb
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Cinema / Official Trailer Stage + Companion Shop Deals */}
      <section id="player" className="mx-auto max-w-7xl scroll-mt-20 px-3 pt-5 sm:px-4" aria-label="Player and watch options">
        <CinemaPlayer
          movie={movie}
          companionProducts={companionProducts}
          servers={serverCfg.servers || []}
          adConfig={serverCfg.ads}
        />
        <AdsInject slots={['auto']} />
      </section>

      {/* Storyline & Production Facts */}
      <section className="mx-auto grid max-w-7xl gap-5 px-3 pt-6 sm:px-4 lg:grid-cols-12">
        <article className="rounded-3xl border border-line bg-surface p-5 shadow-sm lg:col-span-8">
          <h2 className="font-display text-xl font-extrabold text-cream">Storyline &amp; Synopsis</h2>
          <p className="mt-2.5 text-sm leading-7 text-dim sm:text-base">{movie.story}</p>
        </article>

        <aside className="rounded-3xl border border-line bg-surface p-5 shadow-sm lg:col-span-4">
          <h2 className="font-display text-lg font-extrabold text-cream">Production Details</h2>
          <dl className="mt-3 space-y-2 text-sm">
            {movie.director && (
              <div className="flex justify-between gap-2 border-b border-line pb-2">
                <dt className="text-faint">Director / Creator</dt>
                <dd className="text-right font-bold text-cream">{movie.director}</dd>
              </div>
            )}
            <div className="flex justify-between gap-2 border-b border-line pb-2">
              <dt className="text-faint">Region</dt>
              <dd className="text-right font-bold text-cream">{movie.region}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-line pb-2">
              <dt className="text-faint">Language</dt>
              <dd className="text-right font-bold text-cream">{movie.language}</dd>
            </div>
            {movie.imdbId && (
              <div className="flex justify-between gap-2 border-b border-line pb-2">
                <dt className="text-faint">IMDb ID</dt>
                <dd className="font-mono font-bold text-gold">{movie.imdbId}</dd>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <dt className="text-faint">Release Status</dt>
              <dd className="font-bold capitalize text-cream">{movie.status}</dd>
            </div>
          </dl>
        </aside>
      </section>

      {/* v54: Episodes & Seasons (Cinemeta sends the whole episode list) */}
      {movie.type === 'series' && Array.isArray(movie.seasons) && movie.seasons.length > 0 && (
        <section className="mx-auto max-w-7xl px-3 pt-8 sm:px-4" aria-labelledby="movie-episodes">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-gold">Episode Guide</p>
              <h2 id="movie-episodes" className="section-title">Seasons &amp; Episodes</h2>
            </div>
            <span className="text-xs font-bold text-faint">
              {movie.seasons.length} season{movie.seasons.length === 1 ? '' : 's'} ·{' '}
              {movie.seasons.reduce((n, s) => n + (s.episodes ? s.episodes.length : 0), 0)} episodes
            </span>
          </div>
          <div className="space-y-2">
            {movie.seasons.map((s, i) => (
              <details key={`s-${s.season}`} open={i === 0} className="overflow-hidden rounded-2xl border border-line bg-surface">
                <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 font-display text-sm font-extrabold text-cream">
                  <span>Season {s.season}</span>
                  <span className="text-xs font-bold text-faint">{s.episodes ? s.episodes.length : 0} episodes</span>
                </summary>
                <ol className="divide-y divide-line border-t border-line">
                  {(s.episodes || []).map((ep) => (
                    <li key={`e-${s.season}-${ep.e}`} className="flex gap-3 px-4 py-2.5 text-sm">
                      <span className="w-10 shrink-0 font-mono text-xs font-bold text-gold">E{ep.e}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold text-cream">{ep.title}</span>
                        {ep.airDate && <span className="text-[0.7rem] font-semibold text-faint">{ep.airDate}</span>}
                        {ep.summary && <span className="mt-0.5 block text-xs leading-5 text-dim">{ep.summary}</span>}
                      </span>
                    </li>
                  ))}
                </ol>
              </details>
            ))}
          </div>
        </section>
      )}

      {/* Cast & Actors Section */}
      {movie.cast && movie.cast.length > 0 && (
        <section className="mx-auto max-w-7xl px-3 pt-8 sm:px-4" aria-labelledby="movie-cast">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-wider text-gold">
                <Users size={13} /> Cast &amp; Characters
              </p>
              <h2 id="movie-cast" className="section-title">Actors in {movie.title}</h2>
            </div>
            <Link href="/movies/actors" className="inline-flex items-center gap-1 text-sm font-bold text-gold hover:underline">
              All actors <ArrowRight size={15} />
            </Link>
          </div>

          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {movie.cast.map((c) => {
              const cHue = posterHue(c.slug || c.name);
              return (
                <li key={`${c.slug}-${c.character}`}>
                  <Link
                    href={`/movies/actor/${c.slug}`}
                    prefetch={false}
                    className="group flex h-full flex-col items-center rounded-2xl border border-line bg-surface p-3.5 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-gold hover:shadow-md"
                  >
                    <span
                      aria-hidden="true"
                      className="relative grid h-14 w-14 place-items-center overflow-hidden rounded-full font-display text-base font-extrabold text-white ring-2 ring-gold/25"
                      style={{
                        background: `linear-gradient(145deg, hsl(${cHue}, 58%, 32%), hsl(${(cHue + 40) % 360}, 65%, 16%))`,
                      }}
                    >
                      <AvatarImg
                        src={c.photo || `/api/person/${encodeURIComponent(c.name)}`}
                        name={c.name}
                        hue={cHue}
                        initials={titleInitials(c.name)}
                        className="absolute inset-0 h-full w-full object-cover text-white"
                      />
                    </span>
                    <b className="mt-2 line-clamp-1 text-sm text-cream group-hover:text-gold">{c.name}</b>
                    {c.character && <span className="mt-0.5 line-clamp-1 text-xs text-dim">as {c.character}</span>}
                    <span className="mt-1.5 text-[0.66rem] font-bold text-gold">Actor profile →</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Mizanora Store Products Strip */}
      <Suspense fallback={null}>
        <ProductAds
          seed={`movie-${movie.slug}`}
          title={`Featured Store Picks for ${movie.title} Fans`}
          note="Order online with Cash on Delivery anywhere in Pakistan"
        />
      </Suspense>

      {/* Similar Movies & Series */}
      {similar.length > 0 && (
        <section className="mx-auto max-w-7xl px-3 pt-10 sm:px-4" aria-labelledby="similar-titles">
          <div className="mb-3 flex items-end justify-between gap-4">
            <h2 id="similar-titles" className="section-title">Similar Movies &amp; Series</h2>
            <Link href="/movies" className="inline-flex items-center gap-1 text-sm font-bold text-gold hover:underline">
              Explore hub <ArrowRight size={15} />
            </Link>
          </div>
          <div className="no-sb -mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-2 sm:grid sm:grid-cols-3 sm:gap-3.5 sm:overflow-visible sm:px-0 lg:grid-cols-6">
            {similar.map((m) => (
              <div key={m.slug} className="w-[42vw] max-w-[185px] shrink-0 snap-start sm:w-auto sm:max-w-none">
                <MoviePosterCard movie={m} />
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
