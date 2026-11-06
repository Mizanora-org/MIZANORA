import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 25;

// Mizanora v58 — REAL FACES FOR EVERY CAST MEMBER.
//
// The cast lists come from IMDb's dataset, which has names but no photos. Before this route a star
// card showed only initials unless somebody had a hand-written profile. Now every name resolves to a
// real portrait, fetched server-side and served from our own domain:
//
//   1. TMDB person search        (only when an admin TMDB key is configured)
//   2. English Wikipedia         (keyless, works on Pakistani networks, has most notable actors)
//   3. IMDb's public suggestion  (the old v51 path, kept as a third try)
//
//   GET /api/person/Shah%20Rukh%20Khan
//
// Answers are cached at the edge for a month; a miss is remembered for a day so a name without any
// photo does not hammer the upstream APIs on every page view.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const OK_CACHE = 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800';
const MISS_CACHE = 'public, max-age=3600, s-maxage=86400';

const urlCache = new Map(); // name -> { url, at }
const TTL = 12 * 3600 * 1000;

async function jsonGet(url, timeout = 7000) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeout) : null;
  try {
    const res = await fetch(url, {
      ...(ctrl ? { signal: ctrl.signal } : {}),
      headers: { accept: 'application/json', 'user-agent': UA },
    });
    if (!res || !res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fetchBytes(url) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 9000) : null;
  try {
    const res = await fetch(url, {
      ...(ctrl ? { signal: ctrl.signal } : {}),
      headers: { accept: 'image/*', 'user-agent': UA, referer: 'https://en.wikipedia.org/' },
      redirect: 'follow',
    });
    if (!res || !res.ok) return null;
    const type = String(res.headers.get('content-type') || '');
    if (!type.startsWith('image/')) return null;
    const buf = await res.arrayBuffer();
    if (!buf.byteLength || buf.byteLength > 6 * 1024 * 1024) return null;
    return { body: buf, type };
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** TMDB (needs a configured key) — best quality, Western + Indian cinema both covered. */
async function fromTmdb(name) {
  try {
    const { getEffectiveTmdbKey } = await import('@/lib/moviesServer');
    const key = String((await getEffectiveTmdbKey()) || '').trim();
    if (!key) return '';
    const data = await jsonGet(`https://api.themoviedb.org/3/search/person?query=${encodeURIComponent(name)}&api_key=${encodeURIComponent(key)}`, 8000);
    const hit = (data && data.results || []).find((p) => p && p.profile_path);
    return hit ? `https://image.tmdb.org/t/p/w300${hit.profile_path}` : '';
  } catch {
    return '';
  }
}

/** Wikipedia — keyless. Exact-title lookup first, then a one-result search. */
async function fromWikipedia(name) {
  const base = 'https://en.wikipedia.org/w/api.php';
  const params = (extra) => `${base}?format=json&formatversion=2&origin=*&${extra}`;

  const exact = await jsonGet(params(`action=query&prop=pageimages&piprop=thumbnail&pithumbsize=400&redirects=1&titles=${encodeURIComponent(name)}`), 8000);
  const page = exact && exact.query && exact.query.pages && exact.query.pages[0];
  if (page && page.thumbnail && page.thumbnail.source) return page.thumbnail.source;

  const found = await jsonGet(params(`action=query&list=search&srlimit=1&srsearch=${encodeURIComponent(`${name} actor`)}`), 8000);
  const first = found && found.query && found.query.search && found.query.search[0];
  if (!first || !first.title) return '';
  // Only trust the search hit when the title really is the person we asked for.
  const a = first.title.toLowerCase();
  const b = String(name).toLowerCase();
  if (!a.includes(b.split(' ')[0]) || !a.includes(b.split(' ').slice(-1)[0])) return '';
  const img = await jsonGet(params(`action=query&prop=pageimages&piprop=thumbnail&pithumbsize=400&redirects=1&titles=${encodeURIComponent(first.title)}`), 8000);
  const p2 = img && img.query && img.query.pages && img.query.pages[0];
  return (p2 && p2.thumbnail && p2.thumbnail.source) || '';
}

/** IMDb's public suggestion endpoint (kept as the last try). */
async function fromImdb(name) {
  try {
    const { lookupPersonImage } = await import('@/lib/moviesAutoFeed');
    const found = await lookupPersonImage(name);
    return (found && found.photo) || '';
  } catch {
    return '';
  }
}

async function resolvePhoto(name) {
  const hit = urlCache.get(name);
  if (hit && Date.now() - hit.at < TTL) return hit.url;
  let url = '';
  for (const step of [fromTmdb, fromWikipedia, fromImdb]) {
    try {
      url = (await step(name)) || '';
    } catch {
      url = '';
    }
    if (url) break;
  }
  urlCache.set(name, { url, at: Date.now() });
  if (urlCache.size > 4000) {
    [...urlCache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 800).forEach(([k]) => urlCache.delete(k));
  }
  return url;
}

export async function GET(req, { params }) {
  const { name: rawName } = await params;
  const name = decodeURIComponent(String(rawName || '')).replace(/[<>]/g, '').trim().slice(0, 90);
  if (!name || name.length < 2) return new NextResponse('bad name', { status: 400, headers: { 'Cache-Control': MISS_CACHE } });

  const photoUrl = await resolvePhoto(name);
  if (!photoUrl) return new NextResponse('no photo', { status: 404, headers: { 'Cache-Control': MISS_CACHE } });

  const bytes = await fetchBytes(photoUrl);
  if (!bytes) return new NextResponse('photo unavailable', { status: 404, headers: { 'Cache-Control': MISS_CACHE } });

  return new NextResponse(bytes.body, {
    status: 200,
    headers: {
      'Content-Type': bytes.type,
      'Content-Length': String(bytes.body.byteLength || bytes.body.length || 0),
      'Cache-Control': OK_CACHE,
      'X-Photo-Name': encodeURIComponent(name),
    },
  });
}
