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

export const revalidate = 1800;

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
  const { movies } = await getMoviesHub();
  const todayIso = new Date().toISOString().slice(0, 10);
  const upcoming = movies.filter((m) => m.status === 'upcoming');

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
            <b>{upcoming.length} upcoming releases</b> tracked — filter by Pakistan, India, Iran, Bangladesh or Hollywood below.
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
        <MoviesCalendarClient movies={movies} todayIso={todayIso} />
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
