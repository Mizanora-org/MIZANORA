// MIZANORA IPTV — Movies (VOD) aur Series ka data model. Pure code.
//
// Admin M3U file/link ya manual se daalta hai. Gateway inhein Xtream (`get_vod_streams`,
// `get_series`) aur Stalker (`vod` type) dono par serve karta hai.
// Series ka naam "Breaking Bad S02E05" jaisa ho to parser khud season/episode bana leta hai.

export const VOD_DOC = { collection: 'siteMeta', id: 'iptvVod' };
export const MAX_MOVIES = 240000;
export const MAX_SERIES = 120000;

const clean = (s, n) => String(s == null ? '' : s).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const url = (v) => {
  const s = String(v || '').trim();
  return /^https?:\/\/[^\s"'<>]+$/i.test(s) ? s : '';
};
const extOf = (u) => {
  const m = String(u).split('?')[0].match(/\.([a-z0-9]{3,4})$/i);
  return m ? m[1].toLowerCase() : 'mp4';
};

/** "Breaking Bad S02E05" / "Show.1x05" / "Movie (2019)" ko todta hai. */
export function splitName(name) {
  const raw = String(name || '').trim();
  const sxe = raw.match(/^(.*?)[\s._-]*[Ss](\d{1,2})[\s._-]*[Ee](\d{1,3})(.*)$/);
  if (sxe) {
    return {
      series: sxe[1].replace(/[._-]+/g, ' ').trim(),
      season: Number(sxe[2]),
      episode: Number(sxe[3]),
      title: sxe[4].replace(/^[\s._-]+/, '').replace(/[._-]+/g, ' ').trim(),
    };
  }
  const alt = raw.match(/^(.*?)[\s._-]+(\d{1,2})x(\d{1,3})(.*)$/);
  if (alt) {
    return {
      series: alt[1].replace(/[._-]+/g, ' ').trim(),
      season: Number(alt[2]), episode: Number(alt[3]),
      title: alt[4].replace(/^[\s._-]+/, '').replace(/[._-]+/g, ' ').trim(),
    };
  }
  return null;
}

const yearOf = (name) => { const m = String(name).match(/\((19|20)\d{2}\)/); return m ? Number(m[0].slice(1, 5)) : 0; };

export function cleanMovie(input = {}, index = 0) {
  const name = clean(input.name, 120);
  const src = url(input.url);
  if (!name || !src) return null;
  return {
    id: String(input.id || `m${index + 1}`),
    name,
    url: src,
    poster: url(input.poster),
    group: clean(input.group, 40) || 'Movies',
    year: Number(input.year) || yearOf(name),
    rating: Math.min(10, Math.max(0, Number(input.rating) || 0)),
    ext: clean(input.ext, 5) || extOf(src),
    plot: clean(input.plot, 300),
    off: Boolean(input.off),
  };
}

export function cleanSeries(input = {}, index = 0) {
  const name = clean(input.name, 120);
  if (!name) return null;
  const seasonsMap = new Map();
  for (const s of Array.isArray(input.seasons) ? input.seasons : []) {
    const n = Math.max(1, Number(s.n || s.season) || 1);
    const eps = (Array.isArray(s.episodes) ? s.episodes : [])
      .map((e, i) => {
        const src = url(e.url);
        if (!src) return null;
        return { n: Number(e.n || e.episode) || i + 1, title: clean(e.title, 120) || `Episode ${i + 1}`, url: src, ext: clean(e.ext, 5) || extOf(src) };
      })
      .filter(Boolean);
    if (!eps.length) continue;
    const cur = seasonsMap.get(n) || [];
    seasonsMap.set(n, [...cur, ...eps].sort((a, b) => a.n - b.n));
  }
  if (!seasonsMap.size) return null;
  return {
    id: String(input.id || `s${index + 1}`),
    name,
    poster: url(input.poster),
    group: clean(input.group, 40) || 'Series',
    plot: clean(input.plot, 300),
    off: Boolean(input.off),
    seasons: [...seasonsMap.entries()].sort((a, b) => a[0] - b[0]).map(([n, episodes]) => ({ n, episodes })),
  };
}

/** Poore VOD document ko saaf karta hai (duplicate URL/naam hatao, ids do). */
export function cleanVod(input = {}) {
  const seen = new Set();
  const movies = [];
  for (const m of Array.isArray(input.movies) ? input.movies : []) {
    const c = cleanMovie(m, movies.length);
    if (!c || seen.has(c.url)) continue;
    seen.add(c.url);
    movies.push(c);
    if (movies.length >= MAX_MOVIES) break;
  }
  const series = [];
  for (const s of Array.isArray(input.series) ? input.series : []) {
    const c = cleanSeries(s, series.length);
    if (!c) continue;
    series.push(c);
    if (series.length >= MAX_SERIES) break;
  }
  return { movies, series, updatedAt: Number(input.updatedAt) || 0 };
}

/** M3U text se movies + series (S01E02 pattern khud pehchanta hai). */
export function parseVodM3U(text) {
  const lines = String(text || '').split(/\r?\n/);
  const movies = new Map();
  const shows = new Map();
  let meta = null;
  let skipped = 0;

  const attr = (s, k) => { const m = s.match(new RegExp(`${k}="([^"]*)"`, 'i')); return m ? m[1] : ''; };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^#EXTINF/i.test(line)) {
      const comma = line.lastIndexOf(',');
      meta = {
        name: comma > -1 ? line.slice(comma + 1).trim() : '',
        group: attr(line, 'group-title') || '',
        logo: attr(line, 'tvg-logo') || '',
      };
      continue;
    }
    if (line.startsWith('#') || !meta) continue;
    const src = url(line);
    if (!src) { skipped++; meta = null; continue; }

    const parts = splitName(meta.name);
    if (parts && parts.season && parts.episode) {
      const key = parts.series.toLowerCase();
      if (!shows.has(key)) {
        shows.set(key, { name: parts.series, poster: meta.logo, group: meta.group || 'Series', seasons: new Map() });
      }
      const show = shows.get(key);
      const eps = show.seasons.get(parts.season) || [];
      eps.push({ n: parts.episode, title: parts.title || `Episode ${parts.episode}`, url: src });
      show.seasons.set(parts.season, eps);
    } else {
      movies.set(src, {
        name: meta.name, url: src, poster: meta.logo,
        group: meta.group || 'Movies', year: yearOf(meta.name),
      });
    }
    meta = null;
  }

  const series = [...shows.values()].map((s) => ({
    name: s.name, poster: s.poster, group: s.group,
    seasons: [...s.seasons.entries()].map(([n, episodes]) => ({ n, episodes })),
  }));

  return { movies: [...movies.values()], series, skipped };
}

/** Gateway ke liye: episode id aur uski URL. */
export function findVod(vod, kind, id) {
  if (kind === 'movie') {
    const m = (vod.movies || []).find((x) => x.id === String(id) && !x.off);
    return m ? { url: m.url, ext: m.ext, name: m.name } : null;
  }
  const series = (vod.series || []).find((s) => !s.off && (String(id).startsWith(`${s.id}-`) || String(id) === s.id));
  if (!series) return null;
  const rest = String(id).slice(series.id.length + 1);
  const [sn, en] = rest.split('-').map(Number);
  const season = series.seasons.find((s) => s.n === sn);
  if (!season) return null;
  const ep = season.episodes.find((e) => e.n === en);
  return ep ? { url: ep.url, ext: ep.ext, name: `${series.name} S${sn}E${en}` } : null;
}

export const vodStats = (vod = {}) => ({
  movies: (vod.movies || []).length,
  series: (vod.series || []).length,
  episodes: (vod.series || []).reduce((n, s) => n + s.seasons.reduce((m, x) => m + x.episodes.length, 0), 0),
});
