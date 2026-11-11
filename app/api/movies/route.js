import { NextResponse } from 'next/server';
import { denyIf } from '@/lib/siteGate';
import { getMoviesHub, resolveMovieOrSeries } from '@/lib/moviesServer';
import { buildReleaseCalendar, searchActors, searchMovies } from '@/lib/movies';

export const runtime = 'nodejs';
// v61: the movies index — a day is plenty and keeps ISR writes tiny (see lib/cachePolicy.js).
export const revalidate = 86400;

export async function GET(req) {
  const blocked = await denyIf();
  if (blocked) return blocked;

  const { searchParams } = new URL(req.url);
  const imdb = String(searchParams.get('imdb') || '').trim();
  const q = String(searchParams.get('q') || '').slice(0, 80).trim();
  const region = String(searchParams.get('region') || 'all').slice(0, 40);
  const type = String(searchParams.get('type') || 'all').slice(0, 20);
  const freeOnly = searchParams.get('free') === '1';
  const upcomingOnly = searchParams.get('upcoming') === '1';
  const calendar = searchParams.get('calendar') === '1';
  const limit = Math.max(1, Math.min(100, Number(searchParams.get('limit')) || 30));

  if (imdb) {
    const { movie } = await resolveMovieOrSeries(imdb);
    if (!movie) {
      return NextResponse.json({ ok: false, error: 'Title not found for that IMDb ID.' }, { status: 404 });
    }
    return NextResponse.json(
      { ok: true, item: movie },
      { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' } },
    );
  }

  const { config, movies, actors } = await getMoviesHub();
  if (!config.enabled) {
    return NextResponse.json({ ok: true, enabled: false, items: [], actors: [] });
  }

  if (calendar) {
    return NextResponse.json(
      { ok: true, months: buildReleaseCalendar(movies, { region, type, includeRecent: !upcomingOnly }) },
      { headers: { 'Cache-Control': 'public, s-maxage=600' } },
    );
  }

  const items = searchMovies(q, movies, { type, region, freeOnly, upcomingOnly, limit });
  const matchedActors = q ? searchActors(q, actors, { region, limit: 12 }) : [];

  return NextResponse.json(
    {
      ok: true,
      total: items.length,
      items,
      actors: matchedActors,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800' } },
  );
}
