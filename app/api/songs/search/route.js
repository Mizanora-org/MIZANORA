import { NextResponse } from 'next/server';
import { searchSongs, getTrendingSongs } from '@/lib/songsServer';

export const runtime = 'nodejs';
export const revalidate = 300;

// Public song search. The browser never talks to the music mirrors directly (they send no CORS
// headers) — it calls this route, which races the mirrors server-side.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q = String(searchParams.get('q') || '').slice(0, 80).trim();
  const limit = Math.max(1, Math.min(40, Number(searchParams.get('limit')) || 24));

  if (!q) {
    const items = await getTrendingSongs(limit).catch(() => []);
    return NextResponse.json({ ok: true, query: '', trending: true, items, upstream: items.length ? 'ok' : 'down' }, {
      headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' },
    });
  }

  const result = await searchSongs(q, limit).catch(() => ({ items: [], upstream: 'down' }));
  const items = result.items || [];
  return NextResponse.json({ ok: true, query: q, items, upstream: result.upstream || (items.length ? 'ok' : 'down') }, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=1800' },
  });
}
