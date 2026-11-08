import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Deployed files: public requests never contact Firestore or GitHub for an archived setting.
// Small settings are one JSON file; large TV/movie catalogues use a manifest + verified parts.
export const SNAPSHOT_TYPES = Object.freeze({
  livetv: { label: 'Live TV + channels', firestore: 'siteMeta/liveTv + channels' },
  movies: { label: 'Custom movies + actors', firestore: 'siteMeta/movies + parts' },
  'movie-servers': { label: 'Movie play servers', firestore: 'siteMeta/movieServers' },
  deals: { label: 'Deals page settings', firestore: 'siteMeta/deals' },
  'app-music': { label: 'App music', firestore: 'siteMeta/appMusic' },
  'reel-music': { label: 'Reels music', firestore: 'siteMeta/reelMusic' },
  theme: { label: 'Season theme', firestore: 'siteMeta/theme' },
  banners: { label: 'Shop banners', firestore: 'banners/*' },
  reels: { label: 'Curated reels', firestore: 'reels/*' },
});
export const snapshotPath = (kind) => {
  if (!Object.hasOwn(SNAPSHOT_TYPES, kind)) throw new Error('Unknown archive setting.');
  return `data/snap/${kind}.json`;
};
const hash = (value) => createHash('sha256').update(value).digest('hex');
const keysFor = (kind) => kind === 'livetv' ? ['channels'] : kind === 'movies' ? ['customMovies', 'customActors'] : [];

// Used by BOTH local deployed-file reads and admin-only GitHub verification. Every part is
// checked against the manifest's hash + count; a missing/truncated part cannot silently turn a
// 100,000-channel list into an empty/partial archive.
export async function parseSnapshot(raw, kind, loadPart) {
  if (!Object.hasOwn(SNAPSHOT_TYPES, kind)) throw new Error('Unknown archive setting');
  const j = JSON.parse(raw);
  if (!j || !Number.isFinite(j.at) || !j.data || typeof j.data !== 'object') throw new Error('Invalid archive manifest');
  if (j.version === 1) return { version: 1, at: j.at, data: j.data };
  const keys = keysFor(kind);
  if (j.version !== 2 || !keys.length || !Array.isArray(j.parts) || !j.parts.length || j.parts.length > 80
    || !j.totals || typeof j.totals !== 'object') throw new Error('Invalid archive parts manifest');
  const data = { ...j.data };
  for (const k of keys) {
    if (Object.hasOwn(data, k) || !Number.isInteger(j.totals[k]) || j.totals[k] < 0) throw new Error('Invalid archive counts');
    data[k] = [];
  }
  for (let i = 0; i < j.parts.length; i++) {
    const part = j.parts[i];
    if (!part || !keys.includes(part.key) || part.file !== `${kind}-p${String(i).padStart(4, '0')}.json`
      || !/^[a-f0-9]{64}$/.test(part.hash) || !Number.isInteger(part.count) || part.count < 1) throw new Error('Invalid archive part reference');
    const body = await loadPart(part.file);
    if (typeof body !== 'string' || Buffer.byteLength(body, 'utf8') > 1_000_000 || hash(body) !== part.hash) throw new Error('Archive part missing or mismatched');
    const rows = JSON.parse(body);
    if (!Array.isArray(rows) || rows.length !== part.count) throw new Error('Archive part count mismatch');
    data[part.key].push(...rows);
  }
  for (const k of keys) if (data[k].length !== j.totals[k]) throw new Error('Archive total does not match its parts');
  return { version: 2, at: j.at, data };
}

const memo = new Map();
export async function snapshotGet(kind) {
  if (!Object.hasOwn(SNAPSHOT_TYPES, kind)) return null;
  if (!memo.has(kind)) {
    const promise = fs.readFile(path.join(process.cwd(), snapshotPath(kind)), 'utf8')
      .then((raw) => parseSnapshot(raw, kind, (file) => fs.readFile(path.join(process.cwd(), 'data/snap', file), 'utf8')))
      .catch((e) => {
        memo.delete(kind); // a newly deployed/created file may become available later
        if (e.code !== 'ENOENT') console.error('archive setting unreadable:', kind, e.message);
        return null; // never serve a partial snapshot
      });
    memo.set(kind, promise);
  }
  return memo.get(kind);
}

export async function snapshotList() {
  return Promise.all(Object.entries(SNAPSHOT_TYPES).map(async ([kind, info]) => {
    const s = await snapshotGet(kind);
    return { kind, ...info, deployed: Boolean(s), at: s?.at || 0, parts: s?.version === 2 ? 'sharded' : '' };
  }));
}
