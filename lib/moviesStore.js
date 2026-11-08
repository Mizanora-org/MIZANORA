import {
  MOVIES_DEFAULT,
  MOVIES_DOC,
  MOVIES_PART,
  MOVIES_SECRET_DOC,
  cleanActor,
  cleanMovie,
  cleanMoviesConfig,
} from './movies.js';
import { snapshotGet } from './snapshot.js';
import { ensureNoPendingCapture, saveArchivedSetting } from './snapshotStore.js';

const estBytes = (obj) => {
  if (!obj) return 0;
  try {
    return JSON.stringify(obj).length * 2 + 64;
  } catch {
    return 1500;
  }
};

export function packMovieItems(items = [], prefix = MOVIES_PART.moviePrefix, part = MOVIES_PART) {
  const parts = [];
  let cur = [];
  let bytes = 0;
  for (const item of items || []) {
    const b = estBytes(item);
    if (cur.length && (cur.length >= part.perPart || bytes + b > part.maxBytes)) {
      parts.push(cur);
      cur = [];
      bytes = 0;
    }
    cur.push(item);
    bytes += b;
  }
  if (cur.length) parts.push(cur);
  return parts.map((rows, i) => ({ id: `${prefix}${i}`, n: rows.length, items: rows }));
}

export const moviesConfigRef = (db) => db.collection(MOVIES_DOC.collection).doc(MOVIES_DOC.id);
export const moviesPartsRef = (db) => moviesConfigRef(db).collection(MOVIES_PART.sub);
export const moviesSecretRef = (db) => db.collection(MOVIES_SECRET_DOC.collection).doc(MOVIES_SECRET_DOC.id);

const sortPartDocs = (docs, prefix) =>
  (docs || [])
    .map((d) => ({ id: d.id, data: d.data() }))
    .filter((x) => x.id.startsWith(prefix) && x.data && Array.isArray(x.data.items))
    .sort((a, b) => (Number(a.id.slice(prefix.length)) || 0) - (Number(b.id.slice(prefix.length)) || 0));

export async function readMoviesAll(db, { ignoreSnapshot = false } = {}) {
  const archived = ignoreSnapshot ? null : await snapshotGet('movies');
  if (archived) return cleanMoviesConfig(archived.data);
  const snap = await moviesConfigRef(db).get();
  const raw = snap && snap.data ? snap.data() : null;
  if (!raw) return cleanMoviesConfig(MOVIES_DEFAULT);

  // Legacy single-document storage: inline customMovies / customActors array
  if (Array.isArray(raw.customMovies) || Array.isArray(raw.customActors)) {
    return cleanMoviesConfig({ ...MOVIES_DEFAULT, ...raw });
  }

  const ps = await moviesPartsRef(db).get();
  const movieParts = sortPartDocs(ps.docs, MOVIES_PART.moviePrefix);
  const actorParts = sortPartDocs(ps.docs, MOVIES_PART.actorPrefix);

  const customMovies = [];
  const seenM = new Set();
  for (const p of movieParts) {
    for (const item of p.data.items) {
      const m = cleanMovie(item);
      if (!m || seenM.has(m.slug)) continue;
      seenM.add(m.slug);
      customMovies.push(m);
    }
  }

  const customActors = [];
  const seenA = new Set();
  for (const p of actorParts) {
    for (const item of p.data.items) {
      const a = cleanActor(item);
      if (!a || seenA.has(a.slug)) continue;
      seenA.add(a.slug);
      customActors.push(a);
    }
  }

  // Never mistake a partial shard read for a complete catalogue during capture/edit.
  if (Number(raw.count) > customMovies.length || Number(raw.actorCount) > customActors.length
    || Number(raw.parts) > movieParts.length + actorParts.length) {
    throw new Error('Movie shards did not all load. Refusing a partial read/capture.');
  }
  return cleanMoviesConfig({
    ...MOVIES_DEFAULT,
    ...raw,
    customMovies,
    customActors,
  });
}

export async function writeMoviesAll(db, cfg) {
  const clean = cleanMoviesConfig(cfg || {});
  if (await snapshotGet('movies')) {
    const saved = await saveArchivedSetting('movies', clean);
    return { cfg: clean, parts: 0, removed: 0, source: 'archive', commit: saved.commit };
  }
  await ensureNoPendingCapture('movies');
  const mParts = packMovieItems(clean.customMovies, MOVIES_PART.moviePrefix);
  const aParts = packMovieItems(clean.customActors, MOVIES_PART.actorPrefix);
  const allParts = [
    ...mParts.map((p) => ({ id: p.id, kind: 'movies', n: p.n, items: p.items })),
    ...aParts.map((p) => ({ id: p.id, kind: 'actors', n: p.n, items: p.items })),
  ];

  const batchLimit = 20;
  const ps = await moviesPartsRef(db).get();

  for (let i = 0; i < allParts.length; i += batchLimit) {
    const b = db.batch();
    for (const p of allParts.slice(i, i + batchLimit)) {
      b.set(moviesPartsRef(db).doc(p.id), { kind: p.kind, n: p.n, items: p.items });
    }
    await b.commit();
  }

  const liveIds = new Set(allParts.map((p) => p.id));
  const stale = (ps.docs || []).map((d) => d.id).filter((id) => !liveIds.has(id));
  for (let i = 0; i < stale.length; i += batchLimit) {
    const b = db.batch();
    for (const id of stale.slice(i, i + batchLimit)) b.delete(moviesPartsRef(db).doc(id));
    await b.commit();
  }

  const metaDoc = {
    enabled: clean.enabled,
    title: clean.title,
    note: clean.note,
    ads: clean.ads,
    autoSync: clean.autoSync,
    lastAutoSyncAt: clean.lastAutoSyncAt || Date.now(),
    count: clean.customMovies.length,
    actorCount: clean.customActors.length,
    parts: allParts.length,
    updatedAt: Date.now(),
  };
  await moviesConfigRef(db).set(metaDoc);

  return {
    cfg: clean,
    parts: allParts.length,
    removed: stale.length,
    source: 'firestore',
  };
}

export async function readMoviesSecrets(db) {
  try {
    const snap = await moviesSecretRef(db).get();
    const d = snap && snap.data ? snap.data() : null;
    return {
      tmdbApiKey: d && typeof d.tmdbApiKey === 'string' ? d.tmdbApiKey.trim() : '',
    };
  } catch {
    return { tmdbApiKey: '' };
  }
}

export async function writeMoviesSecrets(db, { tmdbApiKey = '' } = {}) {
  const cleanKey = String(tmdbApiKey || '').trim().slice(0, 320);
  await moviesSecretRef(db).set({ tmdbApiKey: cleanKey, updatedAt: Date.now() }, { merge: true });
  return { tmdbApiKey: cleanKey };
}
