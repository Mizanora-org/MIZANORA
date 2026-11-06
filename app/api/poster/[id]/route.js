import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 20;

// Mizanora v58 — POSTERS FROM OUR OWN DOMAIN.
//
// The reference site (minexustv2026) always showed posters, even on networks where the image CDNs are
// blocked, because every picture is fetched server-side and handed to the browser from its own
// domain. Mizanora used to point <img> straight at images.metahub.space: on many Pakistani ISPs that
// host is slow or blocked, so cards fell back to initials. This route fixes that for good:
//
//   GET /api/poster/tt1375666               -> poster
//   GET /api/poster/tt1375666?k=backdrop    -> wide backdrop
//
// It tries, in order: metahub medium -> metahub small -> metahub large -> TMDB (only when an admin
// TMDB key is configured). The answer is streamed from mizanora.vercel.app and cached at the edge, so
// the visitor's browser never talks to a blocked host, and repeat views cost nothing.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const OK_CACHE = 'public, max-age=604800, s-maxage=2592000, stale-while-revalidate=604800';
const MISS_CACHE = 'public, max-age=300, s-maxage=3600';

const isId = (v) => /^tt\d{6,10}$/i.test(String(v || '').trim());

export async function GET(req, { params }) {
  const { id: rawId } = await params;
  const id = String(rawId || '').trim().toLowerCase();
  const kind = String(req.nextUrl.searchParams.get('k') || 'poster').toLowerCase() === 'backdrop' ? 'backdrop' : 'poster';
  if (!isId(id)) return new NextResponse('bad id', { status: 400, headers: { 'Cache-Control': MISS_CACHE } });

  const candidates = kind === 'backdrop'
    ? [
        `https://images.metahub.space/background/medium/${id}/img`,
        `https://images.metahub.space/background/small/${id}/img`,
        `https://images.metahub.space/background/large/${id}/img`,
      ]
    : [
        `https://images.metahub.space/poster/medium/${id}/img`,
        `https://images.metahub.space/poster/small/${id}/img`,
        `https://images.metahub.space/poster/large/${id}/img`,
      ];

  const tmdb = await tmdbFallback(id, kind);
  if (tmdb) candidates.push(tmdb);

  for (const url of candidates) {
    const hit = await fetchImage(url);
    if (hit) {
      return new NextResponse(hit.body, {
        status: 200,
        headers: {
          'Content-Type': hit.type,
          ...(hit.length ? { 'Content-Length': String(hit.length) } : {}),
          'Cache-Control': OK_CACHE,
          'X-Poster-Source': new URL(url).hostname,
        },
      });
    }
  }

  // Nothing anywhere: a tiny transparent PNG keeps the layout intact, the client shows its own art.
  return new NextResponse('no poster', { status: 404, headers: { 'Cache-Control': MISS_CACHE } });
}

async function fetchImage(url) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 8000) : null;
  try {
    const res = await fetch(url, {
      ...(ctrl ? { signal: ctrl.signal } : {}),
      headers: { 'user-agent': UA, accept: 'image/*' },
      redirect: 'follow',
    });
    if (!res || !res.ok) return null;
    const type = String(res.headers.get('content-type') || '');
    if (!type.startsWith('image/')) return null;
    const length = Number(res.headers.get('content-length')) || 0;
    if (length && length > 12 * 1024 * 1024) return null;
    const buf = await res.arrayBuffer();
    if (!buf.byteLength || buf.byteLength > 12 * 1024 * 1024) return null;
    return { body: buf, type, length: buf.byteLength };
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Optional TMDB fallback — only used when the admin has configured a key. */
async function tmdbFallback(imdbId, kind) {
  try {
    const { getEffectiveTmdbKey } = await import('@/lib/moviesServer');
    const key = String((await getEffectiveTmdbKey()) || '').trim();
    if (!key) return '';
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 7000) : null;
    const res = await fetch(`https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id&api_key=${encodeURIComponent(key)}`, {
      ...(ctrl ? { signal: ctrl.signal } : {}),
      headers: { accept: 'application/json', 'user-agent': UA },
    });
    if (timer) clearTimeout(timer);
    if (!res || !res.ok) return '';
    const data = await res.json();
    const list = [...(data.movie_results || []), ...(data.tv_results || [])];
    const hit = list.find((x) => x && (kind === 'backdrop' ? x.backdrop_path : x.poster_path));
    if (!hit) return '';
    return kind === 'backdrop'
      ? `https://image.tmdb.org/t/p/w1280${hit.backdrop_path}`
      : `https://image.tmdb.org/t/p/w500${hit.poster_path}`;
  } catch {
    return '';
  }
}
