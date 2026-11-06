// Mizanora v50 — Pure Movies, Series, Cast, Release Calendar & Legal Stream Guard.
// Zero React or server-only imports so both browser UI, server pages, and Node tests share one truth.

import { MOVIE_GENRES, MOVIE_REGIONS, STARTER_ACTORS, STARTER_MOVIES } from './moviesCatalog.js';

export { MOVIE_GENRES, MOVIE_REGIONS, STARTER_ACTORS, STARTER_MOVIES };

export const MOVIES_DOC = { collection: 'siteMeta', id: 'movies' };
export const MOVIES_SECRET_DOC = { collection: 'adminSecrets', id: 'movies' };
export const MOVIES_PART = { sub: 'parts', moviePrefix: 'p', actorPrefix: 'a', perPart: 200, maxBytes: 650000 };
export const MAX_CUSTOM_MOVIES = 25000;
export const MAX_CUSTOM_ACTORS = 25000;

export const MOVIES_DEFAULT = {
  enabled: true,
  title: 'Mizanora Movies & Series Hub',
  note: 'Every movie and series from IMDb — real posters, ratings, cast, story guides, episode lists and the release calendar.',
  ads: { enabled: true, slugs: [] },
  autoSync: {
    enabled: true,
    includeUpcoming: true,
    includeLatest: true,
    includeClassics: true,
    includeRegional: true,
    includePublicDomain: true,
  },
  lastAutoSyncAt: 0,
  customMovies: [],
  customActors: [],
};

// Known unauthorized / pirate embed & file-locker domains are strictly blocked at every boundary.
const FORBIDDEN_HOST_RE = /(^|\.)(slast430did|indstream|movierulz|allmovieland|fluxplays|ysb321|vidsrc|2embed|autoembed|multiembed|superembed|smashystream|fmovies|123movies|soap2day|gomovies|putlocker|filmyzilla|vegamovies|hdhub4u|bolly4u|mp4moviez|doodstream|streamtape|mixdrop|filemoon|vidplay|embedsu|upstream|vidcloud)\b/i;

// IMDb-ID scraper embed URL patterns (e.g. /play/tt1234567 or /embed/movie/tt1234567) are blocked too.
const FORBIDDEN_PATH_RE = /\/(play|embed|e|v|watch-free|player)\/(movie\/|tv\/)?tt\d{6,10}\b/i;

export const slugifyMovie = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);

export const isValidImdbId = (v) => /^tt\d{6,10}$/i.test(String(v || '').trim());
export const isValidPersonImdbId = (v) => /^nm\d{6,10}$/i.test(String(v || '').trim());
export const isSafeYoutubeId = (v) => /^[A-Za-z0-9_-]{11}$/.test(String(v || '').trim());

// Extract unique IMDb title IDs (tt...) from any pasted list, CSV export, URLs or raw text.
export function extractImdbIds(rawText, max = 500) {
  const matches = String(rawText || '').match(/\btt\d{6,10}\b/gi) || [];
  const seen = new Set();
  const out = [];
  for (const m of matches) {
    const id = m.toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= max) break;
  }
  return out;
}

export function youtubeEmbedUrl(id) {
  const clean = String(id || '').trim();
  if (!isSafeYoutubeId(clean)) return '';
  return `https://www.youtube-nocookie.com/embed/${clean}?rel=0&modestbranding=1&playsinline=1`;
}

export function youtubeThumbUrl(id) {
  const clean = String(id || '').trim();
  if (!isSafeYoutubeId(clean)) return '';
  return `https://i.ytimg.com/vi/${clean}/hqdefault.jpg`;
}

function isIpOrPrivateHost(hostname) {
  const h = String(hostname || '').toLowerCase().trim();
  if (!h || h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (h.includes(':')) return true; // IPv6 literal
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return true; // Raw IPv4 literal (blocks bulletproof IP stream hosts too)
  return false;
}

export function isForbiddenStreamUrl(rawUrl) {
  const text = String(rawUrl || '').trim();
  if (!text) return true;
  try {
    const u = new URL(text);
    if (u.protocol !== 'https:') return true;
    if (u.username || u.password) return true;
    if (isIpOrPrivateHost(u.hostname)) return true;
    if (FORBIDDEN_HOST_RE.test(u.hostname)) return true;
    if (FORBIDDEN_PATH_RE.test(u.pathname)) return true;
    return false;
  } catch {
    return true;
  }
}

// Only direct https media files (.mp4, .webm, .m3u8, .mpd, .ogv, .mov) with a declared legal license are accepted.
const DIRECT_MEDIA_EXT_RE = /\.(mp4|webm|m3u8|mpd|ogv|mov)(\?.*)?$/i;
const ALLOWED_LICENSES = new Set(['public-domain', 'creative-commons', 'owned-licensed']);

export function cleanLegalStream(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const url = String(raw.url || '').trim().slice(0, 500);
  if (!url || isForbiddenStreamUrl(url) || !DIRECT_MEDIA_EXT_RE.test(url)) return null;
  const license = String(raw.license || '').trim().slice(0, 180);
  const licenseType = ALLOWED_LICENSES.has(raw.licenseType)
    ? raw.licenseType
    : /creative commons|cc by/i.test(license)
      ? 'creative-commons'
      : /public domain/i.test(license)
        ? 'public-domain'
        : raw.rightsConfirmed === true
          ? 'owned-licensed'
          : '';
  if (!licenseType || !license) return null;
  const sourceUrlRaw = String(raw.sourceUrl || '').trim().slice(0, 300);
  let sourceUrl = '';
  if (sourceUrlRaw) {
    try {
      const su = new URL(sourceUrlRaw);
      if (su.protocol === 'https:' && !FORBIDDEN_HOST_RE.test(su.hostname) && !isIpOrPrivateHost(su.hostname)) {
        sourceUrl = su.toString();
      }
    } catch { /* ignore invalid source link */ }
  }
  return {
    url,
    license,
    licenseType,
    sourceName: String(raw.sourceName || 'Legal Archive / Licensed Stream').trim().slice(0, 80),
    sourceUrl,
    isHls: /\.m3u8(\?|$)/i.test(url),
  };
}

export function cleanProviderLink(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name || '').trim().slice(0, 70);
  const url = String(raw.url || '').trim().slice(0, 350);
  if (!name || !url) return null;
  let safeUrl = '';
  if (url.startsWith('/movies')) {
    safeUrl = url;
  } else {
    if (isForbiddenStreamUrl(url)) return null;
    try {
      safeUrl = new URL(url).toString();
    } catch {
      return null;
    }
  }
  return {
    name,
    kind: String(raw.kind || 'Official').trim().slice(0, 40),
    url: safeUrl,
    region: String(raw.region || 'Global').trim().slice(0, 30),
  };
}

function safeHttpsImage(raw) {
  const v = String(raw || '').trim().slice(0, 400);
  if (!v) return '';
  if (/^\/(img|icons)\/[A-Za-z0-9._/-]+$/.test(v) && !v.includes('..')) return v;
  try {
    const u = new URL(v);
    if (u.protocol === 'https:' && !isIpOrPrivateHost(u.hostname) && !FORBIDDEN_HOST_RE.test(u.hostname)) return u.toString();
  } catch { /* ignore */ }
  return '';
}

export function cleanSeason(raw, idx = 0) {
  if (!raw || typeof raw !== 'object') return null;
  const season = Math.max(1, Math.min(99, Number(raw.season) || idx + 1));
  const episodes = (Array.isArray(raw.episodes) ? raw.episodes : [])
    .slice(0, 120)
    .map((ep, j) => ({
      e: Math.max(1, Math.min(999, Number(ep && ep.e) || j + 1)),
      title: String((ep && ep.title) || `Episode ${j + 1}`).trim().slice(0, 120),
      runtime: Math.max(0, Math.min(600, Number(ep && ep.runtime) || 0)),
      airDate: /^\d{4}-\d{2}-\d{2}$/.test(String((ep && ep.airDate) || '')) ? String(ep.airDate) : '',
      summary: String((ep && ep.summary) || '').trim().slice(0, 360),
    }));
  return {
    season,
    title: String(raw.title || `Season ${season}`).trim().slice(0, 90),
    year: Math.max(1900, Math.min(2100, Number(raw.year) || 2026)),
    episodes,
  };
}

export function cleanMovie(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = String(raw.title || '').trim().slice(0, 140);
  if (!title) return null;
  const imdbRaw = String(raw.imdbId || '').trim().toLowerCase();
  const imdbId = isValidImdbId(imdbRaw) ? imdbRaw : '';
  const slug = slugifyMovie(raw.slug || `${title}-${raw.year || ''}`) || (imdbId ? imdbId : '');
  if (!slug) return null;
  const type = raw.type === 'series' ? 'series' : 'movie';
  const releaseDate = /^\d{4}-\d{2}-\d{2}$/.test(String(raw.releaseDate || '')) ? String(raw.releaseDate) : '';
  const yearFromDate = releaseDate ? Number(releaseDate.slice(0, 4)) : 0;
  const year = Math.max(1895, Math.min(2035, Number(raw.year) || yearFromDate || 2026));
  const status = raw.status === 'upcoming' ? 'upcoming' : 'released';
  const validRegions = new Set(MOVIE_REGIONS.map((r) => r.id).filter((id) => id !== 'all'));
  const region = validRegions.has(raw.region) ? raw.region : 'International';
  const genres = (Array.isArray(raw.genres) ? raw.genres : String(raw.genres || '').split(','))
    .map((g) => String(g || '').trim().slice(0, 30))
    .filter(Boolean)
    .slice(0, 6);
  const cast = (Array.isArray(raw.cast) ? raw.cast : [])
    .map((c) => {
      if (!c) return null;
      const name = String(typeof c === 'string' ? c : c.name || '').trim().slice(0, 80);
      if (!name) return null;
      return {
        slug: slugifyMovie((typeof c === 'object' && c.slug) || name),
        name,
        character: String((typeof c === 'object' && c.character) || '').trim().slice(0, 80),
        // v51: cast portraits so the movie page shows real faces (TMDB / TVmaze supply them).
        photo: safeHttpsImage((typeof c === 'object' && c.photo) || ''),
      };
    })
    .filter(Boolean)
    .slice(0, 24);
  const trailerYoutubeId = isSafeYoutubeId(raw.trailerYoutubeId) ? String(raw.trailerYoutubeId).trim() : '';
  const publicDomainStream = cleanLegalStream(raw.publicDomainStream);
  const legalProviders = (Array.isArray(raw.legalProviders) ? raw.legalProviders : [])
    .map(cleanProviderLink)
    .filter(Boolean)
    .slice(0, 8);
  const seasons = type === 'series'
    ? (Array.isArray(raw.seasons) ? raw.seasons : []).map(cleanSeason).filter(Boolean).slice(0, 30)
    : [];

  return {
    slug,
    imdbId,
    title,
    originalTitle: String(raw.originalTitle || '').trim().slice(0, 140),
    type,
    year,
    releaseDate,
    status,
    region,
    country: String(raw.country || region).trim().slice(0, 70),
    language: String(raw.language || 'Urdu, English').trim().slice(0, 80),
    genres: genres.length ? genres : ['Drama'],
    rating: status === 'upcoming' && !Number(raw.rating) ? 0 : Math.max(0, Math.min(10, Math.round((Number(raw.rating) || 0) * 10) / 10)),
    runtime: Math.max(0, Math.min(900, Number(raw.runtime) || 0)),
    ageRating: String(raw.ageRating || 'PG-13').trim().slice(0, 12),
    tagline: String(raw.tagline || '').trim().slice(0, 200),
    story: String(raw.story || '').trim().slice(0, 1500),
    director: String(raw.director || '').trim().slice(0, 100),
    poster: safeHttpsImage(raw.poster),
    backdrop: safeHttpsImage(raw.backdrop),
    cast,
    trailerYoutubeId,
    publicDomainStream,
    legalProviders,
    seasons,
    keywords: String(raw.keywords || '').trim().slice(0, 300),
    off: Boolean(raw.off),
  };
}

export function cleanActor(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name || '').trim().slice(0, 90);
  if (!name) return null;
  const slug = slugifyMovie(raw.slug || name);
  if (!slug) return null;
  const imdbRaw = String(raw.imdbId || '').trim().toLowerCase();
  const validRegions = new Set(MOVIE_REGIONS.map((r) => r.id).filter((id) => id !== 'all'));
  return {
    slug,
    imdbId: isValidPersonImdbId(imdbRaw) ? imdbRaw : '',
    name,
    country: String(raw.country || 'Pakistan').trim().slice(0, 60),
    region: validRegions.has(raw.region) ? raw.region : 'International',
    role: String(raw.role || 'Actor').trim().slice(0, 60),
    bornYear: Math.max(0, Math.min(2025, Number(raw.bornYear) || 0)),
    birthPlace: String(raw.birthPlace || '').trim().slice(0, 90),
    bio: String(raw.bio || '').trim().slice(0, 1200),
    photo: safeHttpsImage(raw.photo),
    knownFor: (Array.isArray(raw.knownFor) ? raw.knownFor : String(raw.knownFor || '').split(','))
      .map((x) => String(x || '').trim().slice(0, 90))
      .filter(Boolean)
      .slice(0, 8),
    awards: String(raw.awards || '').trim().slice(0, 160),
    keywords: String(raw.keywords || '').trim().slice(0, 220),
  };
}

export function cleanMoviesConfig(raw = {}) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const customMovies = (Array.isArray(d.customMovies) ? d.customMovies : [])
    .slice(0, MAX_CUSTOM_MOVIES)
    .map(cleanMovie)
    .filter(Boolean);
  const customActors = (Array.isArray(d.customActors) ? d.customActors : [])
    .slice(0, MAX_CUSTOM_ACTORS)
    .map(cleanActor)
    .filter(Boolean);
  const adSlugs = (d.ads && Array.isArray(d.ads.slugs) ? d.ads.slugs : [])
    .map((s) => slugifyMovie(s))
    .filter(Boolean)
    .slice(0, 30);
  const rawAuto = d.autoSync && typeof d.autoSync === 'object' ? d.autoSync : {};
  return {
    enabled: d.enabled !== false,
    title: String(d.title || MOVIES_DEFAULT.title).trim().slice(0, 110) || MOVIES_DEFAULT.title,
    note: String(d.note || MOVIES_DEFAULT.note).trim().slice(0, 260) || MOVIES_DEFAULT.note,
    ads: {
      enabled: !(d.ads && d.ads.enabled === false),
      slugs: adSlugs,
    },
    autoSync: {
      enabled: rawAuto.enabled !== false,
      includeUpcoming: rawAuto.includeUpcoming !== false,
      includeLatest: rawAuto.includeLatest !== false,
      includeClassics: rawAuto.includeClassics !== false,
      includeRegional: rawAuto.includeRegional !== false,
      includePublicDomain: rawAuto.includePublicDomain !== false,
    },
    lastAutoSyncAt: Number(d.lastAutoSyncAt) || 0,
    customMovies,
    customActors,
  };
}

export function movieDateKey(m) {
  if (!m) return '0000-00-00';
  if (m.releaseDate && /^\d{4}-\d{2}-\d{2}$/.test(m.releaseDate)) return m.releaseDate;
  const y = String(m.year || 1900).padStart(4, '0');
  return m.status === 'upcoming' ? `${y}-12-31` : `${y}-06-15`;
}

// Orders upcoming ("ane wali") + latest -> oldest ("nayi se porani").
export function sortMoviesNewestToOldest(list = []) {
  return [...list].sort((a, b) => {
    if ((b.year || 0) !== (a.year || 0)) return (b.year || 0) - (a.year || 0);
    const dk = movieDateKey(b).localeCompare(movieDateKey(a));
    if (dk !== 0) return dk;
    return (b.rating || 0) - (a.rating || 0);
  });
}

// Merge starter titles + automatic live-feed titles + custom/synced titles (custom entries override matching slug or imdbId).
export function mergeMoviesCatalog(cfg = MOVIES_DEFAULT, autoMovies = [], autoActors = []) {
  const cleanCfg = cleanMoviesConfig(cfg);
  const bySlug = new Map();
  const byImdb = new Map();

  for (const item of STARTER_MOVIES) {
    const m = cleanMovie(item);
    if (!m) continue;
    bySlug.set(m.slug, m);
    if (m.imdbId) byImdb.set(m.imdbId, m.slug);
  }
  for (const rawItem of Array.isArray(autoMovies) ? autoMovies : []) {
    const m = cleanMovie(rawItem);
    if (!m) continue;
    if (m.imdbId && byImdb.has(m.imdbId)) continue;
    if (bySlug.has(m.slug)) continue;
    bySlug.set(m.slug, m);
    if (m.imdbId) byImdb.set(m.imdbId, m.slug);
  }
  for (const m of cleanCfg.customMovies) {
    if (m.imdbId && byImdb.has(m.imdbId) && byImdb.get(m.imdbId) !== m.slug) {
      bySlug.delete(byImdb.get(m.imdbId));
    }
    bySlug.set(m.slug, m);
    if (m.imdbId) byImdb.set(m.imdbId, m.slug);
  }

  const movies = sortMoviesNewestToOldest([...bySlug.values()].filter((m) => !m.off));

  // Merge actors and auto-backfill any cast member referenced on a movie so /movies/actor/<slug> never 404s.
  const actorMap = new Map();
  for (const a of STARTER_ACTORS) {
    const ca = cleanActor(a);
    if (ca) actorMap.set(ca.slug, ca);
  }
  for (const rawActor of Array.isArray(autoActors) ? autoActors : []) {
    const ca = cleanActor(rawActor);
    if (ca && !actorMap.has(ca.slug)) actorMap.set(ca.slug, ca);
  }
  for (const a of cleanCfg.customActors) {
    actorMap.set(a.slug, a);
  }
  for (const m of movies) {
    for (const c of m.cast || []) {
      if (c.slug && !actorMap.has(c.slug)) {
        actorMap.set(c.slug, {
          slug: c.slug,
          imdbId: '',
          name: c.name,
          country: m.country || m.region,
          region: m.region,
          role: 'Cast Member',
          bornYear: 0,
          birthPlace: m.country || '',
          bio: `${c.name} appears as ${c.character || 'a featured character'} in ${m.title} (${m.year}).`,
          photo: c.photo || '',
          knownFor: [m.title],
          awards: '',
          keywords: `${c.name} ${m.title}`.toLowerCase(),
        });
      }
    }
  }

  return {
    config: cleanCfg,
    movies,
    actors: [...actorMap.values()],
  };
}

// v51: a last-resort, honest placeholder for a valid IMDb ID whose metadata could not be fetched
// (offline build, rate limit, brief network blip). The page still renders - and, most importantly,
// the admin's play servers still build a working link from the IMDb ID - instead of showing a 404.
export function stubMovieFromImdbId(rawImdbId) {
  const imdbId = String(rawImdbId || '').trim().toLowerCase();
  if (!isValidImdbId(imdbId)) return null;
  const base = cleanMovie({
    slug: imdbId,
    imdbId,
    title: `IMDb ${imdbId}`,
    type: 'movie',
    year: new Date().getFullYear(),
    status: 'released',
    region: 'International',
    country: 'International',
    language: 'Original',
    genres: ['Drama'],
    rating: 0,
    story:
      'Is title ki official tafseel (cast, story, poster) abhi load nahi ho saki. Player aur official IMDb link phir bhi kaam karte hain — thori dair baad page refresh karein to poori maloomat aa jayegi.',
    legalProviders: [
      { name: 'IMDb Official Page', kind: 'Official Info', url: `https://www.imdb.com/title/${imdbId}/`, region: 'Global' },
    ],
    keywords: `${imdbId} imdb movie details pending`,
  });
  return base ? { ...base, stub: true } : null;
}

export function findMovie(slugOrImdb, movies = []) {
  const key = String(slugOrImdb || '').trim().toLowerCase();
  if (!key) return null;
  return movies.find((m) => m.slug === key || (m.imdbId && m.imdbId.toLowerCase() === key)) || null;
}

export function findActor(slugOrImdb, actors = []) {
  const key = String(slugOrImdb || '').trim().toLowerCase();
  if (!key) return null;
  return actors.find((a) => a.slug === key || (a.imdbId && a.imdbId.toLowerCase() === key)) || null;
}

export function actorFilmography(actor, movies = []) {
  if (!actor) return [];
  const slug = String(actor.slug || '').toLowerCase();
  const name = String(actor.name || '').toLowerCase();
  return movies
    .filter((m) => (m.cast || []).some((c) => c.slug === slug || c.name.toLowerCase() === name))
    .sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.year || 0) - (a.year || 0));
}

const tokenize = (q) =>
  String(q || '')
    .toLowerCase()
    .split(/[^a-z0-9\u0600-\u06ff\u0980-\u09ff]+/)
    .filter((w) => w.length >= 2)
    .slice(0, 10);

export function searchMovies(
  q,
  movies = [],
  { type = 'all', region = 'all', genre = 'all', freeOnly = false, upcomingOnly = false, sort = 'latest', limit = 1000 } = {},
) {
  const rawQ = String(q || '').trim().toLowerCase();
  const words = tokenize(rawQ);

  let list = movies.filter((m) => !m.off);
  if (type === 'movie' || type === 'series') list = list.filter((m) => m.type === type);
  if (freeOnly) list = list.filter((m) => Boolean(m.publicDomainStream));
  if (upcomingOnly) list = list.filter((m) => m.status === 'upcoming');
  if (region && region !== 'all') list = list.filter((m) => m.region === region);
  if (genre && genre !== 'all') list = list.filter((m) => (m.genres || []).some((g) => g.toLowerCase() === genre.toLowerCase()));

  if (words.length > 0) {
    const scored = [];
    for (const m of list) {
      if (m.imdbId && m.imdbId.toLowerCase() === rawQ) {
        scored.push({ m, s: 1000 });
        continue;
      }
      const titleLow = `${m.title} ${m.originalTitle || ''}`.toLowerCase();
      const castLow = (m.cast || []).map((c) => `${c.name} ${c.character || ''}`).join(' ').toLowerCase();
      const hay = `${titleLow} ${m.imdbId || ''} ${castLow} ${m.director || ''} ${(m.genres || []).join(' ')} ${m.region} ${m.country} ${m.language} ${m.keywords || ''} ${m.story || ''} ${m.publicDomainStream ? 'free full movie public domain classic legal' : ''} ${m.type === 'series' ? 'series drama serial episodes web series' : 'movie film cinema'}`.toLowerCase();
      let s = 0;
      let matchedAll = true;
      for (const w of words) {
        if (m.imdbId && m.imdbId.toLowerCase() === w) s += 50;
        else if (titleLow.includes(w)) s += 8;
        else if (castLow.includes(w)) s += 5;
        else if (hay.includes(w)) s += 2;
        else {
          matchedAll = false;
          break;
        }
      }
      if (matchedAll && s > 0) scored.push({ m, s: s + (m.rating || 0) * 0.2 });
    }
    return scored.sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.m);
  }

  const sorted = [...list];
  if (sort === 'rating') sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0) || b.year - a.year);
  else if (sort === 'latest' || sort === 'newest') return sortMoviesNewestToOldest(sorted).slice(0, limit);
  else if (sort === 'upcoming') {
    sorted.sort((a, b) => {
      const aUp = a.status === 'upcoming' ? 1 : 0;
      const bUp = b.status === 'upcoming' ? 1 : 0;
      if (bUp !== aUp) return bUp - aUp;
      if (aUp && bUp) return movieDateKey(a).localeCompare(movieDateKey(b));
      return movieDateKey(b).localeCompare(movieDateKey(a));
    });
  } else if (sort === 'oldest') sorted.sort((a, b) => a.year - b.year || movieDateKey(a).localeCompare(movieDateKey(b)));
  else if (sort === 'az') sorted.sort((a, b) => a.title.localeCompare(b.title));
  else {
    // 'trending': balance Pakistani + regional spotlight, playable free films, rating and recency
    const weight = (m) =>
      (m.region === 'Pakistan' ? 2.2 : 0) +
      (m.publicDomainStream ? 1.5 : 0) +
      (m.rating || 7.2) +
      Math.max(0, (m.year - 2000) * 0.06);
    sorted.sort((a, b) => weight(b) - weight(a));
  }
  return sorted.slice(0, limit);
}

export function searchActors(q, actors = [], { region = 'all', limit = 100 } = {}) {
  const words = tokenize(q);
  let list = [...actors];
  if (region && region !== 'all') list = list.filter((a) => a.region === region);
  if (!words.length) return list.slice(0, limit);
  const out = [];
  for (const a of list) {
    const nameLow = a.name.toLowerCase();
    const hay = `${nameLow} ${a.imdbId || ''} ${a.country} ${a.region} ${a.role} ${(a.knownFor || []).join(' ')} ${a.keywords || ''} ${a.bio || ''}`.toLowerCase();
    let s = 0;
    let ok = true;
    for (const w of words) {
      if (a.imdbId && a.imdbId.toLowerCase() === w) s += 40;
      else if (nameLow.includes(w)) s += 8;
      else if (hay.includes(w)) s += 2;
      else { ok = false; break; }
    }
    if (ok && s > 0) out.push({ a, s });
  }
  return out.sort((x, y) => y.s - x.s).slice(0, limit).map((x) => x.a);
}

export function relatedMovies(movie, movies = [], count = 6) {
  if (!movie) return [];
  const castSet = new Set((movie.cast || []).map((c) => c.slug));
  const genreSet = new Set((movie.genres || []).map((g) => g.toLowerCase()));
  return movies
    .filter((m) => m.slug !== movie.slug && !m.off)
    .map((m) => {
      let score = 0;
      if (m.region === movie.region) score += 4;
      if (m.type === movie.type) score += 2;
      if (Boolean(m.publicDomainStream) && Boolean(movie.publicDomainStream)) score += 3;
      for (const c of m.cast || []) if (castSet.has(c.slug)) score += 5;
      for (const g of m.genres || []) if (genreSet.has(g.toLowerCase())) score += 2;
      score += (m.rating || 0) * 0.15;
      return { m, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((x) => x.m);
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function daysUntilRelease(releaseDate, refDate = '2026-11-05') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(releaseDate || ''))) return null;
  const target = Date.parse(`${releaseDate}T00:00:00Z`);
  const ref = typeof refDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(refDate)
    ? Date.parse(`${refDate}T00:00:00Z`)
    : new Date(refDate).setUTCHours(0, 0, 0, 0);
  if (!Number.isFinite(target) || !Number.isFinite(ref)) return null;
  return Math.round((target - ref) / 86400000);
}

export function buildReleaseCalendar(movies = [], { region = 'all', type = 'all', includeRecent = true, refDate = '2026-11-05' } = {}) {
  let list = movies.filter((m) => !m.off && m.releaseDate);
  if (region && region !== 'all') list = list.filter((m) => m.region === region);
  if (type === 'movie' || type === 'series') list = list.filter((m) => m.type === type);

  const items = list
    .map((m) => ({ ...m, daysAway: daysUntilRelease(m.releaseDate, refDate) }))
    .filter((m) => (m.status === 'upcoming' || (includeRecent && m.year >= 2024)))
    .sort((a, b) => {
      // Upcoming chronological first, then recent releases reverse-chronological
      const aUp = a.status === 'upcoming' || (a.daysAway != null && a.daysAway >= 0);
      const bUp = b.status === 'upcoming' || (b.daysAway != null && b.daysAway >= 0);
      if (aUp && !bUp) return -1;
      if (!aUp && bUp) return 1;
      if (aUp && bUp) return a.releaseDate.localeCompare(b.releaseDate);
      return b.releaseDate.localeCompare(a.releaseDate);
    });

  const groups = new Map();
  for (const item of items) {
    const ym = item.releaseDate.slice(0, 7);
    const [y, mo] = ym.split('-').map(Number);
    const label = `${MONTH_NAMES[(mo || 1) - 1] || 'Month'} ${y}`;
    if (!groups.has(ym)) groups.set(ym, { ym, label, upcoming: item.status === 'upcoming' || (item.daysAway != null && item.daysAway >= 0), items: [] });
    groups.get(ym).items.push(item);
  }
  return [...groups.values()];
}

export function posterHue(seed = '') {
  let h = 21;
  const s = String(seed || 'mizanora');
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

export function titleInitials(title = '') {
  const clean = String(title || '')
    .replace(/^(the|a|an)\s+/i, '')
    .trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (!parts.length) return 'MZ';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
