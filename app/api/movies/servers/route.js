import { NextResponse } from 'next/server';
import { denyIf } from '@/lib/siteGate';
import { getServersForTitle } from '@/lib/movieServersServer';

export const runtime = 'nodejs';
export const revalidate = 120;

// Public: "which play servers can show this title?"
// The templates are public too (they are visible in the browser anyway), so the player can rebuild a
// link when the viewer changes season / episode without another round-trip.
export async function GET(req) {
  const blocked = await denyIf();
  if (blocked) return blocked;

  const { searchParams } = new URL(req.url);
  const info = {
    imdbId: String(searchParams.get('imdb') || searchParams.get('imdbId') || '').slice(0, 20).trim(),
    slug: String(searchParams.get('slug') || '').slice(0, 120).trim(),
    title: String(searchParams.get('title') || '').slice(0, 140).trim(),
    year: Number(searchParams.get('year')) || 0,
    type: searchParams.get('type') === 'series' ? 'series' : 'movie',
    season: Math.max(1, Math.min(99, Number(searchParams.get('season')) || 1)),
    episode: Math.max(1, Math.min(999, Number(searchParams.get('episode')) || 1)),
  };

  if (!info.imdbId && !info.slug) {
    return NextResponse.json({ ok: false, error: 'Send an imdb id or a slug.' }, { status: 400 });
  }

  const pack = await getServersForTitle(info);
  return NextResponse.json(
    {
      ok: true,
      enabled: pack.enabled,
      servers: pack.servers,
      ads: pack.ads,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600' } },
  );
}
