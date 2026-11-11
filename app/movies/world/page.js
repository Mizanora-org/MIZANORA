import Link from 'next/link';
import { ArrowLeft, ArrowRight, Clapperboard, Film, Tv } from 'lucide-react';
import { pageMeta, breadcrumbJsonLd } from '@/lib/seo';
import { PageHead } from '@/components/Prose';
import JsonLd from '@/components/JsonLd';
import MoviePosterCard from '@/components/MoviePosterCard';
import { cinemetaCatalog } from '@/lib/cinemeta';
import { WORLD_GENRES } from '@/lib/moviesWorld';

// v61: STATIC page (editorial page, changes only with a deploy). No `revalidate` on purpose: every regeneration is an ISR write
// (Hobby: 200K / 30 days) AND a full origin transfer. It is rebuilt on deploy; live data lives on
// the dynamic pages and in the APIs.


const PER_PAGE = 48;

export const metadata = {
  ...pageMeta({
    title: 'All Movies & Series — IMDb World Catalogue',
    description:
      'Browse the full IMDb catalogue on Mizanora: top movies, top series and every big genre, straight from IMDb (Cinemeta). Every title opens a real page with cast, story, rating and the Mizanora player.',
    path: '/movies/world',
  }),
  keywords: ['all movies', 'imdb catalogue', 'imdb movies list', 'watch movies online', 'mizanora world catalogue'],
};

const qs = ({ type, genre, page }) => {
  const p = new URLSearchParams();
  if (type === 'series') p.set('type', 'series');
  if (genre) p.set('genre', genre);
  if (page > 0) p.set('page', String(page));
  const s = p.toString();
  return s ? `/movies/world?${s}` : '/movies/world';
};

export default async function WorldCataloguePage({ searchParams }) {
  const sp = (await searchParams) || {};
  const type = String(sp.type || 'movie') === 'series' ? 'series' : 'movie';
  const genre = WORLD_GENRES.includes(String(sp.genre || '')) ? String(sp.genre) : '';
  const page = Math.max(0, Math.min(400, Number(sp.page) || 0));

  const movies = await cinemetaCatalog({ type, genre, skip: page * PER_PAGE, timeout: 7000 }).catch(() => []);
  const hasNext = movies.length >= 24;

  const crumbs = [['/', 'Home'], ['/movies', 'Movies & Series'], ['/movies/world', 'World Catalogue']];

  return (
    <>
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <PageHead
        title="All Movies &amp; Series — IMDb World Catalogue"
        intro="IMDb ki poori catalogue: top movies, top series aur har bara genre. Koi bhi title kholein — asal poster, rating, cast aur Mizanora ka player."
        crumbs={crumbs}
      />

      <div className="mx-auto max-w-7xl px-3 sm:px-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Link
            href={qs({ type: 'movie', genre, page: 0 })}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-extrabold ${type === 'movie' ? 'bg-gold text-white' : 'border border-line bg-surface text-dim hover:text-gold'}`}
          >
            <Film size={13} /> Movies
          </Link>
          <Link
            href={qs({ type: 'series', genre, page: 0 })}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-extrabold ${type === 'series' ? 'bg-gold text-white' : 'border border-line bg-surface text-dim hover:text-gold'}`}
          >
            <Tv size={13} /> Series
          </Link>
          <span className="mx-1 h-5 w-px bg-line" />
          <Link href={qs({ type, page: 0 })} className={`rounded-full px-3 py-1.5 text-xs font-bold ${!genre ? 'bg-raised text-cream' : 'text-dim hover:text-gold'}`}>
            All genres
          </Link>
          {WORLD_GENRES.map((g) => (
            <Link
              key={g}
              href={qs({ type, genre: g, page: 0 })}
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${genre === g ? 'bg-raised text-cream' : 'text-dim hover:text-gold'}`}
            >
              {g}
            </Link>
          ))}
        </div>

        {movies.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center">
            <Clapperboard className="mx-auto text-faint" size={30} />
            <p className="mt-3 font-display text-lg font-extrabold text-cream">Catalogue abhi jawab nahi de raha</p>
            <p className="mt-1 text-sm text-dim">
              IMDb catalogue se data nahi aaya. Search dobara try karein ya{' '}
              <Link href="/movies" className="font-bold text-gold hover:underline">hub par wapas jayein</Link>.
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {movies.map((m, i) => (
              <li key={m.imdbId || m.slug}>
                <MoviePosterCard movie={m} priority={i < 6} />
              </li>
            ))}
          </ul>
        )}

        <div className="mb-10 mt-6 flex items-center justify-between gap-3">
          {page > 0 ? (
            <Link href={qs({ type, genre, page: page - 1 })} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-4 py-2 text-xs font-extrabold text-cream hover:border-gold">
              <ArrowLeft size={14} /> Pichla
            </Link>
          ) : <span />}
          <span className="text-xs font-bold text-faint">Page {page + 1}</span>
          {hasNext ? (
            <Link href={qs({ type, genre, page: page + 1 })} className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-extrabold text-white hover:brightness-95">
              Agla <ArrowRight size={14} />
            </Link>
          ) : <span />}
        </div>
      </div>
    </>
  );
}
