// Mizanora v51 — Play Servers: the admin-managed list of streaming sources the Cinema Player uses.
//
// The whole idea (Roman Urdu): Admin apna server / CDN add karta hai aur URL mein {imdbid} likh deta hai,
// jaise  https://my-cdn.example.com/play/{imdbid}  — phir har movie page par player khud us title ki
// IMDb ID daal kar sahi link bana leta hai. Add / Edit / Delete / order / on-off sab Admin > Movies >
// Play Servers se hota hai.
//
// Pure module: no React, no Firestore, no node-only APIs. The browser player, the server pages and the
// admin route all share these functions, so a link built on the server is exactly the link built in the
// browser (and scripts/test-v51.mjs can test it without a database).

export const MOVIE_SERVERS_DOC = { collection: 'siteMeta', id: 'movieServers' };
export const MAX_MOVIE_SERVERS = 40;

// Every placeholder a template may use. Anything else inside { } is refused, so a typo cannot quietly
// produce a broken link (that was the classic "server adds but nothing plays" bug).
export const SERVER_TOKENS = [
  ['{imdbid}', 'IMDb title ID, e.g. tt22084616'],
  ['{imdb}', 'Same as {imdbid}'],
  ['{tt}', 'Same as {imdbid}'],
  ['{slug}', 'Mizanora slug, e.g. the-legend-of-maula-jatt-2022'],
  ['{title}', 'Title, URL-encoded'],
  ['{year}', 'Release year'],
  ['{type}', 'movie or series'],
  ['{season}', 'Season number (series)'],
  ['{episode}', 'Episode number (series)'],
  ['{s}', 'Season number, numbers only'],
  ['{e}', 'Episode number, numbers only'],
];

const TOKEN_RE = /\{(imdbid|imdb|tt|id|slug|title|year|type|season|episode|s|e)\}/gi;
const TOKEN_SET = new Set(['imdbid', 'imdb', 'tt', 'id', 'slug', 'title', 'year', 'type', 'season', 'episode', 's', 'e']);

export const SERVER_KINDS = [
  ['auto', 'Auto (link se pehchano)'],
  ['embed', 'Embed page (iframe)'],
  ['hls', 'HLS stream (.m3u8)'],
  ['mp4', 'MP4 / WebM file'],
  ['dash', 'DASH stream (.mpd)'],
];

export const SERVER_SCOPES = [
  ['all', 'Movies + Series'],
  ['movie', 'Movies only'],
  ['series', 'Series only'],
];

export const SERVER_QUALITIES = ['Auto', '4K', '1080p', 'HD', '720p', '480p', 'SD'];

// Ready-made shapes shown in the admin panel as one-tap examples. They point at EXAMPLE hosts on
// purpose: the admin replaces them with their own CDN / licensed provider.
export const SERVER_TEMPLATE_EXAMPLES = [
  { label: 'Embed page /play/{imdbid}', template: 'https://cdn.example.com/play/{imdbid}' },
  { label: 'Embed page /embed/movie/{imdbid}', template: 'https://cdn.example.com/embed/movie/{imdbid}' },
  { label: 'HLS master playlist', template: 'https://cdn.example.com/movies/{imdbid}/master.m3u8' },
  { label: 'MP4 file', template: 'https://cdn.example.com/movies/{imdbid}.mp4' },
  { label: 'Series episode', template: 'https://cdn.example.com/series/{imdbid}/{season}/{episode}.m3u8' },
];

export const MOVIE_SERVERS_DEFAULT = {
  enabled: true,
  servers: [],
  ads: {
    enabled: true,
    seconds: 10,
    skipAfter: 5,
    headline: 'Mizanora Store',
    note: 'Pakistan bhar mein Cash on Delivery — fashion, footwear, gadgets aur daily essentials.',
  },
  updatedAt: 0,
};

const clamp = (n, lo, hi, fallback = lo) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(lo, Math.min(hi, v));
};

const cleanText = (s, max) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max);

export function slugifyServerId(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36);
}

export function serverKindFromUrl(url) {
  const u = String(url || '').split('?')[0].toLowerCase();
  if (/\.m3u8$/.test(u)) return 'hls';
  if (/\.mpd$/.test(u)) return 'dash';
  if (/\.(mp4|webm|ogv|mov)$/.test(u)) return 'mp4';
  return 'embed';
}

export function templateUrlHas(template, token) {
  const t = String(template || '').toLowerCase();
  return t.includes(`{${String(token || '').toLowerCase()}}`);
}

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

const isPrivateHost = (host) => {
  const h = String(host || '').toLowerCase();
  if (!h) return true;
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.localhost')) return true;
  if (h.includes(':')) return true; // IPv6 literal
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return true; // raw IPv4
  return false;
};

// Fill a sample value for every token so a template can be validated as a real URL.
export function sampleTemplateUrl(template) {
  return String(template || '').replace(TOKEN_RE, (m, k) => {
    const key = String(k).toLowerCase();
    if (key === 'season' || key === 's') return '1';
    if (key === 'episode' || key === 'e') return '1';
    if (key === 'year') return '2026';
    if (key === 'type') return 'movie';
    if (key === 'slug') return 'sample-title-2026';
    if (key === 'title') return 'Sample%20Title';
    if (key === 'imdbid' || key === 'imdb' || key === 'tt' || key === 'id') return 'tt0000000';
    return '';
  });
}

// Returns { ok, error } — used by the admin API so a bad template is refused with a clear reason.
export function validateServerTemplate(template) {
  const raw = String(template || '').trim();
  if (!raw) return { ok: false, error: 'Server link (template) likhein — jaise https://my-cdn.com/play/{imdbid}.' };
  if (raw.length > 400) return { ok: false, error: 'Link bohat lamba hai (400 characters se zyada).' };

  const braces = raw.match(/\{[^}]*\}/g) || [];
  for (const b of braces) {
    const key = b.slice(1, -1).toLowerCase();
    if (!TOKEN_SET.has(key)) {
      return { ok: false, error: `"${b}" koi jaana hua token nahi. Sirf yeh chaltay hain: ${SERVER_TOKENS.map((t) => t[0]).join(' ')}` };
    }
  }

  const sample = sampleTemplateUrl(raw);
  let u;
  try {
    u = new URL(sample);
  } catch {
    return { ok: false, error: 'Yeh valid URL nahi banta. Link https:// se shuru karein aur {imdbid} jaisa token sahi likhein.' };
  }
  if (u.protocol !== 'https:') {
    return { ok: false, error: 'Sirf https:// links chaltay hain (http mixed-content ki wajah se browser block kar deta hai).' };
  }
  if (u.username || u.password) return { ok: false, error: 'Link mein username/password nahi ho sakta.' };
  if (isPrivateHost(u.hostname)) return { ok: false, error: 'localhost / private IP address qabool nahi — public host chahiye.' };
  return { ok: true, error: '' };
}

export function cleanServer(raw, index = 0) {
  if (!raw || typeof raw !== 'object') return null;
  const name = cleanText(raw.name, 40);
  const template = String(raw.template || '').trim().slice(0, 400);
  if (!name || !template) return null;
  if (!validateServerTemplate(template).ok) return null;

  const requestedKind = String(raw.kind || 'auto').toLowerCase();
  const kind = ['embed', 'hls', 'mp4', 'dash'].includes(requestedKind)
    ? requestedKind
    : serverKindFromUrl(template);
  const scope = ['movie', 'series'].includes(String(raw.scope || '')) ? String(raw.scope) : 'all';
  const quality = cleanText(raw.quality, 10) || 'Auto';
  const language = cleanText(raw.language, 24) || 'Urdu / English';
  const idBase = slugifyServerId(raw.id || name) || `server-${index + 1}`;

  return {
    id: idBase,
    name,
    template,
    kind,
    host: hostOf(sampleTemplateUrl(template)),
    quality,
    language,
    scope,
    priority: clamp(raw.priority, 1, 99, index + 1),
    enabled: raw.enabled !== false,
    // A series template usually carries {season}/{episode}; used to show the right default in the player.
    episodic: templateUrlHas(template, 'season') || templateUrlHas(template, 'episode'),
    // Admin confirms they own / are licensed to stream from this host. Kept on the record.
    rightsConfirmed: raw.rightsConfirmed === true,
    note: cleanText(raw.note, 120),
    createdAt: Number(raw.createdAt) || Date.now(),
  };
}

// Keep ids unique without surprises: second "HD Server" becomes hd-server-2.
export function cleanServersList(list = [], max = MAX_MOVIE_SERVERS) {
    const out = [];
  const seen = new Set();
  (Array.isArray(list) ? list : []).slice(0, max * 2).forEach((raw, i) => {
    const s = cleanServer(raw, out.length);
    if (!s) return;
    let id = s.id;
    let n = 2;
    while (seen.has(id)) {
      id = `${s.id}-${n}`;
      n += 1;
    }
    seen.add(id);
    s.id = id;
    out.push(s);
    if (out.length >= max) return;
  });
  return out;
}

export function cleanMoviesServersConfig(raw = {}) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const rawAds = d.ads && typeof d.ads === 'object' ? d.ads : {};
  const servers = cleanServersList(d.servers).sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
  return {
    enabled: d.enabled !== false,
    servers,
    ads: {
      enabled: rawAds.enabled !== false,
      seconds: clamp(rawAds.seconds, 0, 30, 10),
      skipAfter: clamp(rawAds.skipAfter, 0, 20, 5),
      headline: cleanText(rawAds.headline, 50) || MOVIE_SERVERS_DEFAULT.ads.headline,
      note: cleanText(rawAds.note, 180) || MOVIE_SERVERS_DEFAULT.ads.note,
    },
    updatedAt: Number(d.updatedAt) || 0,
  };
}

// ---------------------------------------------------------------------------------------------
// The link builder. One implementation, used by the server page, the API and the browser player.
// ---------------------------------------------------------------------------------------------
export function serverLinkValues({ imdbId = '', slug = '', title = '', year = 0, type = 'movie', season = 1, episode = 1 } = {}) {
  const cleanImdb = /^tt\d{6,10}$/i.test(String(imdbId || '').trim()) ? String(imdbId).trim().toLowerCase() : '';
  const s = clamp(season, 1, 99, 1);
  const e = clamp(episode, 1, 999, 1);
  return {
    imdbid: cleanImdb,
    imdb: cleanImdb,
    tt: cleanImdb,
    id: cleanImdb,
    slug: String(slug || '').replace(/[^a-z0-9-]/gi, ''),
    title: encodeURIComponent(String(title || '')),
    year: String(Number(year) || ''),
    type: type === 'series' ? 'series' : 'movie',
    season: String(s),
    episode: String(e),
    s: String(s),
    e: String(e),
  };
}

export function buildServerUrl(template, info = {}) {
  const values = serverLinkValues(info);
  return String(template || '').replace(TOKEN_RE, (m, k) => {
    const key = String(k).toLowerCase();
    return values[key] == null ? '' : values[key];
  });
}

// Which servers can actually play this title right now?
export function resolveMovieServers(servers = [], info = {}) {
  const type = info.type === 'series' ? 'series' : 'movie';
  const imdbId = String(info.imdbId || '').trim();
  const out = [];
  const seenUrls = new Set();

  for (const raw of Array.isArray(servers) ? servers : []) {
    const s = raw && raw.id ? raw : cleanServer(raw);
    if (!s || s.enabled === false) continue;
    if (s.scope !== 'all' && s.scope !== type) continue;
    // A template that carries the IMDb ID cannot play a title without one - skip it instead of
    // rendering a link to /play/ (the "empty player" bug).
    if (templateUrlHas(s.template, 'imdbid') && !/^tt\d{6,10}$/i.test(imdbId)) continue;
    const url = buildServerUrl(s.template, { ...info, type });
    if (!url || !/^https:\/\//i.test(url)) continue;
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);
    out.push({ ...s, url, kind: s.kind || serverKindFromUrl(url) });
  }

  return out.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
}

// A tiny, honest summary for the admin panel and the player header.
export function describeServers(servers = []) {
  const list = Array.isArray(servers) ? servers : [];
  return {
    total: list.length,
    on: list.filter((s) => s.enabled !== false).length,
    movies: list.filter((s) => s.scope !== 'series').length,
    series: list.filter((s) => s.scope !== 'movie').length,
    kinds: [...new Set(list.map((s) => s.kind))].filter(Boolean),
  };
}
