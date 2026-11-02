import { unstable_cache } from 'next/cache';
import { adminDb, adminReady } from '../firebase-admin';
import { quotaTripped } from '../quota';
import { IPTV_CATALOGUE, cleanCatalogue, catalogueGroups } from '../iptvCatalogue';
import { VOD_DOC, cleanVod, findVod } from '../iptvVod';
import { readShardedDoc } from './shards';

// IPTV GATEWAY — hamara apna catalogue (admin jo M3U/manual se daalta hai).
// Yahan koi upstream Xtream panel nahi: channels ki URLs `siteMeta/iptvCatalogue` mein hain,
// movies/series `siteMeta/iptvVod` mein. Dono docs browser ke liye band hain (rules),
// is liye asli stream links sirf server ke paas rehte hain.

export const groupsOf = (channels = []) => {
  const m = new Map();
  for (const c of channels) if (!c.off) m.set(c.group || 'Other', (m.get(c.group || 'Other') || 0) + 1);
  let n = 1;
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ id: String(n++), name, count }));
};

const read = unstable_cache(async () => {
  const empty = { ready: false, channels: [], groups: [], movies: [], series: [], updatedAt: 0 };
  try {
    if (!adminReady() || quotaTripped()) return empty;
    // Bari list shards mein hoti hai — readShardedDoc dono mila kar deta hai.
    const [liveData, vodData] = await Promise.all([
      readShardedDoc(IPTV_CATALOGUE.collection, IPTV_CATALOGUE.id, ['channels']).catch(() => ({})),
      readShardedDoc(VOD_DOC.collection, VOD_DOC.id, ['movies', 'series']).catch(() => ({})),
    ]);

    const live = cleanCatalogue(liveData || {});
    const vod = cleanVod(vodData || {});
    const channels = live.channels.filter((c) => !c.off);

    return {
      ready: channels.length > 0 || vod.movies.length > 0 || vod.series.length > 0,
      channels,
      groups: groupsOf(channels),
      movies: vod.movies.filter((m) => !m.off),
      series: vod.series.filter((s) => !s.off),
      updatedAt: Math.max(Number(live.updatedAt) || 0, Number(vod.updatedAt) || 0),
    };
  } catch (e) {
    console.error('gateway catalogue read failed:', e.message);
    return empty;
  }
}, ['mz-gateway-catalogue-v2'], { revalidate: 60, tags: ['iptv'] });

export const getGatewayCatalogue = () => read();

/** Live channel (id ya naam se). */
export async function findChannel(idOrName) {
  const { channels } = await getGatewayCatalogue();
  const key = String(idOrName || '');
  return channels.find((c) => String(c.id) === key)
    || channels.find((c) => c.name.toLowerCase() === key.toLowerCase())
    || null;
}

/** Movie ya episode (series id: `s1-2-5` = series 1, season 2, episode 5). */
export async function findVodItem(kind, id) {
  const cat = await getGatewayCatalogue();
  return findVod({ movies: cat.movies, series: cat.series }, kind === 'series' ? 'series' : 'movie', id);
}

export { catalogueGroups };
