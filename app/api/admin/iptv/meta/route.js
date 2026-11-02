import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { verifyAdmin } from '@/lib/adminAuth';
import { adminReady } from '@/lib/firebase-admin';
import { VOD_DOC, cleanVod, vodStats } from '@/lib/iptvVod';
import { readShardedDoc, writeShardedDoc } from '@/lib/gateway/shards';
import { enrichList, imdbStatus, searchImdb } from '@/lib/gateway/imdb';
import { titleOf, yearOf } from '@/lib/iptvMeta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 55;

const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });

// IMDb metadata (Cinemeta) — movies/series par poster, rating, plot, cast, year.
//   GET                                  -> { provider, cached, missing }
//   POST { action:'enrich', kind, limit } -> batch enrich + save
//   POST { action:'search', q, kind }     -> sirf test (kuch save nahi)
export async function GET(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  if (!adminReady()) return json({ ok: true, demo: true, ...imdbStatus(), missing: { movies: 0, series: 0 } });

  const vod = cleanVod(await readShardedDoc(VOD_DOC.collection, VOD_DOC.id, ['movies', 'series']));
  return json({
    ok: true,
    ...imdbStatus(),
    missing: {
      movies: vod.movies.filter((m) => !m.imdbId || !m.poster || !m.plot).length,
      series: vod.series.filter((s) => !s.imdbId || !s.poster || !s.plot).length,
    },
    stats: vodStats(vod),
  });
}

export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);

  let b;
  try { b = await req.json(); } catch { return json({ ok: false, error: 'Bad request' }, 400); }
  const action = String(b.action || 'enrich');
  const kind = b.kind === 'series' ? 'series' : 'movies';

  if (action === 'search') {
    const q = String(b.q || '').trim();
    if (!q) return json({ ok: false, error: 'Naam likhein.' }, 400);
    const metas = await searchImdb(b.kind === 'series' ? 'series' : 'movie', titleOf(q) || q);
    return json({
      ok: true,
      query: { title: titleOf(q), year: yearOf(q) },
      results: metas.slice(0, 8).map((m) => ({
        name: m.name, year: m.releaseInfo || m.year || '', imdbId: m.imdb_id || m.id || '',
        poster: m.poster || '', rating: m.imdbRating || '',
      })),
    });
  }

  if (!adminReady()) return json({ ok: false, error: 'Firestore connect karein (FIREBASE_SERVICE_ACCOUNT).' }, 503);

  try {
    const vod = cleanVod(await readShardedDoc(VOD_DOC.collection, VOD_DOC.id, ['movies', 'series']));
    const list = kind === 'series' ? vod.series : vod.movies;
    if (!list.length) return json({ ok: false, error: 'Pehle movies/series import karein.' }, 400);

    const result = await enrichList(list, kind === 'series' ? 'series' : 'movie', {
      limit: Math.min(40, Math.max(1, Number(b.limit) || 16)),
      onlyMissing: b.onlyMissing !== false,
    });

    const next = cleanVod({ ...vod, [kind]: result.list, updatedAt: Date.now() });
    await writeShardedDoc(VOD_DOC.collection, VOD_DOC.id, next, ['movies', 'series']);
    revalidateTag('iptv');

    return json({
      ok: true,
      filled: result.filled,
      scanned: result.scanned,
      misses: result.misses.slice(0, 8),
      stats: vodStats(next),
      done: result.left === 0,
    });
  } catch (e) {
    console.error('meta enrich:', e.message);
    return json({ ok: false, error: e.message || 'IMDb se data nahi aaya.' }, 500);
  }
}
