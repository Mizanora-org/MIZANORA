import { bestMeta, mergeMeta, searchQuery, yearOf } from '../iptvMeta';

// IMDb metadata via Cinemeta (Stremio ka khula catalog — koi API key nahi).
//   search: https://v3-cinemeta.strem.io/catalog/{movie|series}/top/search=<title>.json
//   detail: https://v3-cinemeta.strem.io/meta/{movie|series}/<ttID>.json
// Poster/backdrop metahub se: https://images.metahub.space/poster/medium/<ttID>/img
// Har item par 1 search + (match mile to) 1 detail call — is liye cache aur limit zaroori hain.

const UA = 'MizanoraIPTV/1.0 (+https://mizanora.vercel.app)';
const TTL = 6 * 3600_000;              // 6 ghante memory cache
const cache = new Map();

async function getJson(url, ms = 5000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA, Accept: 'application/json' }, cache: 'no-store' });
    if (!res.ok) { try { res.body && res.body.cancel(); } catch { /* ignore */ } return null; }
    const type = res.headers.get('content-type') || '';
    if (!/json/i.test(type)) return null;
    return await res.json().catch(() => null);
  } catch { return null; } finally { clearTimeout(timer); }
}

const memo = (key, value) => {
  if (cache.size > 4000) cache.clear();
  cache.set(key, { at: Date.now(), value });
  return value;
};
const fresh = (hit) => hit && Date.now() - hit.at < TTL;

/** Title se IMDb candidates. */
export async function searchImdb(kind, title) {
  const t = String(title || '').trim().slice(0, 80);
  if (!t) return [];
  const key = `s:${kind}:${t.toLowerCase()}`;
  const hit = cache.get(key);
  if (fresh(hit)) return hit.value;
  const url = `https://v3-cinemeta.strem.io/catalog/${kind === 'series' ? 'series' : 'movie'}/top/search=${encodeURIComponent(t)}.json`;
  const data = await getJson(url);
  const metas = Array.isArray(data && data.metas) ? data.metas.slice(0, 12) : [];
  return memo(key, metas);
}

/** IMDb id se poora meta (cast, runtime, videos). */
export async function imdbDetail(kind, imdbId) {
  if (!/^tt\d{6,9}$/.test(String(imdbId || ''))) return null;
  const key = `d:${imdbId}`;
  const hit = cache.get(key);
  if (fresh(hit)) return hit.value;
  const url = `https://v3-cinemeta.strem.io/meta/${kind === 'series' ? 'series' : 'movie'}/${imdbId}.json`;
  const data = await getJson(url);
  return memo(key, (data && data.meta) || null);
}

/** Aik item par IMDb lagao; match na mile to item waise hi wapas. */
export async function enrichItem(item, kind = 'movie') {
  const { title, year } = searchQuery(item);
  if (!title) return { ok: false, item, reason: 'naam khali' };
  const metas = await searchImdb(kind, title);
  const pick = bestMeta(metas, title, year || yearOf(item.name));
  if (!pick) return { ok: false, item, reason: 'IMDb par match nahi mila' };
  const id = String(pick.meta.imdb_id || pick.meta.id || '');
  const detail = /^tt\d+/.test(id) ? await imdbDetail(kind, id) : null;
  const merged = mergeMeta(item, { ...pick.meta, ...(detail || {}) }, kind);
  return { ok: true, item: merged, score: pick.score, imdbId: merged.imdbId || '' };
}

/**
 * List par batch enrichment. `onlyMissing` sirf unhe chhoota hai jinke paas poster/plot nahi.
 * Concurrency 3 — Cinemeta par bojh na pare aur Vercel ka 60s na nikle.
 */
export async function enrichList(list = [], kind = 'movie', opts = {}) {
  const limit = Math.min(60, Math.max(1, Number(opts.limit) || 20));
  const onlyMissing = opts.onlyMissing !== false;
  const rows = Array.isArray(list) ? list : [];
  const todo = rows.filter((x) => !onlyMissing || !x.imdbId || !x.poster || !x.plot).slice(0, limit);

  const out = rows.slice();
  let filled = 0;
  const misses = [];

  for (let i = 0; i < todo.length; i += 3) {
    const batch = todo.slice(i, i + 3);
    const done = await Promise.all(batch.map((item) => enrichItem(item, kind).catch(() => ({ ok: false, item }))));
    for (const r of done) {
      if (!r.ok) { misses.push(r.item?.name || ''); continue; }
      const at = out.findIndex((x) => String(x.id) === String(r.item.id));
      if (at >= 0) out[at] = r.item;
      filled++;
    }
  }
  return { list: out, filled, misses, scanned: todo.length, left: rows.length - todo.length };
}

export const imdbStatus = () => ({
  cached: cache.size,
  provider: 'Cinemeta (IMDb mirror)',
  endpoint: 'https://v3-cinemeta.strem.io',
});
