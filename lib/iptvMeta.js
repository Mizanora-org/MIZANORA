// IMDb METADATA — naam se saaf title nikalna aur Cinemeta/IMDb ke jawab ko item par lagana.
// Sab kuch pure hai (koi network nahi) taake test ho sake; network `lib/gateway/imdb.js` mein hai.

const NOISE = /\b(2160p|1080p|720p|480p|360p|4k|uhd|web-?dl|web-?rip|bluray|blu-?ray|brrip|bdrip|hdrip|dvdrip|hdtv|hdts|camrip|cam|ts|tc|x264|x265|h264|hevc|avc|aac|ac3|ddp?5\.1|dts|hdr10?|dv|remux|proper|repack|multi|dual audio|dubbed|esub|esubs|subbed|hindi|urdu|english|full movie|watch online|free download)\b/gi;

const cleanText = (s, n = 200) => String(s == null ? '' : s).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

/** "Movie.Name.2023.1080p.WEB-DL.x264" -> "Movie Name" (saal alag se). */
export function titleOf(name) {
  let s = cleanText(name, 200);
  s = s.replace(/\.(mkv|mp4|avi|mov|m3u8|ts)$/i, '').replace(/[_|]+/g, ' ');
  s = s.replace(/\.(?=[A-Za-z0-9])/g, ' ');
  s = s.replace(/[-.][A-Za-z0-9]{2,12}$/, ' ');      // release group (-GRP, .YTS)
  // sirf release ka saal hatao (aakhri occurrence) — "1917" jaisi film ka naam na toote
  const years = s.match(/\b(19|20)\d{2}\b/g);
  if (years && years.length) {
    const last = years[years.length - 1];
    const at = s.lastIndexOf(last);
    if (at >= 0) s = `${s.slice(0, at)} ${s.slice(at + last.length)}`;
  }
  s = s.replace(/\[[^\]]*\]/g, ' ').replace(/\([^)]*\)/g, ' ');
  s = s.replace(/[Ss]\d{1,2}\s*[Ee]\d{1,3}(.*)$/, ' ');
  s = s.replace(/\b\d{1,2}x\d{1,3}\b.*$/, ' ');
  s = s.replace(NOISE, ' ');
  s = s.replace(/[-–—_]+/g, ' ');
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s.length >= 2 ? s : cleanText(name, 200);
}

/** Naam se saal: "(2023)" ya ".2023." ya " 2023 ". */
export function yearOf(name) {
  const m = String(name || '').match(/(19\d{2}|20\d{2})/);
  if (!m) return 0;
  const y = Number(m[1]);
  return y >= 1900 && y <= new Date().getFullYear() + 2 ? y : 0;
}

const tokens = (s) => titleOf(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);

/** 0..1 — kitna milta julta naam hai (token overlap + shuru ka match). */
export function similarity(a, b) {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const t of A) if (B.has(t)) hit++;
  const overlap = hit / Math.max(A.size, B.size);
  // "The Matrix" vs "The Matrix Reloaded" — shuru ka match thora bonus
  const la = titleOf(a).toLowerCase();
  const lb = titleOf(b).toLowerCase();
  const head = la && lb && (la.startsWith(lb) || lb.startsWith(la)) ? 0.15 : 0;
  return Math.min(1, overlap + head);
}

/** Cinemeta ke results mein se sab se behtar match (score >= 0.55). */
export function bestMeta(metas, query, wantYear = 0) {
  const list = Array.isArray(metas) ? metas.filter((m) => m && m.name) : [];
  let best = null;
  let bestScore = 0;
  for (const m of list) {
    let score = similarity(m.name, query);
    const y = Number(String(m.releaseInfo || m.year || '').slice(0, 4)) || 0;
    if (wantYear && y) score += y === wantYear ? 0.25 : (Math.abs(y - wantYear) <= 1 ? 0.1 : -0.15);
    if (m.imdb_id || String(m.id || '').startsWith('tt')) score += 0.05;
    if (score > bestScore) { best = m; bestScore = score; }
  }
  return bestScore >= 0.55 ? { meta: best, score: Number(Math.min(1, bestScore).toFixed(2)) } : null;
}

export const imdbIdOf = (meta) => {
  const raw = String((meta && (meta.imdb_id || meta.id)) || '');
  const m = raw.match(/tt\d{6,9}/);
  return m ? m[0] : '';
};

export const metahubPoster = (imdbId, size = 'medium') => (imdbId ? `https://images.metahub.space/poster/${size}/${imdbId}/img` : '');
export const metahubBackdrop = (imdbId) => (imdbId ? `https://images.metahub.space/background/medium/${imdbId}/img` : '');

const listOr = (v) => (Array.isArray(v) ? v : (typeof v === 'string' && v ? v.split(',').map((x) => x.trim()) : []));

/**
 * IMDb ka meta item par lagao. `url`, `id`, `ext` waise hi rehte hain — sirf dikhne wali
 * cheezein (name, year, rating, poster, plot, cast) IMDb se aati hain.
 */
export function mergeMeta(item = {}, meta = {}, kind = 'movie') {
  const id = imdbIdOf(meta);
  const out = { ...item };
  if (meta.name) out.name = cleanText(meta.name, 120);
  const y = yearOf(meta.releaseInfo || meta.year || '');
  if (y) out.year = y;
  const rating = Number(String(meta.imdbRating || '').replace(/[^\d.]/g, ''));
  if (rating) out.rating = Math.min(10, Math.max(0, rating));
  if (meta.description) out.plot = cleanText(meta.description, 300);
  out.poster = meta.poster || out.poster || metahubPoster(id);
  if (id) out.imdbId = id;
  if (meta.background) out.backdrop = meta.background;
  else if (id) out.backdrop = metahubBackdrop(id);
  const genres = listOr(meta.genres || meta.genre);
  if (genres.length) out.genres = genres.slice(0, 4);
  if (kind === 'series') {
    const eps = Array.isArray(meta.videos) ? meta.videos.filter((v) => Number(v.season) >= 1 && (Number(v.episode) >= 1 || Number(v.number) >= 1)).length : 0;
    if (eps) out.imdbEpisodes = eps;
  } else {
    if (meta.runtime) out.runtime = cleanText(meta.runtime, 20);
    const cast = listOr(meta.cast);
    if (cast.length) out.cast = cast.slice(0, 6).join(', ');
    if (meta.director) out.director = cleanText(Array.isArray(meta.director) ? meta.director.join(', ') : meta.director, 120);
  }
  out.meta = 'imdb';
  out.metaAt = Date.now();
  return out;
}

/** Movie/series par IMDb lagane ki zaroorat hai? (mostly missing fields) */
export const needsMeta = (item) => !item || !item.imdbId || !item.poster || !item.plot;

/** Search query: title + year (Cinemeta ko dena hai). */
export function searchQuery(item = {}) {
  const t = titleOf(item.name);
  const y = Number(item.year) || yearOf(item.name);
  return { title: t, year: y, q: t };
}
