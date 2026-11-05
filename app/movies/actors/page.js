import { Suspense } from 'react';
import Link from 'next/link';
import { Award, Calendar, Clapperboard, Search } from 'lucide-react';
import { pageMeta, breadcrumbJsonLd } from '@/lib/seo';
import { absUrl } from '@/lib/config';
import { PageHead } from '@/components/Prose';
import JsonLd from '@/components/JsonLd';
import AdsInject from '@/components/AdsInject';
import ProductAds from '@/components/ProductAds';
import { getMoviesHub } from '@/lib/moviesServer';
import {
  MOVIE_REGIONS,
  actorFilmography,
  posterHue,
  searchActors,
  titleInitials,
} from '@/lib/movies';

export const revalidate = 1800;

export const metadata = {
  ...pageMeta({
    title: 'Actors, Stars & Directors Directory — Pakistani, South Asian & World Cinema',
    description:
      'Browse profiles, biographies, awards and complete filmographies of Pakistani, Indian, Bangladeshi, Iranian, Turkish and international film & drama stars on Mizanora.',
    path: '/movies/actors',
  }),
  keywords: [
    'pakistani actors',
    'pakistani drama actresses',
    'bollywood actors filmography',
    'iranian actors',
    'bangladeshi actors',
    'mizanora actors directory',
  ],
};

export default async function ActorsDirectoryPage({ searchParams }) {
  const sp = (await searchParams) || {};
  const q = String(sp.q || '').slice(0, 80).trim();
  const region = String(sp.region || 'all').slice(0, 40);

  const { actors, movies } = await getMoviesHub();
  const filtered = searchActors(q, actors, { region, limit: 200 });

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Mizanora Actors & Cinema Stars Directory',
    itemListElement: filtered.slice(0, 50).map((a, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: a.name,
      url: absUrl(`/movies/actor/${a.slug}`),
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
            ['/movies/actors', 'Actors & Cast'],
          ]),
        ]}
      />

      <PageHead
        title="Actors, Stars & Directors"
        intro="Explore biographies, awards and filmographies across Pakistani dramas, Lollywood, South Asian cinema and international classics."
        crumbs={[['/', 'Home'], ['/movies', 'Movies & Series'], [null, 'Actors & Cast']]}
      />

      <section className="mx-auto max-w-7xl px-3 pt-4 sm:px-4">
        <div className="rounded-3xl border border-line bg-surface p-4 shadow-sm sm:p-5">
          <form action="/movies/actors" method="get" className="flex flex-col gap-2.5 sm:flex-row" role="search">
            <div className="relative flex-1">
              <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
              <input
                name="q"
                defaultValue={q}
                placeholder="Search actor or star (e.g. Fawad Khan, Mahira Khan, Yumna Zaidi, Chanchal Chowdhury)..."
                aria-label="Search actors"
                className="input !py-2.5 !pl-10 text-sm"
              />
            </div>
            {region !== 'all' && <input type="hidden" name="region" value={region} />}
            <button type="submit" className="btn-gold !py-2.5 text-sm">
              Search Actors
            </button>
          </form>

          <div className="no-sb mt-3 flex gap-1.5 overflow-x-auto pb-1">
            {MOVIE_REGIONS.map((r) => {
              const href =
                r.id === 'all'
                  ? q ? `/movies/actors?q=${encodeURIComponent(q)}` : '/movies/actors'
                  : `/movies/actors?region=${encodeURIComponent(r.id)}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
              const on = region === r.id;
              return (
                <Link
                  key={r.id}
                  href={href}
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold transition ${
                    on
                      ? 'border-gold bg-gold text-white'
                      : 'border-line bg-raised text-cream hover:border-gold hover:text-gold'
                  }`}
                >
                  {r.label}
                </Link>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-faint">
            <span>
              Showing <b className="text-cream">{filtered.length}</b> {filtered.length === 1 ? 'profile' : 'profiles'}
            </span>
            <div className="flex gap-3 font-bold">
              <Link href="/movies" className="inline-flex items-center gap-1 text-gold hover:underline">
                <Clapperboard size={13} /> Movies Hub
              </Link>
              <Link href="/movies/calendar" className="inline-flex items-center gap-1 text-gold hover:underline">
                <Calendar size={13} /> Calendar
              </Link>
            </div>
          </div>
        </div>

        <AdsInject slots={['auto']} />

        {filtered.length > 0 ? (
          <ul className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filtered.map((a) => {
              const hue = posterHue(a.slug || a.name);
              const credits = actorFilmography(a, movies);
              return (
                <li key={a.slug}>
                  <Link
                    href={`/movies/actor/${a.slug}`}
                    prefetch={false}
                    className="group flex h-full flex-col justify-between rounded-2xl border border-line bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-gold hover:shadow-md"
                  >
                    <div>
                      <div className="flex items-center gap-3.5">
                        {a.photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={a.photo}
                            alt={a.name}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-gold/25"
                          />
                        ) : (
                          <span
                            aria-hidden="true"
                            className="grid h-16 w-16 shrink-0 place-items-center rounded-full font-display text-lg font-extrabold text-white shadow"
                            style={{
                              background: `linear-gradient(145deg, hsl(${hue}, 58%, 32%), hsl(${(hue + 42) % 360}, 65%, 16%))`,
                            }}
                          >
                            {titleInitials(a.name)}
                          </span>
                        )}
                        <div className="min-w-0">
                          <h2 className="line-clamp-1 font-display text-lg font-extrabold text-cream group-hover:text-gold">
                            {a.name}
                          </h2>
                          <p className="text-xs font-semibold text-dim">
                            {a.role} · {a.country}
                          </p>
                          <span className="mt-1 inline-block rounded-full bg-gold/10 px-2.5 py-0.5 text-[0.65rem] font-extrabold text-gold">
                            {credits.length} {credits.length === 1 ? 'Title' : 'Titles'} on Mizanora
                          </span>
                        </div>
                      </div>

                      <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-dim">{a.bio}</p>
                    </div>

                    <div className="mt-3 border-t border-line pt-2.5">
                      {a.awards && (
                        <p className="mb-1 line-clamp-1 inline-flex items-center gap-1 text-[0.68rem] font-semibold text-saffron">
                          <Award size={12} /> {a.awards}
                        </p>
                      )}
                      <p className="line-clamp-1 text-[0.7rem] text-faint">
                        Known for: <b className="text-cream">{(a.knownFor || []).slice(0, 3).join(', ') || 'Cinema & TV'}</b>
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-5 rounded-2xl border border-line bg-surface p-6 text-center text-sm text-dim">
            No actor profiles matched &quot;{q}&quot;.{' '}
            <Link href="/movies/actors" className="font-bold text-gold underline">
              View all actors
            </Link>
          </div>
        )}
      </section>

      <Suspense fallback={null}>
        <ProductAds
          seed={`actors-${region}-${q}`}
          title="Shop Style & Everyday Essentials on Mizanora"
          note="Cash on Delivery across Pakistan"
        />
      </Suspense>
    </>
  );
}
