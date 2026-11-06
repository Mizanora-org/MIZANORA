import { NextResponse } from 'next/server';
import { getSongById } from '@/lib/songsServer';

export const runtime = 'nodejs';
export const revalidate = 3600;

// One song's details + its best audio link, for the client player.
export async function GET(req, context) {
  const { id } = await context.params;
  const song = await getSongById(id).catch(() => null);
  if (!song) return NextResponse.json({ ok: false, error: 'Song not found' }, { status: 404 });
  return NextResponse.json({ ok: true, song }, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
