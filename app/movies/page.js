import { Suspense } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Calendar,
  Clapperboard,
  Film,
  Globe2,
  Play,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { pageMeta, breadcrumbJsonLd } from '@/lib/seo';
import { absUrl } from '@/lib/config';
import { PageHead } from '@/components/Prose';
import JsonLd from '@/components/JsonLd';
import AdsInject from '@/components/AdsInject';
import ProductAds from '@/components/ProductAds';
import MoviePosterCard from '@/components/MoviePosterCard';
import MoviesBrowser from '@/components/MoviesBrowser';
import { getMoviesHub } from '@/lib/moviesServer';
import { getMovieServers } from '@/lib/movieServersServer';
import { posterHue, searchMovies, titleInitials } from '@/lib/movies';

export const revalidate = 1800;

export const metadata = {
  ...pageMeta({
    title: 'Movies & Series Hub: Official Trailers, Pakistani Dramas, Cast, Calendar & Legal Classics',
    description:
      'Explore Pakistani movies, Urdu dramas, Bollywood, Iranian, Bangladeshi, Afghan and international films & series on Mizanora. Watch official trailers, browse cast & actor profiles, check the 2026–2027 release calendar, and stream 100% legal public-domain classic movies.',
    path: '/movies',
  }),
  keywords: [
    'pakistani movies',
    'pakistani dramas',
    'movies release calendar 2026 2027',
    'watch official trailers',
    'public domain classic movies free',
    'bollywood movies cast and story',
    'iranian movies guide',
    'bangladeshi movies',
    'imdb movie lookup',
    'mizanora movies',
  ],
};

export default async function MoviesHubPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const initialQuery = String(sp.q || '').slice(0, 80).trim();
  const initialRegion = String(sp.region || 'all').slice(0, 40);
  const initialFormat = String(sp.format || 'all').slice(0, 20);

  const [{ config, movies, actors }, serverCfg] = await Promise.all([getMoviesHub(), getMovieServers()]);
  const playServers = (serverCfg.servers || []).filter((s) => s.enabled !== false);
  const upcomingTitles = searchMovies('', movies, { upcomingOnly: true, sort: 'upcoming', limit: 6 });
  const freeFilms = movies.filter((m) => Boolean(m.publicDomainStream));
  const pakistaniTitles = searchMovies('', movies, { region: 'Pakistan', sort: 'latest', limit: 6 });
  const regionalTitles = movies
    .filter((m) => ['India', 'Iran & Afghanistan', 'Bangladesh', 'Turkey & Arabic'].includes(m.region) && m.status === 'released')
    .slice(0, 6);
  const upcomingCount = movies.filter((m) => m.status === 'upcoming').length;

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: config.title,
    description: config.note,
    itemListElement: movies.slice(0, 50).map((m, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: `${m.title} (${m.year})`,
      url: absUrl(`/movies/${m.slug}`),
    })),
  };

  return (
    <>
      <JsonLd data={[itemListLd, breadcrumbJsonLd([['/', 'Home'], ['/movies', 'Movies & Series']])]} />

      <PageHead
        title="Movies & Series Hub"
        intro="Official trailers, full story & cast profiles, 2026–2027 release calendar, IMDb ID lookup, and 100% legal public-domain cinema."
        crumbs={[['/', 'Home'], [null, 'Movies & Series']]}
      />

      {/* Cinematic App-Style Hero */}
      <section className="mx-auto max-w-7xl px-3 pt-4 sm:px-4">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#052e1d] via-[#0B6B45] to-[#13293d] p-5 text-white shadow-2xl sm:p-7">
          <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold uppercase tracking-wider">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-saffron px-3 py-1 text-[#2B1B00]">
              <Clapperboard size={13} /> v51 Live World Search
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1">
              <Film size={12} /> {movies.length} Movies &amp; Series
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1">
              <Users size={12} /> {actors.length} Stars &amp; Directors
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-3 py-1 text-emerald-200">
              <ShieldCheck size={12} /> 100% Legal &amp; Google-Safe
            </span>
            {playServers.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1">
                <Play size={12} fill="currentColor" /> {playServers.length} Play Server{playServers.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          <h2 className="mt-3.5 max-w-3xl font-display text-2xl font-extrabold leading-tight sm:text-4xl">
            Pakistan, South Asia &amp; World Cinema —{' '}
            <span className="text-[#F5B83D]">Trailers, Cast, Calendar &amp; Free Legal Classics</span>
          </h2>
          <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-base">
            Search <b>any</b> movie or series — the live IMDb / TMDB / TVmaze catalogue answers even when a title is
            not in our own list. Paste an IMDb ID (like{' '}
            <code className="rounded bg-black/35 px-1.5 py-0.5 font-mono text-[#F5B83D]">tt1375666</code>) to open a page
            instantly, then press <b>Watch Now</b> in Mizanora&apos;s own player.
          </p>

          <div className="mt-5 flex flex-wrap gap-2.5">
            <a
              href="#explore-movies"
              className="inline-flex items-center gap-1.5 rounded-full bg-saffron px-4 py-2.5 text-xs font-extrabold text-[#2B1B00] shadow transition hover:brightness-95 sm:text-sm"
            >
              <Play size={15} fill="currentColor" /> Browse &amp; Search IMDb ID
            </a>
            <Link
              href="/movies/calendar"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-white/20 sm:text-sm"
            >
              <Calendar size={15} /> Release Calendar ({upcomingCount} Upcoming)
            </Link>
            <Link
              href="/movies/actors"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-sm transition hover:bg-white/20 sm:text-sm"
            >
              <Users size={15} /> Actors &amp; Cast Directory
            </Link>
          </div>
        </div>

        <AdsInject slots={['auto']} />
      </section>

      {/* Shelf 0: Upcoming 2026–2027 Releases (Ane Wali) */}
      {upcomingTitles.length > 0 && !initialQuery && (
        <section id="upcoming-releases" className="mx-auto max-w-7xl px-3 pt-8 sm:px-4" aria-labelledby="shelf-upcoming">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-wider text-amber-700">
                <Calendar size={12} /> Coming Soon · 2026–2027
              </p>
              <h2 id="shelf-upcoming" className="section-title">Upcoming Movies &amp; Series (Release Calendar)</h2>
              <p className="text-sm text-dim">Countdowns for upcoming Pakistani, Indian, regional &amp; global premieres.</p>
            </div>
            <Link href="/movies/calendar" className="inline-flex items-center gap-1 text-xs font-extrabold text-gold hover:underline">
              Full Release Calendar ({upcomingCount}) <ArrowRight size={13} />
            </Link>
          </div>
          <div className="no-sb -mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-2 sm:grid sm:grid-cols-3 sm:gap-3.5 sm:overflow-visible sm:px-0 lg:grid-cols-6">
            {upcomingTitles.map((m, i) => (
              <div key={m.slug} className="w-[42vw] max-w-[185px] shrink-0 snap-start sm:w-auto sm:max-w-none">
                <MoviePosterCard movie={m} priority={i < 2} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Shelf 1: Free Legal Public-Domain & Open Cinema */}
      {freeFilms.length > 0 && !initialQuery && (
        <section id="free-classics" className="mx-auto max-w-7xl px-3 pt-8 sm:px-4" aria-labelledby="shelf-free">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-wider text-emerald-700">
                <Play size={12} fill="currentColor" /> Instant Legal Playback
              </p>
              <h2 id="shelf-free" className="section-title">Watch Full Classics Free (Public Domain &amp; Open Cinema)</h2>
              <p className="text-sm text-dim">Verified public-domain and Creative Commons films streaming directly in Mizanora’s player.</p>
            </div>
          </div>
          <div className="no-sb -mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-2 sm:grid sm:grid-cols-3 sm:gap-3.5 sm:overflow-visible sm:px-0 lg:grid-cols-6">
            {freeFilms.slice(0, 6).map((m, i) => (
              <div key={m.slug} className="w-[42vw] max-w-[185px] shrink-0 snap-start sm:w-auto sm:max-w-none">
                <MoviePosterCard movie={m} priority={i < 2} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Shelf 2: Pakistani Cinema & Hit Urdu Dramas */}
      {pakistaniTitles.length > 0 && !initialQuery && (
        <section id="pakistan-shelf" className="mx-auto max-w-7xl px-3 pt-8 sm:px-4" aria-labelledby="shelf-pk">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-wider text-gold">
                <Sparkles size={12} /> Homegrown Stories
              </p>
              <h2 id="shelf-pk" className="section-title">Pakistani Movies &amp; Blockbuster Dramas</h2>
              <p className="text-sm text-dim">Official trailers, episode guides, cast bios and legal YouTube / TV links.</p>
            </div>
          </div>
          <div className="no-sb -mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-2 sm:grid sm:grid-cols-3 sm:gap-3.5 sm:overflow-visible sm:px-0 lg:grid-cols-6">
            {pakistaniTitles.map((m) => (
              <div key={m.slug} className="w-[42vw] max-w-[185px] shrink-0 snap-start sm:w-auto sm:max-w-none">
                <MoviePosterCard movie={m} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Shelf 3: Regional Spotlight (India, Iran, Afghanistan, Bangladesh, Turkey) */}
      {regionalTitles.length > 0 && !initialQuery && (
        <section className="mx-auto max-w-7xl px-3 pt-8 sm:px-4" aria-labelledby="shelf-reg">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-wider text-saffron">
                <Globe2 size={12} /> Neighbourhood &amp; Regional Hits
              </p>
              <h2 id="shelf-reg" className="section-title">India, Iran, Afghanistan, Bangladesh &amp; Turkish Favourites</h2>
            </div>
          </div>
          <div className="no-sb -mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-2 sm:grid sm:grid-cols-3 sm:gap-3.5 sm:overflow-visible sm:px-0 lg:grid-cols-6">
            {regionalTitles.map((m) => (
              <div key={m.slug} className="w-[42vw] max-w-[185px] shrink-0 snap-start sm:w-auto sm:max-w-none">
                <MoviePosterCard movie={m} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Interactive Search, IMDb ID Jump & Multi-Filter Grid */}
      <MoviesBrowser
        movies={movies}
        initialQuery={initialQuery}
        initialRegion={initialRegion}
        initialFormat={initialFormat}
      />

      {/* Popular Stars & Actors Rail */}
      {actors.length > 0 && (
        <section className="mx-auto max-w-7xl px-3 pt-10 sm:px-4" aria-labelledby="hub-actors">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-gold">Cast &amp; Profiles</p>
              <h2 id="hub-actors" className="section-title">Featured Actors &amp; Stars</h2>
            </div>
            <Link href="/movies/actors" className="inline-flex items-center gap-1 text-sm font-bold text-gold hover:underline">
              All {actors.length} actors <ArrowRight size={15} />
            </Link>
          </div>
          <ul className="no-sb -mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-2 sm:grid sm:grid-cols-4 sm:gap-3 sm:overflow-visible sm:px-0 lg:grid-cols-6">
            {actors.slice(0, 12).map((a) => {
              const hue = posterHue(a.slug || a.name);
              return (
                <li key={a.slug} className="w-40 shrink-0 snap-start sm:w-auto">
                  <Link
                    href={`/movies/actor/${a.slug}`}
                    prefetch={false}
                    className="group flex h-full flex-col items-center rounded-2xl border border-line bg-surface p-3.5 text-center transition hover:-translate-y-0.5 hover:border-gold hover:shadow-md"
                  >
                    {a.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.photo}
                        alt={a.name}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-16 w-16 rounded-full object-cover ring-2 ring-gold/25"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="grid h-16 w-16 place-items-center rounded-full font-display text-lg font-extrabold text-white shadow-inner"
                        style={{
                          background: `linear-gradient(145deg, hsl(${hue}, 58%, 32%), hsl(${(hue + 40) % 360}, 65%, 16%))`,
                        }}
                      >
                        {titleInitials(a.name)}
                      </span>
                    )}
                    <b className="mt-2.5 line-clamp-1 text-sm text-cream group-hover:text-gold">{a.name}</b>
                    <span className="mt-0.5 text-[0.68rem] font-semibold text-faint">{a.country}</span>
                    <span className="mt-1 line-clamp-1 text-[0.66rem] text-dim">{(a.knownFor || [])[0] || a.role}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Editorial Guides Links */}
      <section className="mx-auto max-w-5xl px-4 pt-8 text-sm text-dim">
        <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
          <h2 className="font-display text-lg font-extrabold text-cream">Cinema Guides &amp; Legal Watch Tips</h2>
          <p className="mt-1 leading-relaxed">
            Read our detailed guides on{' '}
            <Link href="/blog/mizanora-movies-and-series-hub-trailers-cast-calendar" className="font-bold text-gold underline">
              how the Mizanora Movies &amp; Series Hub works
            </Link>
            ,{' '}
            <Link href="/blog/best-pakistani-movies-and-dramas-watch-guide-2026" className="font-bold text-gold underline">
              the best Pakistani movies &amp; dramas watch guide
            </Link>
            ,{' '}
            <Link href="/blog/upcoming-movies-release-calendar-2026-2027-pakistan-india-world" className="font-bold text-gold underline">
              upcoming 2026–2027 movies release calendar
            </Link>
            , and{' '}
            <Link href="/blog/watch-classic-public-domain-movies-legally-online-free" className="font-bold text-gold underline">
              watching classic public-domain movies legally for free
            </Link>
            .
          </p>
        </div>
      </section>

      <Suspense fallback={null}>
        <ProductAds
          seed="movies-hub"
          title="Shop on Mizanora While Exploring Cinema"
          note="Fashion, gadgets, watches & home picks — Cash on Delivery across Pakistan"
        />
      </Suspense>
    </>
  );
}
