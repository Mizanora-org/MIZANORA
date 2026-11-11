import { NextResponse } from 'next/server';
import { denyIf } from '@/lib/siteGate';
import { getEffectiveTmdbKey, getMoviesHub } from '@/lib/moviesServer';
import { isValidImdbId, searchActors, searchMovies } from '@/lib/movies';
import { searchWorldCatalog } from '@/lib/moviesAutoFeed';
import { cinemetaSearch } from '@/lib/cinemeta';
import { searchSeed } from '@/lib/imdbSeed';

export const runtime = 'nodejs';
// v61: NO ISR here — the query string makes every search a new cache entry.
// ISR writes are capped at 200K/30 days on Hobby (620K is what paused the site); the `s-maxage`
// header on the response already caches it at the edge for free.
export const dynamic = 'force-dynamic';

// Public: live search across Mizanora's own hub AND the world catalogues (TMDB / IMDb / TVmaze).
// This is what makes "har tarah ki movie" findable: if a visitor can name it, IMDb can return its
// tt... id, and /movies/tt... resolves the full page on demand.
export async function GET(req) {
  const blocked = await denyIf();
  if (blocked) return blocked;

  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get('q') || '').slice(0, 80).trim();
  const limit = Math.max(1, Math.min(40, Number(searchParams.get('limit')) || 24));
  // v55: "all" (default) searches films AND series; the browser can now filter by type.
  const rawType = String(searchParams.get('type') || 'all').toLowerCase();
  const type = rawType === 'movie' || rawType === 'series' ? rawType : 'all';

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
  let snapshot = [];
  try {
    // The IMDb snapshot is in memory (a file read once), so it answers instantly and covers
    // 16,000+ films and ~900 series even when nothing else is reachable.
    snapshot = searchSeed(q, { type, limit: 18 });
  } catch { /* no snapshot */ }
  try {
    const { movies, actors, config } = await getMoviesHub();
    if (config.enabled) {
      local = searchMovies(q, movies, { limit: 18 });
      localActors = searchActors(q, actors, { limit: 6 });
    }
  } catch {
    /* the snapshot and world catalogues can still answer */
  }

  // v54: IMDb's own catalogue (Cinemeta) in parallel with the other world sources. Its posters
  // and IDs are the official ones, so its hits go first after the shop's own library.
  const [world, cine] = await Promise.all([
    (async () => {
      try {
        const tmdbApiKey = await getEffectiveTmdbKey();
        return await searchWorldCatalog(q, { tmdbApiKey, limit: Math.max(12, limit), timeoutMs: 4500 });
      } catch {
        return { items: [], sources: [] };
      }
    })(),
    cinemetaSearch(q, { timeout: 4500 }).catch(() => []),
  ]);

  const seen = new Set();
  const items = [];
  for (const m of [...local, ...snapshot, ...cine, ...(world.items || [])]) {
    if (m && type !== 'all' && m.type !== type) continue;
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
      snapshotCount: snapshot.length,
      type,
      items,
      actors: localActors.map((a) => ({
        slug: a.slug,
        name: a.name,
        role: a.role,
        photo: a.photo || '',
        href: `/movies/actor/${a.slug}`,
      })),
      sources: [...(snapshot.length ? [{ source: 'IMDb snapshot', count: snapshot.length }] : []), ...(cine.length ? [{ source: 'IMDb catalogue', count: cine.length }] : []), ...(world.sources || [])],
    },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=1800' } },
  );
}
