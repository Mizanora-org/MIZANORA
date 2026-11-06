import { NextResponse } from 'next/server';
import { audioUrl, resolveSongById } from '@/lib/songMirrors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// /api/songs/stream/<id> — resolve one song and hand the browser everything it may need:
// the Mizanora play URL, the raw CDN link (fallback), the mirror that answered, and the proxy URL.
export async function GET(req, context) {
  const { id } = await context.params;
  const clean = String(id || '').trim();
  if (!/^[A-Za-z0-9_-]{4,}$/.test(clean)) {
    return NextResponse.json({ ok: false, error: 'Bad song id' }, { status: 400 });
  }
  const { song, via } = await resolveSongById(clean);
  if (!song) {
    return NextResponse.json(
      { ok: false, id: clean, error: 'All music mirrors are unreachable right now.' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }
  return NextResponse.json({
    ok: true,
    id: clean,
    via,
    song,
    playUrl: audioUrl(clean),
    proxyUrl: `${audioUrl(clean)}?proxy=1`,
    direct: song.stream || '',
  }, { headers: { 'cache-control': 'public, s-maxage=600, stale-while-revalidate=3600' } });
}
