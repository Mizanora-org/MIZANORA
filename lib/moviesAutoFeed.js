// Mizanora v50 — Automatic Official Movie & Series Metadata Discovery Engine.
//
// Pulls 100% legal official metadata (Upcoming + Latest Newest-to-Oldest + Classics + Regional):
//   1. TMDB Official v3/v4 API (when TMDB_API_KEY env or Admin-saved key/token is present)
//   2. TVmaze Official Free Public API (zero API key required — real IMDb IDs, posters, dates, summaries)
//   3. IMDb Official Public Suggestion JSON (zero API key required — instant tt... ID & title metadata)
//   4. Internet Archive Official Public-Domain Feature Films API (verified legal classic .mp4 films)
//
// Every item is sanitized through cleanMovie() / cleanActor() in lib/movies.js so unauthorized
// third-party stream hosts can never enter Mizanora.

import {
  cleanActor,
  cleanMovie,
  extractImdbIds,
  isValidImdbId,
  slugifyMovie,
  sortMoviesNewestToOldest,
} from './movies.js';

const TMDB_GENRE_MAP = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Biography',
  18: 'Drama',
  10751: 'Family',
  14: 'Adventure',
  36: 'History',
  27: 'Thriller',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  53: 'Thriller',
  10752: 'History',
  10759: 'Action',
  10765: 'Sci-Fi',
  10768: 'History',
};

export function mapCountryLangToRegion(countries = [], origLang = '') {
  const codes = (countries || []).map((c) => String(c || '').toUpperCase());
  const names = (countries || []).map((c) => String(c || '').toLowerCase());
  const lang = String(origLang || '').toLowerCase();
  if (codes.includes('PK') || names.some((n) => n.includes('pakistan')) || lang === 'ur' || lang === 'pa' || lang === 'urdu' || lang === 'punjabi') {
    return 'Pakistan';
  }
  if (codes.includes('IN') || names.some((n) => n.includes('india')) || ['hi', 'ta', 'te', 'ml', 'kn', 'hindi', 'tamil', 'telugu', 'malayalam'].includes(lang)) {
    return 'India';
  }
  if (codes.includes('BD') || names.some((n) => n.includes('bangladesh')) || lang === 'bn' || lang === 'bengali' || lang === 'bangla') {
    return 'Bangladesh';
  }
  if (
    codes.includes('IR') ||
    codes.includes('AF') ||
    names.some((n) => n.includes('iran') || n.includes('afghan')) ||
    ['fa', 'ps', 'persian', 'farsi', 'dari', 'pashto'].includes(lang)
  ) {
    return 'Iran & Afghanistan';
  }
  if (
    codes.includes('TR') ||
    codes.includes('IQ') ||
    codes.includes('EG') ||
    codes.includes('LB') ||
    codes.includes('SA') ||
    codes.includes('AE') ||
    names.some((n) => n.includes('turkey') || n.includes('iraq') || n.includes('arab') || n.includes('lebanon') || n.includes('egypt')) ||
    ['tr', 'ar', 'ku', 'turkish', 'arabic', 'kurdish'].includes(lang)
  ) {
    return 'Turkey & Arabic';
  }
  return 'International';
}

const stripHtml = (html) =>
  String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();

async function safeJsonFetch(url, { headers = {}, timeoutMs = 5000, fetchFn = globalThis.fetch } = {}) {
  if (typeof fetchFn !== 'function') return null;
  try {
    const res = await fetchFn(url, {
      headers: { Accept: 'application/json', ...headers },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res || !res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function buildTmdbRequest(pathWithQuery, rawKey = '') {
  const key = String(rawKey || '').trim();
  if (!key) return null;
  const isBearer = key.startsWith('eyJ') || key.length > 64;
  const sep = pathWithQuery.includes('?') ? '&' : '?';
  const url = isBearer
    ? `https://api.themoviedb.org/3/${pathWithQuery.replace(/^\//, '')}`
    : `https://api.themoviedb.org/3/${pathWithQuery.replace(/^\//, '')}${sep}api_key=${encodeURIComponent(key)}`;
  const headers = isBearer ? { Authorization: `Bearer ${key}` } : {};
  return { url, headers };
}

export function parseTmdbSummaryItem(item, kindHint = 'movie', todayIso = new Date().toISOString().slice(0, 10)) {
  if (!item || typeof item !== 'object') return null;
  const mediaType = item.media_type === 'tv' || kindHint === 'tv' ? 'series' : 'movie';
  const title = String(item.title || item.name || '').trim();
  if (!title) return null;
  const releaseDate = String(item.release_date || item.first_air_date || '').trim();
  const year = releaseDate ? Number(releaseDate.slice(0, 4)) : new Date().getFullYear();
  const originCountries = Array.isArray(item.origin_country) ? item.origin_country : [];
  const region = mapCountryLangToRegion(originCountries, item.original_language);
  const genres = (Array.isArray(item.genre_ids) ? item.genre_ids : [])
    .map((id) => TMDB_GENRE_MAP[id])
    .filter(Boolean);
  const isUpcoming = Boolean(releaseDate && releaseDate > todayIso);
  const imdbId = isValidImdbId(item.imdb_id) ? String(item.imdb_id).toLowerCase() : '';
  const slugBase = slugifyMovie(`${title}-${year || item.id || ''}`);

  return cleanMovie({
    slug: slugBase || imdbId,
    imdbId,
    title,
    originalTitle: item.original_title || item.original_name || '',
    type: mediaType,
    year,
    releaseDate,
    status: isUpcoming ? 'upcoming' : 'released',
    region,
    country: originCountries.join(', ') || region,
    language: item.original_language ? String(item.original_language).toUpperCase() : 'English',
    genres: genres.length ? genres : ['Drama'],
    rating: isUpcoming ? 0 : Number(item.vote_average) || 0,
    runtime: mediaType === 'series' ? 45 : 125,
    tagline: isUpcoming
      ? `Upcoming ${year} ${region === 'International' ? 'global' : region} ${mediaType === 'series' ? 'series' : 'release'} — official preview & release calendar on Mizanora.`
      : `Official story, cast & where-to-watch guide for ${title} (${year}).`,
    story: String(item.overview || '').trim() || `${title} (${year}) official synopsis, release date and cast guide on Mizanora.`,
    poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '',
    backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : '',
    legalProviders: [
      {
        name: 'Official Trailer on YouTube',
        kind: 'Trailer',
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} ${year} official trailer`)}`,
        region: 'Global',
      },
      ...(imdbId
        ? [{ name: 'IMDb Official', kind: 'Official Info', url: `https://www.imdb.com/title/${imdbId}/`, region: 'Global' }]
        : []),
    ],
    keywords: `${title} ${year} ${region} ${imdbId} ${isUpcoming ? 'upcoming release' : 'latest movie series'}`.toLowerCase(),
  });
}

export function parseTvmazeShow(show, todayIso = new Date().toISOString().slice(0, 10)) {
  if (!show || typeof show !== 'object' || !show.name) return null;
  const imdbRaw = show.externals && show.externals.imdb ? String(show.externals.imdb).trim().toLowerCase() : '';
  const imdbId = isValidImdbId(imdbRaw) ? imdbRaw : '';
  const releaseDate = /^\d{4}-\d{2}-\d{2}$/.test(String(show.premiered || '')) ? String(show.premiered) : '';
  const statusRaw = String(show.status || '').toLowerCase();
  const isUpcoming =
    (releaseDate && releaseDate > todayIso) ||
    statusRaw.includes('development') ||
    statusRaw.includes('tbd');
  const year = releaseDate ? Number(releaseDate.slice(0, 4)) : isUpcoming ? Number(todayIso.slice(0, 4)) : 2025;
  const netCountry =
    (show.network && show.network.country && (show.network.country.code || show.network.country.name)) ||
    (show.webChannel && show.webChannel.country && (show.webChannel.country.code || show.webChannel.country.name)) ||
    '';
  const countryName =
    (show.network && show.network.country && show.network.country.name) ||
    (show.webChannel && show.webChannel.country && show.webChannel.country.name) ||
    '';
  const region = mapCountryLangToRegion(netCountry ? [netCountry, countryName] : [], show.language);
  const summary = stripHtml(show.summary);
  const poster =
    (show.image && (show.image.original || show.image.medium))
      ? String(show.image.original || show.image.medium).replace(/^http:\/\//i, 'https://')
      : '';
  const castRows =
    show._embedded && Array.isArray(show._embedded.cast)
      ? show._embedded.cast.slice(0, 12).map((c) => ({
          slug: slugifyMovie(c.person && c.person.name),
          name: (c.person && c.person.name) || '',
          character: (c.character && c.character.name) || '',
        })).filter((c) => c.name)
      : [];

  const providers = [];
  if (show.officialSite && /^https:\/\//i.test(String(show.officialSite))) {
    providers.push({
      name: (show.webChannel && show.webChannel.name) || (show.network && show.network.name) || 'Official Network',
      kind: 'Official Platform',
      url: String(show.officialSite),
      region: countryName || 'Global',
    });
  }
  if (imdbId) {
    providers.push({
      name: 'IMDb Official Page',
      kind: 'Official Info',
      url: `https://www.imdb.com/title/${imdbId}/`,
      region: 'Global',
    });
  }
  providers.push({
    name: 'Official Trailer Search',
    kind: 'Trailer',
    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${show.name} ${year} official trailer`)}`,
    region: 'Global',
  });

  return cleanMovie({
    slug: slugifyMovie(`${show.name}-${year}`) || imdbId,
    imdbId,
    title: show.name,
    type: 'series',
    year,
    releaseDate,
    status: isUpcoming ? 'upcoming' : 'released',
    region,
    country: countryName || region,
    language: show.language || 'English',
    genres: Array.isArray(show.genres) && show.genres.length ? show.genres : ['Drama'],
    rating: (show.rating && Number(show.rating.average)) || 0,
    runtime: Number(show.averageRuntime || show.runtime) || 45,
    tagline: `${show.language || 'Global'} ${(show.genres || ['Drama']).slice(0, 2).join(' · ')} series${(show.webChannel && show.webChannel.name) ? ` on ${show.webChannel.name}` : (show.network && show.network.name) ? ` on ${show.network.name}` : ''}.`,
    story: summary || `${show.name} (${year}) official episode guide, cast and release information on Mizanora.`,
    poster,
    cast: castRows,
    legalProviders: providers,
    seasons: releaseDate
      ? [
          {
            season: 1,
            title: 'Season 1',
            year,
            episodes: [
              {
                e: 1,
                title: 'Series Premiere',
                runtime: Number(show.averageRuntime || show.runtime) || 45,
                airDate: releaseDate,
                summary: summary.slice(0, 240) || `Official premiere of ${show.name}.`,
              },
            ],
          },
        ]
      : [],
    keywords: `${show.name} ${imdbId} ${region} ${show.language || ''} series`.toLowerCase(),
  });
}

export function parseImdbSuggestionItem(d, currentYear = new Date().getFullYear()) {
  if (!d || typeof d !== 'object') return null;
  const id = String(d.id || '').trim().toLowerCase();
  if (!isValidImdbId(id)) return null;
  const title = String(d.l || '').trim();
  if (!title) return null;
  const qid = String(d.qid || d.q || '').toLowerCase();
  const type = qid.includes('tv') || qid.includes('series') ? 'series' : 'movie';
  const year = Number(d.y) || currentYear;
  const isUpcoming = year > currentYear;
  const stars = String(d.s || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && !/^dir\./i.test(s))
    .slice(0, 8)
    .map((name) => ({ slug: slugifyMovie(name), name, character: '' }));
  const poster = d.i && typeof d.i.imageUrl === 'string' && d.i.imageUrl.startsWith('https://') ? d.i.imageUrl : '';

  return cleanMovie({
    slug: slugifyMovie(`${title}-${year}`) || id,
    imdbId: id,
    title,
    type,
    year,
    releaseDate: isUpcoming ? `${year}-06-01` : `${year}-01-01`,
    status: isUpcoming ? 'upcoming' : 'released',
    region: 'International',
    country: 'International',
    language: 'English',
    genres: ['Drama'],
    rating: 0,
    runtime: type === 'series' ? 45 : 120,
    tagline: `${title} (${year}) — official IMDb ${id} cast, trailer & watch guide on Mizanora.`,
    story: `${title} (${year}) featuring ${stars.map((c) => c.name).join(', ') || 'featured cast'}. Browse official cast profiles, trailer links and legal watch options on Mizanora.`,
    poster,
    cast: stars,
    legalProviders: [
      { name: 'IMDb Official Page', kind: 'Official Info', url: `https://www.imdb.com/title/${id}/`, region: 'Global' },
      {
        name: 'Official Trailer on YouTube',
        kind: 'Trailer',
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} ${year} official trailer`)}`,
        region: 'Global',
      },
    ],
    keywords: `${title} ${id} ${year} ${stars.map((c) => c.name).join(' ')}`.toLowerCase(),
  });
}

export function parseArchivePublicDomainDoc(doc, mp4FileName = '') {
  if (!doc || typeof doc !== 'object') return null;
  const identifier = String(doc.identifier || '').trim();
  const title = String(doc.title || '').trim();
  if (!identifier || !title || !mp4FileName || !/\.mp4$/i.test(mp4FileName)) return null;
  const yearMatch = String(doc.year || doc.date || '').match(/\b(189\d|19\d\d|20[0-2]\d)\b/);
  const year = yearMatch ? Number(yearMatch[1]) : 1955;
  const desc = stripHtml(Array.isArray(doc.description) ? doc.description[0] : doc.description || '');
  const creator = Array.isArray(doc.creator) ? doc.creator.join(', ') : String(doc.creator || '');
  const streamUrl = `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(mp4FileName).replace(/%2F/gi, '/')}`;

  return cleanMovie({
    slug: slugifyMovie(`${title}-${year}`) || slugifyMovie(identifier),
    title,
    type: 'movie',
    year,
    releaseDate: `${year}-01-01`,
    status: 'released',
    region: 'International',
    country: 'Classic Archive',
    language: 'English',
    genres: ['Drama', 'History'],
    rating: 7.2,
    runtime: 90,
    ageRating: 'PG',
    tagline: `Verified Public-Domain classic (${year}) — stream full length legally on Mizanora.`,
    story: desc.slice(0, 900) || `${title} (${year}) preserved in the Internet Archive Feature Films public-domain collection.`,
    director: creator.slice(0, 90),
    poster: `https://archive.org/services/img/${encodeURIComponent(identifier)}`,
    publicDomainStream: {
      url: streamUrl,
      license: `Public Domain Classic (${year}) · Internet Archive Feature Films`,
      licenseType: 'public-domain',
      sourceName: 'Internet Archive',
      sourceUrl: `https://archive.org/details/${encodeURIComponent(identifier)}`,
    },
    legalProviders: [
      {
        name: 'Internet Archive Official Page',
        kind: 'Free Public Domain',
        url: `https://archive.org/details/${encodeURIComponent(identifier)}`,
        region: 'Global',
      },
    ],
    keywords: `${title} ${year} public domain free classic movie internet archive`.toLowerCase(),
  });
}

// Zero-key single IMDb lookup (TVmaze -> IMDb Official Public Suggestion JSON)
export async function lookupZeroKeyByImdbId(rawImdbId, { fetchFn = globalThis.fetch, timeoutMs = 5000 } = {}) {
  const imdbId = String(rawImdbId || '').trim().toLowerCase();
  if (!isValidImdbId(imdbId)) return null;

  // 1. Try TVmaze official lookup (returns rich plot, HD poster, genres & cast for series)
  const tvShow = await safeJsonFetch(
    `https://api.tvmaze.com/lookup/shows?imdb=${encodeURIComponent(imdbId)}`,
    { fetchFn, timeoutMs },
  );
  if (tvShow && tvShow.id) {
    const castList = await safeJsonFetch(
      `https://api.tvmaze.com/shows/${tvShow.id}/cast`,
      { fetchFn, timeoutMs: Math.min(timeoutMs, 3500) },
    );
    const parsed = parseTvmazeShow({
      ...tvShow,
      _embedded: { cast: Array.isArray(castList) ? castList : [] },
    });
    if (parsed) return parsed;
  }

  // 2. Try IMDb public autocomplete suggestion JSON (works for both movies & series with zero key)
  const first = imdbId[0] || 't';
  const sg = await safeJsonFetch(
    `https://v3.sg.media-imdb.com/suggestion/${first}/${encodeURIComponent(imdbId)}.json`,
    { fetchFn, timeoutMs },
  );
  if (sg && Array.isArray(sg.d)) {
    const exact = sg.d.find((x) => x && String(x.id || '').toLowerCase() === imdbId) || sg.d[0];
    const parsed = parseImdbSuggestionItem(exact);
    if (parsed) return parsed;
  }

  return null;
}

// Discover Upcoming + Latest (Newest-to-Oldest) + Classics + Regional from TMDB when key/token is provided
export async function discoverFromTmdb(
  rawApiKey,
  {
    includeUpcoming = true,
    includeLatest = true,
    includeClassics = true,
    includeRegional = true,
    pagesPerFeed = 2,
    fetchFn = globalThis.fetch,
    timeoutMs = 6500,
  } = {},
) {
  const key = String(rawApiKey || '').trim();
  if (!key) return { movies: [], actors: [] };

  const todayIso = new Date().toISOString().slice(0, 10);
  const endpoints = [];

  if (includeUpcoming) {
    for (let p = 1; p <= pagesPerFeed; p += 1) {
      endpoints.push({ path: `movie/upcoming?page=${p}`, kind: 'movie' });
    }
    endpoints.push({ path: 'movie/upcoming?region=PK&page=1', kind: 'movie' });
    endpoints.push({ path: 'movie/upcoming?region=IN&page=1', kind: 'movie' });
  }
  if (includeLatest) {
    for (let p = 1; p <= pagesPerFeed; p += 1) {
      endpoints.push({ path: `movie/now_playing?page=${p}`, kind: 'movie' });
      endpoints.push({ path: `trending/movie/week?page=${p}`, kind: 'movie' });
      endpoints.push({ path: `tv/on_the_air?page=${p}`, kind: 'tv' });
    }
  }
  if (includeClassics) {
    for (let p = 1; p <= pagesPerFeed; p += 1) {
      endpoints.push({ path: `movie/top_rated?page=${p}`, kind: 'movie' });
      endpoints.push({ path: `tv/top_rated?page=${p}`, kind: 'tv' });
    }
  }
  if (includeRegional) {
    for (const country of ['PK', 'IN', 'BD', 'IR', 'IQ', 'AF', 'TR']) {
      endpoints.push({
        path: `discover/movie?with_origin_country=${country}&sort_by=primary_release_date.desc&page=1`,
        kind: 'movie',
      });
      endpoints.push({
        path: `discover/tv?with_origin_country=${country}&sort_by=first_air_date.desc&page=1`,
        kind: 'tv',
      });
    }
  }

  const responses = await Promise.all(
    endpoints.map(async (ep) => {
      const req = buildTmdbRequest(ep.path, key);
      if (!req) return [];
      const data = await safeJsonFetch(req.url, { headers: req.headers, timeoutMs, fetchFn });
      if (!data || !Array.isArray(data.results)) return [];
      return data.results.map((item) => parseTmdbSummaryItem(item, ep.kind, todayIso)).filter(Boolean);
    }),
  );

  const seen = new Set();
  const movies = [];
  for (const batch of responses) {
    for (const m of batch) {
      const k = m.imdbId || m.slug;
      if (!k || seen.has(k)) continue;
      seen.add(k);
      movies.push(m);
    }
  }

  return { movies: sortMoviesNewestToOldest(movies), actors: [] };
}

// Zero-key automatic feed from TVmaze Official API (upcoming schedule + newest & popular global/regional shows)
export async function discoverFromTvmaze(
  {
    includeUpcoming = true,
    includeLatest = true,
    includeRegional = true,
    maxItems = 140,
    fetchFn = globalThis.fetch,
    timeoutMs = 5000,
  } = {},
) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const nextWeekIso = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const tasks = [];

  if (includeUpcoming) {
    tasks.push(
      safeJsonFetch(`https://api.tvmaze.com/schedule/web?date=${nextWeekIso}`, { fetchFn, timeoutMs }).then((rows) =>
        (Array.isArray(rows) ? rows : [])
          .map((r) => (r && r._embedded && r._embedded.show) || (r && r.show) || null)
          .filter(Boolean),
      ),
    );
  }
  if (includeLatest) {
    tasks.push(
      safeJsonFetch(`https://api.tvmaze.com/schedule/web?date=${todayIso}`, { fetchFn, timeoutMs }).then((rows) =>
        (Array.isArray(rows) ? rows : [])
          .map((r) => (r && r._embedded && r._embedded.show) || (r && r.show) || null)
          .filter(Boolean),
      ),
    );
    tasks.push(
      safeJsonFetch('https://api.tvmaze.com/shows?page=0', { fetchFn, timeoutMs }).then((rows) =>
        (Array.isArray(rows) ? rows.slice(0, 60) : []),
      ),
    );
  }
  if (includeRegional) {
    for (const q of ['pakistan', 'india', 'bangladesh', 'iran', 'iraq', 'turkish', 'arabic']) {
      tasks.push(
        safeJsonFetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`, { fetchFn, timeoutMs }).then((rows) =>
          (Array.isArray(rows) ? rows.map((r) => r && r.show).filter(Boolean) : []),
        ),
      );
    }
  }

  const groups = await Promise.all(tasks);
  const seen = new Set();
  const movies = [];
  for (const list of groups) {
    for (const rawShow of list) {
      const m = parseTvmazeShow(rawShow, todayIso);
      if (!m) continue;
      const k = m.imdbId || m.slug;
      if (seen.has(k)) continue;
      seen.add(k);
      movies.push(m);
      if (movies.length >= maxItems) break;
    }
    if (movies.length >= maxItems) break;
  }

  return { movies: sortMoviesNewestToOldest(movies), actors: [] };
}

// Zero-key automatic Public-Domain classic film discovery from Internet Archive
export async function discoverFromInternetArchive(
  { rows = 12, fetchFn = globalThis.fetch, timeoutMs = 5500 } = {},
) {
  const q = encodeURIComponent('collection:(feature_films) AND mediatype:(movies) AND format:(512Kb MPEG4)');
  const searchUrl = `https://archive.org/advancedsearch.php?q=${q}&fl[]=identifier,title,year,description,creator&sort[]=downloads+desc&rows=${Math.min(30, Math.max(1, rows))}&page=1&output=json`;
  const data = await safeJsonFetch(searchUrl, { fetchFn, timeoutMs });
  const docs = (data && data.response && Array.isArray(data.response.docs)) ? data.response.docs : [];
  if (!docs.length) return { movies: [] };

  const movies = (
    await Promise.all(
      docs.slice(0, rows).map(async (doc) => {
        if (!doc || !doc.identifier) return null;
        const meta = await safeJsonFetch(
          `https://archive.org/metadata/${encodeURIComponent(doc.identifier)}/files`,
          { fetchFn, timeoutMs: Math.min(timeoutMs, 4000) },
        );
        const files = (meta && Array.isArray(meta.result)) ? meta.result : [];
        const mp4 =
          files.find((f) => f && typeof f.name === 'string' && /_512kb\.mp4$/i.test(f.name)) ||
          files.find((f) => f && typeof f.name === 'string' && /\.mp4$/i.test(f.name) && !/sample|trailer/i.test(f.name));
        if (!mp4) return null;
        return parseArchivePublicDomainDoc(doc, mp4.name);
      }),
    )
  ).filter(Boolean);

  return { movies };
}

// Unified Auto-Discovery: combines TMDB (if key present) + TVmaze + Internet Archive Public Domain
export async function runAutoFeedDiscovery({
  tmdbApiKey = '',
  autoSync = {},
  pagesPerFeed = 2,
  archiveRows = 10,
  fetchFn = globalThis.fetch,
  timeoutMs = 6000,
} = {}) {
  const opts = {
    includeUpcoming: autoSync.includeUpcoming !== false,
    includeLatest: autoSync.includeLatest !== false,
    includeClassics: autoSync.includeClassics !== false,
    includeRegional: autoSync.includeRegional !== false,
    includePublicDomain: autoSync.includePublicDomain !== false,
  };

  const jobs = [
    discoverFromTvmaze({
      includeUpcoming: opts.includeUpcoming,
      includeLatest: opts.includeLatest,
      includeRegional: opts.includeRegional,
      fetchFn,
      timeoutMs,
    }),
  ];
  if (tmdbApiKey) {
    jobs.unshift(
      discoverFromTmdb(tmdbApiKey, {
        ...opts,
        pagesPerFeed,
        fetchFn,
        timeoutMs,
      }),
    );
  }
  if (opts.includePublicDomain) {
    jobs.push(discoverFromInternetArchive({ rows: archiveRows, fetchFn, timeoutMs }));
  }

  const results = await Promise.all(jobs);
  const seen = new Set();
  const movies = [];
  const actors = [];
  const seenActors = new Set();

  for (const r of results) {
    for (const m of (r && r.movies) || []) {
      const k = m.imdbId || m.slug;
      if (!k || seen.has(k)) continue;
      seen.add(k);
      movies.push(m);
    }
    for (const a of (r && r.actors) || []) {
      const ca = cleanActor(a);
      if (!ca || seenActors.has(ca.slug)) continue;
      seenActors.add(ca.slug);
      actors.push(ca);
    }
  }

  return {
    movies: sortMoviesNewestToOldest(movies),
    actors,
    sourcesUsed: {
      tmdb: Boolean(tmdbApiKey),
      tvmaze: true,
      internetArchive: opts.includePublicDomain,
    },
  };
}

// Bulk resolve a pasted list of IMDb IDs (tt...) in bounded parallel batches
export async function bulkResolveImdbIds(
  rawTextOrIds,
  { lookupByImdbFn, fetchFn = globalThis.fetch, maxIds = 200, concurrency = 8 } = {},
) {
  const ids = Array.isArray(rawTextOrIds)
    ? extractImdbIds(rawTextOrIds.join(' '), maxIds)
    : extractImdbIds(rawTextOrIds, maxIds);
  if (!ids.length) return { ids: [], movies: [], failed: [] };

  const movies = [];
  const failed = [];
  for (let i = 0; i < ids.length; i += concurrency) {
    const chunk = ids.slice(i, i + concurrency);
    const resolved = await Promise.all(
      chunk.map(async (id) => {
        try {
          if (typeof lookupByImdbFn === 'function') {
            const hit = await lookupByImdbFn(id);
            if (hit) return hit;
          }
          return await lookupZeroKeyByImdbId(id, { fetchFn });
        } catch {
          return null;
        }
      }),
    );
    resolved.forEach((item, idx) => {
      if (item) movies.push(item);
      else failed.push(chunk[idx]);
    });
  }

  return {
    ids,
    movies: sortMoviesNewestToOldest(movies),
    failed,
  };
}
