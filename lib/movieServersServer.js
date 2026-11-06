// Mizanora v51 — server-side reader/writer for the admin Play Servers list.
// Small document (max 40 servers), cached with a tag so the admin save shows up at once.

import { unstable_cache } from 'next/cache';
import { adminDb, adminReady } from './firebase-admin';
import { quotaTripped } from './quota';
import {
  MOVIE_SERVERS_DEFAULT,
  MOVIE_SERVERS_DOC,
  cleanMoviesServersConfig,
  resolveMovieServers,
} from './movieServers';

const ref = (db) => db.collection(MOVIE_SERVERS_DOC.collection).doc(MOVIE_SERVERS_DOC.id);

export async function readMovieServers() {
  try {
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
  { revalidate: 300, tags: ['movie-servers'] },
);

export async function saveMovieServers(cfg = {}) {
  const clean = cleanMoviesServersConfig({ ...cfg, updatedAt: Date.now() });
  if (!adminReady()) {
    return { ok: false, error: 'Firestore Admin is not configured on the server yet.', cfg: clean };
  }
  try {
    await ref(adminDb()).set(clean, { merge: false });
    return { ok: true, cfg: clean };
  } catch (e) {
    console.error('movie servers save failed:', e.message);
    return { ok: false, error: 'Could not save the play servers to Firestore.', cfg: clean };
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
