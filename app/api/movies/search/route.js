import { NextResponse } from 'next/server';
import { denyIf } from '@/lib/siteGate';
import { getEffectiveTmdbKey, getMoviesHub } from '@/lib/moviesServer';
import { isValidImdbId, searchActors, searchMovies } from '@/lib/movies';
import { searchWorldCatalog } from '@/lib/moviesAutoFeed';

export const runtime = 'nodejs';
export const revalidate = 300;

// Public: live search across Mizanora's own hub AND the world catalogues (TMDB / IMDb / TVmaze).
// This is what makes "har tarah ki movie" findable: if a visitor can name it, IMDb can return its
// tt... id, and /movies/tt... resolves the full page on demand.
export async function GET(req) {
  const blocked = await denyIf();
  if (blocked) return blocked;

  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get('q') || '').slice(0, 80).trim();
  const limit = Math.max(1, Math.min(40, Number(searchParams.get('limit')) || 24));

  if (q.length < 2) {
    return NextResponse.json({ ok: true, query: q, items: [], actors: [], sources: [] });
  }

  // An exact IMDb ID opens straight away - no need to search the world.
  if (isValidImdbId(q)) {
    return NextResponse.json({
      ok: true,
      query: q,
      imdbId: q.toLowerCase(),
      items: [],
      actors: [],
      sources: [{ source: 'IMDb', count: 1 }],
    });
  }

  let local = [];
  let localActors = [];
  try {
    const { movies, actors, config } = await getMoviesHub();
    if (config.enabled) {
      local = searchMovies(q, movies, { limit: 18 });
      localActors = searchActors(q, actors, { limit: 6 });
    }
  } catch {
    /* the world catalogue below can still answer */
  }

  let world = { items: [], sources: [] };
  try {
    const tmdbApiKey = await getEffectiveTmdbKey();
    world = await searchWorldCatalog(q, { tmdbApiKey, limit: Math.max(12, limit), timeoutMs: 4500 });
  } catch {
    /* keep the local hits */
  }

  const seen = new Set();
  const items = [];
  for (const m of [...local, ...(world.items || [])]) {
    if (!m) continue;
    const key = (m.imdbId || m.slug || '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    items.push({
      slug: m.slug,
      imdbId: m.imdbId || '',
      title: m.title,
      year: m.year,
      type: m.type,
      poster: m.poster || '',
      rating: m.rating || 0,
      genres: (m.genres || []).slice(0, 3),
      region: m.region,
      releaseDate: m.releaseDate || '',
      status: m.status,
      // Where to open it: the IMDb id always resolves on-demand, even when the title is not stored.
      href: m.imdbId ? `/movies/${m.imdbId}` : `/movies/${m.slug}`,
      inLibrary: local.some((x) => (x.imdbId && x.imdbId === m.imdbId) || x.slug === m.slug),
    });
    if (items.length >= limit) break;
  }

  return NextResponse.json(
    {
      ok: true,
      query: q,
      localCount: local.length,
      items,
      actors: localActors.map((a) => ({
        slug: a.slug,
        name: a.name,
        role: a.role,
        photo: a.photo || '',
        href: `/movies/actor/${a.slug}`,
      })),
      sources: world.sources || [],
    },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=1800' } },
  );
}
