import { Suspense } from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowRight, Award, Clapperboard, Globe2, MapPin, Users } from 'lucide-react';
import { pageMeta, breadcrumbJsonLd } from '@/lib/seo';
import { absUrl } from '@/lib/config';
import { PageHead } from '@/components/Prose';
import JsonLd from '@/components/JsonLd';
import AdsInject from '@/components/AdsInject';
import ProductAds from '@/components/ProductAds';
import MoviePosterCard from '@/components/MoviePosterCard';
import AvatarImg from '@/components/AvatarImg';
import { resolveActorProfile } from '@/lib/moviesServer';
import {
  actorFilmography,
  mergeMoviesCatalog,
  posterHue,
  titleInitials,
} from '@/lib/movies';

export const revalidate = 3600;

export function generateStaticParams() {
  const { actors } = mergeMoviesCatalog();
  return actors.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const { actor } = await resolveActorProfile(slug);
  if (!actor) return {};
  return {
    ...pageMeta({
      title: `${actor.name} — Biography, Movies, Dramas & Filmography`,
      description: `${actor.name} (${actor.role}, ${actor.country}) — biography, awards, known-for titles and complete movies & series filmography on Mizanora.`,
      path: `/movies/actor/${actor.slug}`,
      image: absUrl(`/api/person/${encodeURIComponent(actor.name)}`),
    }),
    keywords: [
      actor.name,
      `${actor.name} movies`,
      `${actor.name} dramas`,
      `${actor.name} biography`,
      actor.country,
      ...(actor.knownFor || []),
    ],
  };
}

export default async function ActorDetailPage({ params }) {
  const { slug } = await params;
  const { actor, movies, actors } = await resolveActorProfile(slug);
  if (!actor) notFound();

  if (slug.toLowerCase() !== actor.slug.toLowerCase()) {
    redirect(`/movies/actor/${actor.slug}`);
  }

  const credits = actorFilmography(actor, movies);
  const peers = actors
    .filter((a) => a.slug !== actor.slug && a.region === actor.region)
    .slice(0, 6);
  const hue = posterHue(actor.slug || actor.name);

  const personLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: actor.name,
    jobTitle: actor.role,
    description: actor.bio,
    url: absUrl(`/movies/actor/${actor.slug}`),
    ...(actor.birthPlace ? { birthPlace: { '@type': 'Place', name: actor.birthPlace } } : {}),
    nationality: { '@type': 'Country', name: actor.country },
    ...(actor.imdbId ? { sameAs: [`https://www.imdb.com/name/${actor.imdbId}/`] } : {}),
    knowsAbout: actor.knownFor || [],
  };

  return (
    <>
      <JsonLd
        data={[
          personLd,
          breadcrumbJsonLd([
            ['/', 'Home'],
            ['/movies', 'Movies & Series'],
            ['/movies/actors', 'Actors & Cast'],
            [`/movies/actor/${actor.slug}`, actor.name],
          ]),
        ]}
      />

      <PageHead
        title={actor.name}
        intro={`${actor.role} · ${actor.country}`}
        crumbs={[
          ['/', 'Home'],
          ['/movies', 'Movies & Series'],
          ['/movies/actors', 'Actors & Cast'],
          [null, actor.name],
        ]}
      />

      {/* Actor Hero Card */}
      <section className="mx-auto max-w-6xl px-3 pt-4 sm:px-4">
        <div className="rounded-3xl border border-line bg-surface p-5 shadow-md sm:p-7">
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            <AvatarImg
              src={actor.photo || `/api/person/${encodeURIComponent(actor.name)}`}
              name={actor.name}
              hue={hue}
              initials={titleInitials(actor.name)}
              className="h-28 w-28 shrink-0 rounded-full object-cover shadow-lg ring-4 ring-gold/20 sm:h-32 sm:w-32"
            />

            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span className="rounded-full bg-gold/10 px-3 py-1 text-xs font-extrabold text-gold">
                  {actor.role}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-raised px-3 py-1 text-xs font-bold text-dim">
                  <Globe2 size={12} /> {actor.country}
                </span>
                {actor.birthPlace && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-raised px-3 py-1 text-xs font-semibold text-dim">
                    <MapPin size={12} /> {actor.birthPlace}
                  </span>
                )}
                {actor.imdbId && (
                  <a
                    href={`https://www.imdb.com/name/${actor.imdbId}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-ink px-3 py-1 font-mono text-xs font-bold text-gold hover:underline"
                  >
                    IMDb: {actor.imdbId}
                  </a>
                )}
              </div>

              <h2 className="mt-3 font-display text-2xl font-extrabold text-cream sm:text-3xl">
                {actor.name}
              </h2>

              <p className="mt-2.5 text-sm leading-7 text-dim sm:text-base">{actor.bio}</p>

              {actor.awards && (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-saffron/15 px-3.5 py-1.5 text-xs font-bold text-[#7A4E00]">
                  <Award size={14} /> {actor.awards}
                </p>
              )}

              {actor.knownFor && actor.knownFor.length > 0 && (
                <div className="mt-3.5 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
                  <span className="text-xs font-bold text-faint">Known for:</span>
                  {actor.knownFor.map((k) => (
                    <span key={k} className="rounded-lg border border-line bg-ink px-2.5 py-0.5 text-xs font-semibold text-cream">
                      {k}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <AdsInject slots={['auto']} />
      </section>

      {/* Actor Filmography on Mizanora */}
      <section className="mx-auto max-w-6xl px-3 pt-8 sm:px-4" aria-labelledby="actor-credits">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-wider text-gold">
              <Clapperboard size={13} /> Filmography
            </p>
            <h2 id="actor-credits" className="section-title">
              Movies &amp; Series Featuring {actor.name} ({credits.length})
            </h2>
          </div>
          <Link href="/movies" className="inline-flex items-center gap-1 text-sm font-bold text-gold hover:underline">
            All titles <ArrowRight size={15} />
          </Link>
        </div>

        {credits.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {credits.map((m) => (
              <MoviePosterCard key={m.slug} movie={m} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-line bg-surface p-5 text-sm text-dim">
            Explore more titles featuring {actor.name} in the{' '}
            <Link href={`/movies?q=${encodeURIComponent(actor.name)}`} className="font-bold text-gold underline">
              Mizanora Movies &amp; Series Hub
            </Link>
            .
          </div>
        )}
      </section>

      {/* More Stars from Same Region */}
      {peers.length > 0 && (
        <section className="mx-auto max-w-6xl px-3 pt-8 sm:px-4" aria-labelledby="peer-actors">
          <div className="mb-3 flex items-end justify-between gap-4">
            <h2 id="peer-actors" className="section-title">
              More Stars from {actor.region}
            </h2>
            <Link href="/movies/actors" className="inline-flex items-center gap-1 text-sm font-bold text-gold hover:underline">
              <Users size={14} /> Directory <ArrowRight size={14} />
            </Link>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {peers.map((p) => {
              const pHue = posterHue(p.slug);
              return (
                <li key={p.slug}>
                  <Link
                    href={`/movies/actor/${p.slug}`}
                    prefetch={false}
                    className="group flex h-full flex-col items-center rounded-2xl border border-line bg-surface p-3.5 text-center transition hover:border-gold"
                  >
                    <span
                      aria-hidden="true"
                      className="grid h-12 w-12 place-items-center rounded-full font-display text-sm font-extrabold text-white"
                      style={{
                        background: `linear-gradient(145deg, hsl(${pHue}, 58%, 32%), hsl(${(pHue + 40) % 360}, 65%, 16%))`,
                      }}
                    >
                      {titleInitials(p.name)}
                    </span>
                    <b className="mt-2 line-clamp-1 text-xs text-cream group-hover:text-gold">{p.name}</b>
                    <span className="text-[0.65rem] text-faint">{p.country}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Suspense fallback={null}>
        <ProductAds
          seed={`actor-${actor.slug}`}
          title="Popular on Mizanora Store"
          note="Cash on Delivery across Pakistan"
        />
      </Suspense>
    </>
  );
}
