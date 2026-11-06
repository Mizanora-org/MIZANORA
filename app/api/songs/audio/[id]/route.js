import { NextResponse } from 'next/server';
import { resolveSongById } from '@/lib/songMirrors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// /api/songs/audio/<id>            → 302 to the best CDN link (fresh token, every request)
// /api/songs/audio/<id>?proxy=1    → stream the bytes through Mizanora (works when the CDN host is
//                                    blocked on the visitor's network, or the CDN checks Referer)
//
// Why a redirect and not just the CDN link? JioSaavn-style links carry a short-lived token and a
// per-request signature. A page rendered ten minutes ago holds a dead link; this route asks a
// mirror again, so play always starts. And because the URL is ours, the <audio> element never hits
// a CORS or mixed-content wall.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const passthrough = async (url, req, id) => {
  const range = req.headers.get('range') || '';
  let upstream;
  try {
    upstream = await fetch(url, {
      headers: {
        'user-agent': UA,
        accept: '*/*',
        ...(range ? { range } : {}),
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    return new NextResponse('audio host unreachable', { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return new NextResponse('audio unavailable', { status: 502 });
  }
  const type = upstream.headers.get('content-type') || 'audio/mpeg';
  if (!/^(audio\/|application\/octet-stream|binary\/octet-stream)/i.test(type)) {
    return new NextResponse('not audio', { status: 502 });
  }
  const headers = new Headers({
    'content-type': type,
    'cache-control': 'public, max-age=3600',
    'accept-ranges': 'bytes',
    'x-mizanora-song': id,
  });
  for (const h of ['content-length', 'content-range']) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new NextResponse(upstream.body, { status: upstream.status === 206 ? 206 : 200, headers });
};

export async function GET(req, context) {
  const { id } = await context.params;
  const clean = String(id || '').trim();
  if (!/^[A-Za-z0-9_-]{4,}$/.test(clean)) {
    return NextResponse.json({ ok: false, error: 'Bad song id' }, { status: 400 });
  }

  const { song } = await resolveSongById(clean);
  if (!song || !song.stream) {
    return NextResponse.json(
      { ok: false, error: 'No mirror could resolve this song right now.', id: clean },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }

  const wantProxy = req.nextUrl.searchParams.get('proxy') === '1'
    || String(process.env.SONGS_AUDIO_PROXY || '') === '1';

  if (wantProxy) return passthrough(song.stream, req, clean);

  return NextResponse.redirect(song.stream, {
    status: 302,
    headers: { 'cache-control': 'no-store', 'x-mizanora-song': clean },
  });
}
