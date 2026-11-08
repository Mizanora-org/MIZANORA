import { createHash } from 'node:crypto';
import { parseSnapshot, snapshotGet, snapshotPath, SNAPSHOT_TYPES } from './snapshot.js';
import { ghBlob, ghCommit, ghHead, ghInfo, ghReadFile, ghReady } from './github.js';
import { adminDb, adminReady } from './firebase-admin.js';
import { cleanTv } from './liveTv.js';
import { readTvAll } from './liveTvStore.js';
import { cleanMoviesConfig } from './movies.js';
import { readMoviesAll } from './moviesStore.js';
import { cleanMoviesServersConfig } from './movieServers.js';
import { cleanDeals } from './deals.js';
import { cleanAppMusic } from './appMusic.js';
import { cleanReelMusic } from './reelMusic.js';
import { SEASON_MODES } from './season.js';

// PUBLIC DATA ONLY. This GitHub repository is public. Never put orders, users, coupons, ad keys,
// stream keys, credentials, private videos, KYC, API keys, analytics or security logs in it.
// Snapshots are activated ONLY after the deployment contains the file; after that every admin edit
// to these settings goes to GitHub (one commit), not to Firestore. Pending commits block stale edits.
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_SHARDED_BYTES = 64 * 1024 * 1024;
const PART_BYTES = 900_000; // GitHub Contents API's 1 MB read limit

const configDocs = {
  'movie-servers': 'movieServers', deals: 'deals', 'app-music': 'appMusic', 'reel-music': 'reelMusic', theme: 'theme',
};
export const ARCHIVABLE_KINDS = Object.keys(SNAPSHOT_TYPES);

const text = (s, n = 160) => String(s || '').replace(/[<>]/g, '').trim().slice(0, n);
const url = (s) => {
  const v = text(s, 2000);
  if (!v) return '';
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && !u.username && !u.password ? u.href : '';
  } catch { return ''; }
};
const link = (s) => {
  const v = text(s, 600);
  return /^\/(?!\/)[\w./?%=&+~#-]*$/.test(v) ? v : url(v);
};
const tidyList = (rows, kind) => {
  if (!Array.isArray(rows) || rows.length > 500) throw new Error(`At most 500 ${kind} can be archived in one file.`);
  return rows.map((r) => {
    const id = String(r?.id || '').slice(0, 120);
    if (!/^[^/\\.][^/\\]{0,119}$/.test(id)) throw new Error(`Invalid ${kind} ID.`);
    const d = r.data || r;
    if (kind === 'banners') {
      const image = url(d.image);
      if (!image) throw new Error(`Banner ${id} has no safe HTTPS image. Nothing was archived.`);
      return { id, data: { image, title: text(d.title), subtitle: text(d.subtitle, 250), link: link(d.link) || '/products', cta: text(d.cta, 60) || 'Shop now', order: Number(d.order) || 0, active: d.active !== false } };
    }
    const media = url(d.url);
    if (!media) throw new Error(`Reel ${id} has no safe HTTPS video. Nothing was archived.`);
    return { id, data: { url: media, title: text(d.title), productSlug: text(d.productSlug, 120), link: link(d.link), order: Number(d.order) || 0, active: d.active !== false } };
  });
};

export function cleanSnapshotData(kind, input) {
  if (!Object.hasOwn(SNAPSHOT_TYPES, kind)) throw new Error('This setting cannot be archived.');
  let value;
  switch (kind) {
    case 'livetv': value = cleanTv(input); break;
    case 'movies': value = cleanMoviesConfig(input); break; // excludes adminSecrets/movies (TMDB API key)
    case 'movie-servers': value = cleanMoviesServersConfig(input); break;
    case 'deals': value = cleanDeals(input); break;
    case 'app-music': {
      const r = cleanAppMusic(input); if (!r.ok) throw new Error(r.error); value = r.value; break;
    }
    case 'reel-music': {
      const r = cleanReelMusic(input); if (!r.ok) throw new Error(r.error); value = r.value; break;
    }
    case 'theme': value = { season: SEASON_MODES.includes(input?.season) ? input.season : 'auto' }; break;
    case 'banners': case 'reels': value = tidyList(input, kind); break;
    default: throw new Error('Unknown setting.');
  }
  const payload = JSON.stringify(value);
  const size = Buffer.byteLength(payload, 'utf8');
  if (size > (['livetv', 'movies'].includes(kind) ? MAX_SHARDED_BYTES : MAX_BYTES)) error('Archive exceeds the safe 64 MB total limit (8 MB for a single setting). Keep this large catalogue in the existing sharded database. Nothing was changed.', 413);
  assertNoCredentials(value);
  return value;
}

// A PUBLIC repository remembers all committed versions forever. Refuse plausible credential-bearing
// fields and URL query/path secrets *even if* they came from an already-public Firestore document.
export function assertNoCredentials(value) {
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== 'object') {
      if (typeof v === 'string') {
        // URLs can also be pasted inside labels/notes, not just saved as a dedicated url field.
        const links = v.match(/https?:\/\/[^\s<>"']+/gi) || [];
        for (const raw of links) {
          let u; try { u = new URL(raw); } catch { continue; }
          if (u.username || u.password) throw new Error('A link contains login credentials. It cannot go into a public repository.');
          if ([...u.searchParams.keys()].some((k) => /^(?:token|key|api[_-]?key|access[_-]?token|password|passwd|pass|user|username|auth(?:orization)?|signature|sig|session|jwt|secret|hash|expires?|exp|hdnea|hdnts|policy|key-pair-id|awsaccesskeyid|x-amz-.*|x-goog-.*|__gda__|st)$/i.test(k))) {
            throw new Error('A link contains a signed URL or access credential. Remove it before archiving.');
          }
          // Xtream panel paths carry username/password even without a ?query.
          if (/\/(?:live|movie|series)\/[^/?]+\/[^/?]+\/\d+\b/i.test(u.pathname)) {
            throw new Error('An Xtream/panel link contains account credentials. It cannot go into public GitHub.');
          }
        }
        if (/\b(?:password|api[_-]?key|private[_-]?key|bearer)\s*[:=]\s*\S+/i.test(v)) {
          throw new Error('Text contains a possible password or API key. Nothing was archived.');
        }
      }
      return;
    }
    for (const [k, x] of Object.entries(v)) {
      if (/^(?:password|passwd|secret|api[_-]?key|access[_-]?token|stream[_-]?key|authorization|cnic|private[_-]?key)$/i.test(k) && x) {
        throw new Error('A private credential or personal identifier was found. Never archive secrets in a public repo.');
      }
      walk(x);
    }
  };
  walk(value);
}

const error = (message, status = 409) => { const e = new Error(message); e.status = status; throw e; };
// Ignore object-key insertion order: v2 manifests move large arrays into verified parts,
// but a logically identical old Firestore document must still compare equal in Verify.
export const revisionOf = (data) => createHash('sha256').update(JSON.stringify(data, (_key, value) => {
  if (!value || Array.isArray(value) || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, value[key]]));
})).digest('hex');

export async function remoteSetting(kind, head) {
  const raw = await ghReadFile(snapshotPath(kind), head);
  if (raw === null) return null;
  try {
    return await parseSnapshot(raw, kind, async (file) => ghReadFile(`data/snap/${file}`, head));
  } catch {
    error('The repository archive or one of its parts is invalid; repair it before editing.', 409);
  }
}

async function repoState(kind) {
  const head = await ghHead();
  const remote = await remoteSetting(kind, head);
  return { head, remote };
}

export async function liveSetting(kind) {
  if (!adminReady()) error('Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT to capture old data.', 503);
  const db = adminDb();
  if (kind === 'livetv') {
    const { config, channels } = await readTvAll(db);
    if (!config) error('Live TV was never configured; there is no data to capture.', 404);
    if (Number(config.count) > channels.length) error('Some Live TV shards did not load. Refusing a partial capture.', 409);
    return cleanSnapshotData(kind, { ...config, channels });
  }
  if (kind === 'movies') {
    const d = await db.collection('siteMeta').doc('movies').get();
    if (!d.exists) error('No saved movie hub to capture.', 404);
    return cleanSnapshotData(kind, await readMoviesAll(db, { ignoreSnapshot: true }));
  }
  if (kind === 'banners' || kind === 'reels') {
    const snap = await db.collection(kind).limit(501).get();
    if (snap.size > 500) error(`There are more than 500 ${kind}. Nothing was captured.`, 413);
    return cleanSnapshotData(kind, snap.docs.map((d) => ({ id: d.id, data: d.data() })));
  }
  const id = configDocs[kind];
  if (!id) error('Unknown setting.', 400);
  const d = await db.collection('siteMeta').doc(id).get();
  if (!d.exists) error('This setting has never been saved. Nothing to capture.', 404);
  return cleanSnapshotData(kind, d.data());
}

export async function readSetting(kind) {
  const s = await snapshotGet(kind);
  if (s) {
    // Admin editors must not load a deployed copy that is already behind a GitHub commit.
    if (ghReady()) {
      const { remote } = await repoState(kind);
      if (!remote || revisionOf(remote.data) !== revisionOf(s.data)) {
        return { data: cleanSnapshotData(kind, s.data), source: 'pending', at: s.at };
      }
    }
    return { data: cleanSnapshotData(kind, s.data), source: 'archive', at: s.at };
  }
  // Admin-only check: a GitHub commit in flight MUST NOT be hidden by an older Firestore form.
  if (ghReady() && (await repoState(kind)).remote) return { data: null, source: 'pending', at: 0 };
  if (!adminReady()) return { data: null, source: 'none', at: 0 };
  return { data: await liveSetting(kind).catch((e) => { if (e.status === 404) return null; throw e; }), source: 'firestore', at: 0 };
}

const notify = () => ghInfo().branch;

// Commit the cleaned public payload to the deployment branch; never write the current server's
// filesystem (on Vercel it is read-only). Concurrency is guarded by the exact Git head + revision.
// Deterministic part names, explicit counts and SHA-256 digests. Everything is committed in ONE
// atomic Git tree update. A failed upload/conflicting head never activates a partial catalogue.
function partDocuments(kind, clean) {
  const keys = kind === 'livetv' ? ['channels'] : ['customMovies', 'customActors'];
  const { channels, customMovies, customActors, ...metadata } = clean;
  const parts = [], payloads = [], totals = {};
  for (const key of keys) {
    const rows = clean[key] || [];
    totals[key] = rows.length;
    let pack = [], used = 2;
    const flush = () => {
      if (!pack.length) return;
      const body = `[${pack.join(',')}]`;
      const file = `${kind}-p${String(parts.length).padStart(4, '0')}.json`;
      parts.push({ file, key, count: pack.length, hash: createHash('sha256').update(body).digest('hex') });
      payloads.push(body);
      pack = []; used = 2;
    };
    for (const row of rows) {
      const encoded = JSON.stringify(row);
      const bytes = Buffer.byteLength(encoded, 'utf8') + 1;
      if (bytes > PART_BYTES - 2) error(`One ${key} entry is too large to archive safely.`, 413);
      if (pack.length && used + bytes > PART_BYTES) flush();
      pack.push(encoded); used += bytes;
    }
    flush();
  }
  if (parts.length > 80) error('This catalogue needs more than 80 archive parts. Keep the largest lists in Firestore.', 413);
  return { parts, payloads, totals, metadata };
}

async function commit(kind, clean, message, state) {
  const { head, remote } = state || await repoState(kind);
  const at = Date.now();
  const large = (kind === 'livetv' || kind === 'movies') && Buffer.byteLength(JSON.stringify(clean), 'utf8') > MAX_BYTES;
  let obj, files = [];
  if (large) {
    const { parts, payloads, totals, metadata } = partDocuments(kind, clean);
    obj = { version: 2, at, data: metadata, parts, totals };
    // Limit concurrent GitHub API calls; even for 100k channels the commit is all-or-nothing.
    for (let i = 0; i < parts.length; i += 4) {
      const group = await Promise.all(parts.slice(i, i + 4).map(async (part, idx) => ({
        path: `data/snap/${part.file}`, sha: await ghBlob(payloads[i + idx]),
      })));
      files.push(...group);
    }
  } else {
    obj = { version: 1, at, data: clean };
  }
  files.push({ path: snapshotPath(kind), sha: await ghBlob(JSON.stringify(obj)) });
  const commitSha = await ghCommit(files, message, head);
  return { kind, count: Array.isArray(clean) ? clean.length : Array.isArray(clean.channels) ? clean.channels.length : Array.isArray(clean.customMovies) ? clean.customMovies.length : undefined,
    parts: obj.version === 2 ? obj.parts.length : 0, commit: commitSha, branch: notify(), at, previous: remote?.at || 0 };
}

export async function captureSetting(kind, confirm) {
  if (!Object.hasOwn(SNAPSHOT_TYPES, kind)) error('Unknown setting.', 400);
  if (confirm !== 'PUBLIC') error('Type PUBLIC to confirm that this setting (including public channel/stream links) will be visible FOREVER in the public GitHub history. Never archive secrets.', 400);
  if (!ghReady()) error('Connect GITHUB_TOKEN + GITHUB_REPO to capture public settings as repo files.', 503);
  if (await snapshotGet(kind)) error('Already deployed. Use its editor to change the archive; capturing old Firestore data would overwrite newer edits.', 409);
  const state = await repoState(kind);
  if (state.remote) error('A capture is already committed. Wait for the deployment; nothing was overwritten.', 409);
  const value = await liveSetting(kind);
  return commit(kind, value, `Archive public ${kind} settings (no Firestore reads after deploy)`, state);
}

export async function saveArchivedSetting(kind, data) {
  if (!Object.hasOwn(SNAPSHOT_TYPES, kind)) error('Unknown setting.', 400);
  const deployed = await snapshotGet(kind);
  if (!deployed) error('This setting has not been deployed as a snapshot yet. Use the existing editor.', 409);
  if (!ghReady()) error('GitHub is not connected; the archive is read-only. Restore GITHUB_TOKEN to edit.', 503);
  const clean = cleanSnapshotData(kind, data);
  const state = await repoState(kind);
  if (!state.remote || revisionOf(state.remote.data) !== revisionOf(deployed.data)) {
    error('The repository setting is newer/different from this deployment. Wait for the latest deploy and reload before editing; no data was overwritten.', 409);
  }
  const result = await commit(kind, clean, `Update public ${kind} settings`, state);
  return { ...result, data: clean, source: 'archive' };
}

// When a file was committed but not yet deployed, DO NOT write a stale Firestore config that
// would be ignored the moment the new deployment comes up.
export async function ensureNoPendingCapture(kind) {
  if (!ghReady() || await snapshotGet(kind)) return;
  if ((await repoState(kind)).remote) error('An archive capture is committed but not deployed yet. Wait for the deploy before editing.', 409);
}
