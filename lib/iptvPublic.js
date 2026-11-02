import { getGatewayCatalogue } from './gateway/catalogue';

// PUBLIC IPTV PAGES ke liye data.
// Yahan asli stream URL kabhi nahi jata — sirf woh cheezein jo customer ko dikh sakti hain.
const safeMovie = (m) => ({
  id: m.id, name: m.name, poster: m.poster || '', year: m.year || 0, rating: m.rating || 0,
  group: m.group || 'Movies', plot: m.plot || '', genres: m.genres || [], cast: m.cast || '',
  director: m.director || '', runtime: m.runtime || '', imdbId: m.imdbId || '', ext: m.ext || 'mp4',
});

const safeSeries = (s) => ({
  id: s.id, name: s.name, poster: s.poster || '', group: s.group || 'Series', plot: s.plot || '',
  genres: s.genres || [], imdbId: s.imdbId || '', seasons: s.seasons.length,
  episodes: s.seasons.reduce((n, x) => n + x.episodes.length, 0),
  seasonList: s.seasons.map((x) => ({ n: x.n, episodes: x.episodes.map((e) => ({ n: e.n, title: e.title || '' })) })),
});

export async function getPublicLibrary() {
  try {
    const cat = await getGatewayCatalogue();
    const movies = (cat.movies || []).map(safeMovie);
    const series = (cat.series || []).map(safeSeries);
    return {
      ready: Boolean(cat.ready),
      updatedAt: Number(cat.updatedAt) || 0,
      movies,
      series,
      channels: (cat.channels || []).map((c) => ({ id: c.id, name: c.name, group: c.group, logo: c.logo || '' })),
      groups: {
        movies: cat.groups?.movies || groupCount(movies),
        series: groupCount(series),
      },
    };
  } catch {
    return { ready: false, updatedAt: 0, movies: [], series: [], channels: [], groups: { movies: [], series: [] } };
  }
}

function groupCount(list) {
  const m = new Map();
  for (const x of list) m.set(x.group || 'Other', (m.get(x.group || 'Other') || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
}

export const findPublicMovie = async (id) => (await getPublicLibrary()).movies.find((m) => String(m.id) === String(id)) || null;
export const findPublicSeries = async (id) => (await getPublicLibrary()).series.find((s) => String(s.id) === String(id)) || null;

/** Public counters (status page ke liye). */
export async function getPublicStats() {
  const lib = await getPublicLibrary();
  return {
    ready: lib.ready,
    updatedAt: lib.updatedAt,
    channels: lib.channels.length,
    groups: new Set(lib.channels.map((c) => c.group)).size,
    movies: lib.movies.length,
    series: lib.series.length,
    episodes: lib.series.reduce((n, s) => n + s.episodes, 0),
  };
}
