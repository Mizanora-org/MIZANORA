import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowRight, Clapperboard, Users } from 'lucide-react';
import { pageMeta, breadcrumbJsonLd } from '@/lib/seo';
import { absUrl } from '@/lib/config';
import { PageHead } from '@/components/Prose';
import JsonLd from '@/components/JsonLd';
import AdsInject from '@/components/AdsInject';
import ProductAds from '@/components/ProductAds';
import MoviesCalendarClient from '@/components/MoviesCalendarClient';
import { getMoviesHub } from '@/lib/moviesServer';
import { seedNewest, seedUpcoming } from '@/lib/imdbSeed';
import { enrichReleaseDates, upcomingFromPool } from '@/lib/releaseDates';

export const revalidate = 1800;
// Cinemeta look-ups are budgeted (see enrichReleaseDates); 20s keeps a cold render inside the limit
export const maxDuration = 20;

export const metadata = {
  ...pageMeta({
    title: 'Movies & Series Release Calendar (2026–2027) — Pakistan, India & Global',
    description:
      'Upcoming movies and web series release calendar for 2026 and 2027 on Mizanora. Track Pakistani films & dramas, Bollywood releases, Iranian, Bangladeshi and Hollywood premiere dates.',
    path: '/movies/calendar',
  }),
  keywords: [
    'upcoming movies 2026 2027',
    'movies release calendar',
    'upcoming pakistani movies',
    'upcoming pakistani dramas',
    'upcoming bollywood movies 2027',
    'mizanora movies calendar',
  ],
};

export default async function MoviesCalendarPage() {
  const { movies: hubMovies } = await getMoviesHub();
  const todayIso = new Date().toISOString().slice(0, 10);
  // v55: the IMDb snapshot keeps this calendar populated even when Cinemeta cannot be reached.
  // v59: next year's announcements live in the id pool without a title, so Cinemeta is asked for a
  // handful of them. This is what keeps the calendar from opening on "0 upcoming releases".
  const poolUpcoming = await upcomingFromPool({ limit: 40, budgetMs: 6000, concurrency: 10 }).catch(() => []);
  const seen = new Set();
  const movies = [...hubMovies, ...poolUpcoming, ...seedUpcoming(60), ...seedNewest(400)].filter((m) => {
    if (!m || !m.slug || seen.has(m.slug)) return false;
    seen.add(m.slug);
    return true;
  });

  // v59 — the snapshot only knows the year, which is why everything sat under "date TBA". Ask
  // Cinemeta for the exact day (same source the rest of the catalogue uses), a few at a time and
  // with a time budget; anything it does not answer keeps its honest "date TBA" group.
  await enrichReleaseDates(movies, { limit: 200, budgetMs: 8000, concurrency: 12 });

  // v60 — THE CALENDAR SHIPPED EVERY MOVIE OBJECT TO THE BROWSER.
  // The client only draws six fields of a card, but the whole hub object (long story, awards, full
  // cast, links, ratings...) travelled in the page payload: 745 KB of inline data for 1,700 nodes.
  // A slim copy is all the calendar needs - same screen, a fraction of the bytes.
  const slimMovies = movies.slice(0, 900).map((m) => ({
    slug: m.slug,
    title: m.title,
    year: m.year,
    region: m.region,
    type: m.type,
    status: m.status,
    releaseDate: m.releaseDate || '',
    poster: m.poster || '',
    posterSrc: m.posterSrc || '',
    imdbId: m.imdbId || '',
    tagline: m.tagline || '',
    story: m.story ? String(m.story).slice(0, 160) : '',
    cast: (m.cast || []).slice(0, 3).map((c) => ({ name: c.name })),
    off: Boolean(m.off),
  }));

  const upcoming = movies.filter((m) => m.status === 'upcoming');
  const dated = movies.filter((m) => /^\d{4}-\d{2}-\d{2}$/.test(m.releaseDate || '')).length;

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Mizanora Upcoming Movies & Series Release Calendar',
    itemListElement: upcoming.slice(0, 30).map((m, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: `${m.title} (${m.releaseDate || m.year})`,
      url: absUrl(`/movies/${m.slug}`),
    })),
  };

  return (
    <>
      <JsonLd
        data={[
          itemListLd,
          breadcrumbJsonLd([
            ['/', 'Home'],
            ['/movies', 'Movies & Series'],
            ['/movies/calendar', 'Release Calendar'],
          ]),
        ]}
      />

      <PageHead
        title="Movies & Series Release Calendar"
        intro="Track upcoming theatrical releases, drama premieres and recent cinema highlights across Pakistan, South Asia and the world."
        crumbs={[['/', 'Home'], ['/movies', 'Movies & Series'], [null, 'Release Calendar']]}
      />

      <section className="mx-auto max-w-6xl px-3 pt-4 sm:px-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-gradient-to-r from-[#0B6B45] to-[#13293d] p-4 text-white">
          <p className="text-sm font-semibold">
            {upcoming.length > 0 ? (
              <>
                <b>{upcoming.length} upcoming releases</b> · <b>{dated}</b> exact dates confirmed — track them by region and type below.
              </>
            ) : (
              <>
                <b>{dated}</b> exact dates confirmed — agla release abhi announce nahi hua, neeche recent releases ka calendar mojood hai.
              </>
            )}
          </p>
          <div className="flex flex-wrap gap-3 text-xs font-extrabold">
            <Link href="/movies" className="inline-flex items-center gap-1 text-[#F5B83D] hover:underline">
              <Clapperboard size={14} /> Movies Hub
            </Link>
            <Link href="/movies/actors" className="inline-flex items-center gap-1 text-white hover:underline">
              <Users size={14} /> Actors <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        <AdsInject slots={['auto']} />
        <MoviesCalendarClient movies={slimMovies} todayIso={todayIso} />
      </section>

      <Suspense fallback={null}>
        <ProductAds
          seed="movies-calendar"
          title="Shop Trending Mizanora Deals"
          note="Cash on Delivery across Pakistan"
        />
      </Suspense>
    </>
  );
}
