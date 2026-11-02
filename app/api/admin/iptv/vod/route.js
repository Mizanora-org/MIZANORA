import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { verifyAdmin } from '@/lib/adminAuth';
import { adminDb, adminReady } from '@/lib/firebase-admin';
import { VOD_DOC, cleanVod, cleanMovie, cleanSeries, findVod, parseVodM3U, vodStats } from '@/lib/iptvVod';
import { readShardedDoc, writeShardedDoc, shardInfo } from '@/lib/gateway/shards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (b, s = 200) => NextResponse.json(b, { status: s, headers: { 'Cache-Control': 'no-store' } });
const MAX_BYTES = 16 * 1024 * 1024;

// Admin > IPTV > Movies & Series (VOD).
//   GET                          -> { movies, series, stats }
//   POST { action:'import', url } -> M3U se movies/series (save nahi hota)
//   POST { action:'import', text }
//   POST { action:'save', movies, series }  -> replace
//   POST { action:'append', movies, series } -> purane ke sath add
//   POST { action:'toggle', kind:'movie|series', id } -> on/off
//   POST { action:'remove', kind, id }
//   POST { action:'clear' }
export async function GET(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  if (!adminReady()) return json({ ok: true, demo: true, movies: [], series: [], stats: { movies: 0, series: 0, episodes: 0, groups: 0 } });

  const [data, shards] = await Promise.all([
    readShardedDoc(VOD_DOC.collection, VOD_DOC.id, ['movies', 'series']),
    shardInfo(VOD_DOC.collection, VOD_DOC.id),
  ]);
  const vod = cleanVod(data || {});
  return json({ ok: true, ...vod, shards, stats: vodStats(vod) });
}

export async function POST(req) {
  const a = await verifyAdmin(req);
  if (!a.ok) return json({ ok: false, error: a.error }, a.status);
  if (!adminReady()) return json({ ok: false, error: 'Firestore connect karein (FIREBASE_SERVICE_ACCOUNT) — phir yeh chalega.' }, 503);

  let b;
  try { b = await req.json(); } catch { return json({ ok: false, error: 'Bad request' }, 400); }
  const action = String(b.action || '');
  const db = adminDb();
  const ref = db.collection(VOD_DOC.collection).doc(VOD_DOC.id);
  const readVod = async () => cleanVod(await readShardedDoc(VOD_DOC.collection, VOD_DOC.id, ['movies', 'series']) || {});
  const saveVod = (v) => writeShardedDoc(VOD_DOC.collection, VOD_DOC.id, v, ['movies', 'series']);

  try {
    if (action === 'import') {
      let text = String(b.text || '');
      if (!text && b.url) {
        const url = String(b.url || '').trim();
        if (!/^https?:\/\//i.test(url)) return json({ ok: false, error: 'Link http(s) se shuru hona chahiye.' }, 400);
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 20000);
        try {
          const r = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': 'MizanoraIPTV/1.0' }, cache: 'no-store' });
          if (!r.ok) return json({ ok: false, error: `Playlist ne jawab nahi diya (${r.status}).` }, 400);
          const buf = await r.arrayBuffer();
          if (buf.byteLength > MAX_BYTES) return json({ ok: false, error: 'File 16 MB se bari hai — chhote hisson mein import karein.' }, 413);
          text = new TextDecoder().decode(buf);
        } catch (e) {
          return json({ ok: false, error: e.name === 'AbortError' ? 'Link 20 second mein jawab nahi diya.' : 'Link khola nahi ja saka.' }, 400);
        } finally { clearTimeout(timer); }
      }
      if (!text.trim()) return json({ ok: false, error: 'M3U text ya link dein.' }, 400);
      const parsed = parseVodM3U(text);
      if (!parsed.movies.length && !parsed.series.length) {
        return json({ ok: false, error: 'Is playlist mein movie/series jaisa kuch nahi mila. Naam mein (2023) ya S01E02 hona chahiye.' }, 400);
      }
      return json({ ok: true, ...parsed, stats: vodStats(parsed) });
    }

    if (action === 'save' || action === 'append') {
      let base = { movies: [], series: [] };
      if (action === 'append') base = await readVod();
      const incoming = cleanVod({ movies: b.movies || [], series: b.series || [] });
      const movies = mergeById(base.movies, incoming.movies);
      const series = mergeSeries(base.series, incoming.series);
      const vod = cleanVod({ movies, series, updatedAt: Date.now() });
      if (!vod.movies.length && !vod.series.length) return json({ ok: false, error: 'List khali hai.' }, 400);
      await saveVod(vod);
      revalidateTag('iptv');
      return json({ ok: true, stats: vodStats(vod) });
    }

    if (action === 'toggle') {
      const kind = b.kind === 'series' ? 'series' : 'movies';
      const vod = await readVod();
      const list = vod[kind].map((x) => (String(x.id) === String(b.id) ? { ...x, off: !x.off } : x));
      await saveVod(cleanVod({ ...vod, [kind]: list, updatedAt: Date.now() }));
      revalidateTag('iptv');
      return json({ ok: true, stats: vodStats({ ...vod, [kind]: list }) });
    }

    if (action === 'remove') {
      const kind = b.kind === 'series' ? 'series' : 'movies';
      const vod = await readVod();
      const list = vod[kind].filter((x) => String(x.id) !== String(b.id));
      await saveVod(cleanVod({ ...vod, [kind]: list, updatedAt: Date.now() }));
      revalidateTag('iptv');
      return json({ ok: true, stats: vodStats({ ...vod, [kind]: list }) });
    }

    if (action === 'addMovie') {
      const vod = await readVod();
      const movie = cleanMovie({ ...b.movie, id: nextId(vod.movies, 'm') }, vod.movies.length);
      if (!movie.name || !movie.url) return json({ ok: false, error: 'Naam aur link zaroori hai.' }, 400);
      const movies = mergeById(vod.movies, [movie]);
      await saveVod(cleanVod({ ...vod, movies, updatedAt: Date.now() }));
      revalidateTag('iptv');
      return json({ ok: true, movie, stats: vodStats({ ...vod, movies }) });
    }

    if (action === 'addSeries') {
      const vod = await readVod();
      const s = cleanSeries({ ...b.series, id: nextId(vod.series, 's') }, vod.series.length);
      if (!s.name) return json({ ok: false, error: 'Series ka naam zaroori hai.' }, 400);
      const series = mergeSeries(vod.series, [s]);
      await saveVod(cleanVod({ ...vod, series, updatedAt: Date.now() }));
      revalidateTag('iptv');
      return json({ ok: true, series: s, stats: vodStats({ ...vod, series }) });
    }

    if (action === 'clear') {
      await saveVod(cleanVod({ updatedAt: Date.now() }));
      revalidateTag('iptv');
      return json({ ok: true });
    }

    if (action === 'find') {
      const vod = await readVod();
      return json({ ok: true, item: findVod(vod, b.kind === 'series' ? 'series' : 'movie', String(b.id || '')) });
    }

    return json({ ok: false, error: 'Unknown action' }, 400);
  } catch (e) {
    console.error('iptv vod api:', e.message);
    return json({ ok: false, error: e.message || 'Server error' }, 500);
  }
}

function nextId(list = [], prefix) {
  let max = 0;
  for (const x of list) {
    const n = Number(String(x.id || '').replace(/\D/g, ''));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${max + 1}`;
}

// Movie ki pehchan URL hai (naam badal sakta hai, link nahi). Purana id barqarar rehta hai
// taake customer ke playlist mein movie wohi rahe.
function mergeById(oldList = [], newList = []) {
  const byUrl = new Map(oldList.map((x) => [x.url, x]));
  const out = [...oldList];
  for (const x of newList) {
    const prev = byUrl.get(x.url);
    if (prev) {
      const merged = { ...prev, ...x, id: prev.id, off: prev.off };
      byUrl.set(x.url, merged);
      const i = out.findIndex((m) => m.id === prev.id);
      if (i >= 0) out[i] = merged;
      continue;
    }
    let id = nextId(out, 'm');
    if (x.id && !out.some((m) => String(m.id) === String(x.id))) id = String(x.id);
    const added = { ...x, id };
    out.push(added);
    byUrl.set(added.url, added);
  }
  return out.sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

// Series ki pehchan naam hai — season/episode dobara import hone par jama hote hain.
function mergeSeries(oldList = [], newList = []) {
  const key = (x) => String(x.name || '').trim().toLowerCase();
  const out = [...oldList];
  for (const s of newList) {
    const i = out.findIndex((x) => key(x) === key(s));
    if (i < 0) {
      const id = s.id && !out.some((x) => String(x.id) === String(s.id)) ? String(s.id) : nextId(out, 's');
      out.push({ ...s, id });
      continue;
    }
    const prev = out[i];
    const seasons = new Map((prev.seasons || []).map((x) => [Number(x.n), x]));
    for (const season of s.seasons || []) {
      const had = seasons.get(Number(season.n));
      if (!had) { seasons.set(Number(season.n), season); continue; }
      const eps = new Map((had.episodes || []).map((e) => [Number(e.n), e]));
      for (const e of season.episodes || []) eps.set(Number(e.n), e);
      seasons.set(Number(season.n), { ...had, episodes: [...eps.values()].sort((a, b) => Number(a.n) - Number(b.n)) });
    }
    out[i] = {
      ...prev, ...s, id: prev.id, off: prev.off,
      seasons: [...seasons.values()].sort((a, b) => Number(a.n) - Number(b.n)),
    };
  }
  return out.sort((a, b) => String(a.name).localeCompare(String(b.name)));
}
