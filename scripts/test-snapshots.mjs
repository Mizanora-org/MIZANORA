// Run: node --experimental-loader ./scripts/test-snapshot-loader.mjs scripts/test-snapshots.mjs
// Uses a temporary deploy directory and in-memory GitHub/Firestore. No production changes.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cleanSnapshotData, assertNoCredentials, liveSetting, readSetting, remoteSetting, saveArchivedSetting, revisionOf } from '../lib/snapshotStore.js';
import { parseSnapshot, snapshotGet } from '../lib/snapshot.js';
import { POST } from '../app/api/admin/snapshots/route.js';

const realCwd = process.cwd();
const temp = await mkdtemp(join(tmpdir(), 'mz-snap-test-'));
const docs = {
  'siteMeta/theme': { season: 'winter' },
  'siteMeta/movies': { enabled: false, count: 2, actorCount: 0, parts: 1 },
};
const parts = { movies: [{ id: 'p0', data: () => ({ items: [] }) }] };
let reads = 0;
const db = {
  collection(coll) {
    return {
      doc(id) {
        return {
          get: async () => { reads++; const data = docs[`${coll}/${id}`]; return { exists: Boolean(data), data: () => data }; },
          collection(sub) { return { get: async () => { reads++; return { docs: parts[id] || [] }; } }; },
        };
      },
      limit() { return { get: async () => { reads++; return { docs: [], size: 0 }; } }; },
    };
  },
};
globalThis.__snapshotTest = { connected: true, head: 'a'.repeat(40), files: {}, blobs: new Map(), writes: [], db };
const state = globalThis.__snapshotTest;
const call = async (body, admin = true) => {
  const req = new Request('https://test.example/api/admin/snapshots', { method: 'POST',
    headers: { 'content-type': 'application/json', ...(admin ? { authorization: 'Bearer test-admin' } : {}) },
    body: JSON.stringify(body) });
  const response = await POST(req);
  return { status: response.status, body: await response.json() };
};
const deployed = async (kind) => {
  const file = join(temp, 'data', 'snap', `${kind}.json`);
  await mkdir(join(temp, 'data', 'snap'), { recursive: true });
  await writeFile(file, state.files[`data/snap/${kind}.json`], 'utf8');
};
const noWrite = async (b) => {
  const before = state.writes.length;
  const r = await call(b);
  assert.notEqual(r.status, 200, JSON.stringify(b));
  assert.equal(state.writes.length, before, 'failed request must not commit');
  return r;
};

try {
  process.chdir(temp);
  assert.equal((await call({ action: 'status' }, false)).status, 401, 'all actions require verified admin');
  assert.equal((await call({ action: 'read', kind: 'bad' })).status, 400, 'kinds are allowlisted');
  assert.equal((await noWrite({ action: 'capture', kind: 'theme' })).status, 400, 'capture needs explicit public confirmation');
  assert.equal(await snapshotGet('theme'), null, 'no deployed file yet');
  const captured = await call({ action: 'capture', kind: 'theme', confirm: 'PUBLIC' });
  assert.equal(captured.status, 200);
  assert.equal(state.writes.length, 1);
  assert.equal(JSON.parse(state.files['data/snap/theme.json']).data.season, 'winter');
  assert.ok(reads > 0, 'capture reads legacy Firestore once');
  assert.deepEqual(await readSetting('theme'), { data: null, source: 'pending', at: 0 }, 'pending capture must block legacy edits');
  await deployed('theme');
  assert.equal((await readSetting('theme')).source, 'archive', 'deployment activates repo reads');
  assert.equal((await snapshotGet('theme')).data.season, 'winter');
  const beforeVerify = reads;
  const verified = await call({ action: 'verify', kind: 'theme' });
  assert.equal(verified.body.repoMatches, true);
  assert.equal(verified.body.liveMatches, true);
  assert.ok(reads > beforeVerify, 'admin-only verify reads old Firestore source');
  docs['siteMeta/theme'].season = 'summer';
  assert.equal((await call({ action: 'verify', kind: 'theme' })).body.liveMatches, false,
    'verify reports divergence without changing deployed snapshot');
  const lastRead = reads;
  const changed = await call({ action: 'save', kind: 'theme', data: { season: 'spring' } });
  assert.equal(changed.status, 200);
  assert.equal(reads, lastRead, 'archive edit uses zero Firestore reads or writes');
  assert.equal((await snapshotGet('theme')).data.season, 'winter', 'public serves deployed version until next deploy');
  assert.equal((await readSetting('theme')).source, 'pending', 'editor detects repo ahead of deployed copy');
  assert.equal((await call({ action: 'verify', kind: 'theme' })).body.repoMatches, false);
  assert.equal((await noWrite({ action: 'save', kind: 'theme', data: { season: 'autumn' } })).status, 409,
    'second edit cannot overwrite an un-deployed change');
  assert.equal((await noWrite({ action: 'upsert', kind: 'banners', id: 'b1', data: {} })).status, 409);

  // Separate deployed type for concurrent writes: only one can commit at the same head.
  state.files['data/snap/banners.json'] = JSON.stringify({ version: 1, at: Date.now(), data: [
    { id: 'one', data: { image: 'https://cdn.example/a.jpg', title: 'One', link: '/products', active: true } },
  ] });
  await deployed('banners');
  const one = await snapshotGet('banners');
  assert.equal(one.data.length, 1);
  const beforeRace = state.writes.length;
  const results = await Promise.all([
    call({ action: 'upsert', kind: 'banners', id: 'two', data: { image: 'https://cdn.example/b.jpg', title: 'Two' } }),
    call({ action: 'delete', kind: 'banners', id: 'one' }),
  ]);
  assert.deepEqual(results.map((x) => x.status).sort(), [200, 409], 'race cannot silently lose an edit');
  assert.equal(state.writes.length, beforeRace + 1);
  assert.equal((await readSetting('banners')).source, 'pending');
  assert.equal((await noWrite({ action: 'upsert', kind: 'banners', id: 'two', data: { image: 'https://cdn.example/b.jpg' } })).status, 409);

  // Credential scans happen on the cleaned payload before any public commit.
  assert.throws(() => cleanSnapshotData('livetv', { channels: [{ name: 'Private TV', url: 'https://tv.example/live/myuser/mypassword/12345.ts' }] }), /Xtream|credential/i);
  assert.throws(() => cleanSnapshotData('livetv', { channels: [{ name: 'Signed', url: 'https://cdn.example/stream.m3u8?X-Amz-Signature=abc' }] }), /signed|credential/i);
  assert.throws(() => cleanSnapshotData('movie-servers', { servers: [{ name: 'Bad', template: 'https://cdn.example/watch/{imdbid}?token=secret' }] }), /signed|credential/i);
  assert.throws(() => assertNoCredentials({ title: 'Copy https://host.example/media?password=hunter2' }), /credential/i);
  assert.throws(() => assertNoCredentials({ note: 'Bearer: hidden-token' }), /key/i);
  assert.deepEqual(cleanSnapshotData('banners', [{ id: 'one', data: { image: 'https://cdn.example/img.jpg', password: 'no', title: 'Safe' } }])[0],
    { id: 'one', data: { image: 'https://cdn.example/img.jpg', title: 'Safe', subtitle: '', link: '/products', cta: 'Shop now', order: 0, active: true } });
  assert.equal(cleanSnapshotData('reels', [{ id: 'r1', data: { url: 'https://youtube.com/watch?v=abcdefghijk', productSlug: 'a' } }]).length, 1);
  assert.throws(() => cleanSnapshotData('banners', Array.from({ length: 501 }, (_, i) => ({ id: String(i) }))), /500/);

  // A movie archive must not hide an incomplete old database from the admin-only verification.
  state.files['data/snap/movies.json'] = JSON.stringify({ version: 1, at: Date.now(), data: cleanSnapshotData('movies', { enabled: true }) });
  await deployed('movies');
  assert.equal((await snapshotGet('movies')).data.enabled, true);
  await assert.rejects(() => liveSetting('movies'), /shards/i, 'capture/verify must read Firestore shards, not the deployed copy');
  docs['siteMeta/movies'] = { enabled: false, customMovies: [], customActors: [] };
  assert.equal((await liveSetting('movies')).enabled, false, 'live comparison is independent of the deployed movie archive');
  assert.equal(state.writes.length, beforeRace + 1, 'tests never commit or delete real data');

  // A large (10+ MB) channel list is atomically sharded, with each part <1 MB. GitHub
  // verification and the deployed filesystem reader both reject tampered/incomplete parts.
  state.files['data/snap/livetv.json'] = JSON.stringify({ version: 1, at: Date.now(), data: cleanSnapshotData('livetv', { channels: [] }) });
  await deployed('livetv');
  const channels = Array.from({ length: 16000 }, (_, i) => ({ name: `Channel ${i}`, url: `https://cdn.example/${i}/${'x'.repeat(490)}.m3u8` }));
  const large = await saveArchivedSetting('livetv', { enabled: true, channels });
  assert.equal(large.data.channels.length, 16000);
  const manifest = JSON.parse(state.files['data/snap/livetv.json']);
  assert.equal(manifest.version, 2);
  assert.ok(manifest.parts.length > 3);
  assert.equal(manifest.totals.channels, 16000);
  const remote = await remoteSetting('livetv', state.head);
  assert.equal(remote.data.channels.length, 16000);
  assert.equal(revisionOf(remote.data), revisionOf(large.data), 'v2 manifest and original Firestore key order compare equal');
  const localDir = join(temp, 'data', 'snap');
  for (const part of manifest.parts) await writeFile(join(localDir, part.file), state.files[`data/snap/${part.file}`], 'utf8');
  await deployed('livetv');
  const localLoad = (file) => readFile(join(localDir, file), 'utf8');
  const raw = await readFile(join(localDir, 'livetv.json'), 'utf8');
  assert.equal((await parseSnapshot(raw, 'livetv', localLoad)).data.channels.length, 16000);
  const first = manifest.parts[0].file;
  const good = state.files[`data/snap/${first}`];
  await writeFile(join(localDir, first), '[]', 'utf8');
  await assert.rejects(() => parseSnapshot(raw, 'livetv', localLoad), /mismatched/i, 'corrupt deployed part must not be served');
  await writeFile(join(localDir, first), good, 'utf8');
  delete state.files[`data/snap/${first}`];
  await assert.rejects(() => remoteSetting('livetv', state.head), /parts is invalid/i, 'missing repo part must block further edits');
  console.log('Snapshot integration: auth, capture, deploy, verify, pending, races, movie guard, 16k-channel shards and corrupt-part guard OK.');
} finally {
  process.chdir(realCwd);
  await rm(temp, { recursive: true, force: true });
}
