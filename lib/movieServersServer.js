// Mizanora v51 — server-side reader/writer for the admin Play Servers list.
// Small document (max 40 servers), cached with a tag so the admin save shows up at once.

import { unstable_cache } from 'next/cache';
import { adminDb, adminReady } from './firebase-admin';
import { quotaTripped } from './quota';
import { snapshotGet } from './snapshot';
import { ensureNoPendingCapture, saveArchivedSetting } from './snapshotStore';
import {
  MOVIE_SERVERS_DEFAULT,
  MOVIE_SERVERS_DOC,
  cleanMoviesServersConfig,
  resolveMovieServers,
} from './movieServers';

const ref = (db) => db.collection(MOVIE_SERVERS_DOC.collection).doc(MOVIE_SERVERS_DOC.id);

export async function readMovieServers() {
  try {
    const archived = await snapshotGet('movie-servers');
    if (archived) return cleanMoviesServersConfig(archived.data);
    if (!adminReady() || quotaTripped()) return { ...MOVIE_SERVERS_DEFAULT };
    const snap = await ref(adminDb()).get();
    const raw = snap && snap.data ? snap.data() : null;
    if (!raw) return { ...MOVIE_SERVERS_DEFAULT };
    return cleanMoviesServersConfig(raw);
  } catch (e) {
    console.error('movie servers read failed:', e.message);
    return { ...MOVIE_SERVERS_DEFAULT };
  }
}

export const getMovieServers = unstable_cache(
  async () => readMovieServers(),
  ['mz-movie-servers-v51'],
  { revalidate: 86400, tags: ['movie-servers'] },
);

export async function saveMovieServers(cfg = {}) {
  const clean = cleanMoviesServersConfig({ ...cfg, updatedAt: Date.now() });
  try {
    if (await snapshotGet('movie-servers')) {
      const saved = await saveArchivedSetting('movie-servers', clean);
      return { ok: true, cfg: clean, source: 'archive', commit: saved.commit };
    }
    await ensureNoPendingCapture('movie-servers');
    if (!adminReady()) return { ok: false, status: 503, error: 'Firestore Admin is not configured on the server yet.', cfg: clean };
    await ref(adminDb()).set(clean, { merge: false });
    return { ok: true, cfg: clean, source: 'firestore' };
  } catch (e) {
    console.error('movie servers save failed:', e.message);
    return { ok: false, status: e.status || 500, error: e.status ? e.message : 'Could not save the play servers.', cfg: clean };
  }
}

// Everything the player needs for one title, with the URLs already built.
export async function getServersForTitle(info = {}) {
  const cfg = await getMovieServers();
  if (!cfg || cfg.enabled === false) {
    return { servers: [], ads: cfg ? cfg.ads : MOVIE_SERVERS_DEFAULT.ads, enabled: false };
  }
  return {
    servers: resolveMovieServers(cfg.servers, info),
    ads: cfg.ads,
    enabled: true,
  };
}
