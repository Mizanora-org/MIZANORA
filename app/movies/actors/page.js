import { Suspense } from 'react';
import Link from 'next/link';
import AvatarImg from '@/components/AvatarImg';
import { Award, Calendar, Clapperboard, Search } from 'lucide-react';
import { pageMeta, breadcrumbJsonLd } from '@/lib/seo';
import { absUrl } from '@/lib/config';
import { PageHead } from '@/components/Prose';
import JsonLd from '@/components/JsonLd';
import AdsInject from '@/components/AdsInject';
import ProductAds from '@/components/ProductAds';
import { enrichActorsWithPhotos, getMoviesHub } from '@/lib/moviesServer';
import { seedActorRows, seedCastSize } from '@/lib/imdbSeed';
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
  const letter = String(sp.letter || '').trim().toUpperCase().slice(0, 1);
  const page = Math.max(0, Math.min(400, Number(sp.page) || 0));

  const { actors, movies } = await getMoviesHub();
  // v51: fill missing portraits from the official IMDb suggestion endpoint (cached 12h).
  const filtered = await enrichActorsWithPhotos(searchActors(q, actors, { region, limit: 200 }), 12);
  // v57 — the snapshot cast directory: 10,000+ real people with three or more titles, straight from
  // IMDb's cast lists. The curated profiles above stay first; this is the deep directory below them.
  const PER_PAGE = 60;
  const cast = seedActorRows({ q, letter, offset: page * PER_PAGE, limit: PER_PAGE, minTitles: 3 });
  const castTotal = seedCastSize(3);
  const hrefFor = ({ page: n = 0, letter: l = letter, query = q } = {}) => {
    const p = new URLSearchParams();
    if (query) p.set('q', query);
    if (region && region !== 'all') p.set('region', region);
    if (l) p.set('letter', l);
    if (n > 0) p.set('page', String(n));
    const qs = p.toString();
    return qs ? `/movies/actors?${qs}` : '/movies/actors';
  };
  const pageHref = (n) => hrefFor({ page: n });

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
                        <AvatarImg
                          src={a.photo}
                          name={a.name}
                          hue={hue}
                          initials={titleInitials(a.name)}
                          className="h-16 w-16 shrink-0 rounded-full object-cover shadow ring-2 ring-gold/25"
                        />
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
            No curated profile matched &quot;{q}&quot;. The IMDb cast directory below has {castTotal.toLocaleString('en-US')} people — try the search there, or{' '}
            <Link href="/movies/actors" className="font-bold text-gold underline">
              view all actors
            </Link>
            .
          </div>
        )}

        {/* v57 — IMDb cast directory (paginated). Real names, real title counts, no invented bios. */}
        <div className="mt-8 rounded-3xl border border-line bg-surface p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-gold">IMDb cast directory</p>
              <h2 className="section-title">Every actor &amp; actress in the catalogue</h2>
              <p className="mt-1 text-xs font-semibold text-dim">
                {castTotal.toLocaleString('en-US')} people with 3+ titles · showing {cast.total.toLocaleString('en-US')} match{cast.total === 1 ? '' : 'es'}
                {q ? ` for “${q}”` : ''}{letter ? ` starting with ${letter}` : ''}
              </p>
            </div>
            <form action="/movies/actors" method="get" className="flex items-center gap-2" role="search">
              {region !== 'all' && <input type="hidden" name="region" value={region} />}
              {letter && <input type="hidden" name="letter" value={letter} />}
              <input name="q" defaultValue={q} placeholder="Cast name…" aria-label="Search cast directory" className="input !w-44 !py-2 text-sm" />
              <button type="submit" className="btn-gold !px-3 !py-2 text-xs">Find</button>
            </form>
          </div>

          <div className="no-sb mt-3 flex gap-1 overflow-x-auto pb-1">
            <Link href={hrefFor({ letter: '' })} className={`shrink-0 rounded-full px-2.5 py-1 text-[0.7rem] font-extrabold ${letter ? 'bg-raised text-cream' : 'bg-gold text-white'}`}>All</Link>
            {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((c) => (
              <Link
                key={c}
                href={hrefFor({ letter: c })}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[0.7rem] font-extrabold ${letter === c ? 'bg-gold text-white' : 'bg-raised text-cream hover:text-gold'}`}
              >
                {c}
              </Link>
            ))}
          </div>

          {cast.rows.length > 0 ? (
            <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {cast.rows.map((a) => (
                <li key={a.slug}>
                  <Link href={`/movies/actor/${a.slug}`} prefetch={false} className="flex items-center gap-3 rounded-xl border border-line bg-raised/40 p-2.5 transition hover:border-gold">
                    <AvatarImg src={null} name={a.name} hue={posterHue(a.slug)} initials={titleInitials(a.name)} className="h-11 w-11 shrink-0 rounded-full object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-extrabold text-cream">{a.name}</span>
                      <span className="block truncate text-[0.7rem] font-semibold text-faint">
                        {a.count} titles{a.from ? ` · ${a.from}${a.to && a.to !== a.from ? `–${a.to}` : ''}` : ''}
                      </span>
                      <span className="block truncate text-[0.68rem] text-dim">Known for: {a.knownFor.slice(0, 2).join(', ')}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-xl bg-raised px-3 py-3 text-sm text-dim">Is naam se koi cast member nahi mila. Spelling check karein ya “All” dabayein.</p>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
            <span className="text-faint">Page {page + 1} of {Math.max(1, Math.ceil(cast.total / PER_PAGE))}</span>
            <div className="flex gap-2">
              {page > 0 && <Link href={pageHref(page - 1)} className="rounded-full border border-line px-3 py-1.5 text-cream hover:border-gold hover:text-gold">← Previous</Link>}
              {page * PER_PAGE + PER_PAGE < cast.total && <Link href={pageHref(page + 1)} className="rounded-full bg-gold px-3 py-1.5 text-white">Next →</Link>}
            </div>
          </div>
        </div>
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
