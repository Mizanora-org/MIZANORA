// Exercises the real date-range API with a fake admin and an in-memory GitHub repository.
// This intentionally performs no network calls and cannot write to a real repository.
import assert from 'node:assert/strict';
import { cardRow } from '../lib/archiveFormat.js';
import { POST } from '../app/api/admin/archive-range/route.js';

const inRange = Date.parse('2026-04-10T12:00:00Z');
const outside = Date.parse('2026-05-10T12:00:00Z');
const first = [
  { id: 'match', name: 'Older version', createdAt: inRange, part: 'real product field' },
  { id: 'keep', name: 'Keep', createdAt: outside },
  { id: 'hidden', name: 'Hidden', createdAt: inRange, active: false },
  { id: 'undated', name: 'Undated', createdAt: 0 },
  { id: 'moved', name: 'Old in range', createdAt: inRange },
];
const second = [
  { id: 'match', name: 'Newest version', createdAt: inRange, part: 'preserve in export' },
  { id: 'moved', name: 'New outside range', createdAt: outside },
];
const meta = (n, rows) => ({ n, file: `part-000${n}.json`, cards: `cards-000${n}.json`, count: rows.length, at: 1 });
const original = {
  'data/catalog/manifest.json': JSON.stringify({ version: 1, parts: [meta(1, first), meta(2, second)], total: first.length + second.length }),
  'data/catalog/part-0001.json': JSON.stringify(first),
  'data/catalog/cards-0001.json': JSON.stringify(first.map(cardRow)),
  'data/catalog/part-0002.json': JSON.stringify(second),
  'data/catalog/cards-0002.json': JSON.stringify(second.map(cardRow)),
};
const reset = () => { globalThis.__rangeTest = { connected: true, head: 'a'.repeat(40), files: { ...original }, readRefs: [], blobs: new Map(), writes: [] }; };
const call = async (body, authorized = true) => {
  const request = new Request('http://localhost/api/admin/archive-range', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authorized ? { Authorization: 'Bearer test-admin' } : {}) }, body: JSON.stringify(body) });
  const response = await POST(request); return { status: response.status, body: await response.json() };
};
const range = { from: '2026-04-10', to: '2026-04-10' };
const expectedError = async (body) => {
  const old = console.error; console.error = () => {};
  try { return await call(body); } finally { console.error = old; }
};
reset();
assert.equal((await call({ action: 'preview', ...range }, false)).status, 401);
const preview = await call({ action: 'preview', ...range });
assert.equal(preview.status, 200);
assert.equal(preview.body.count, 2); assert.equal(preview.body.undated, 1); assert.equal(preview.body.total, 5);
assert.deepEqual(preview.body.parts, [2, 1]);
assert.ok(preview.body.sample.some((x) => x.id === 'hidden' && x.hidden));
assert.ok(globalThis.__rangeTest.readRefs.every((x) => x === preview.body.ref));
const part = await call({ action: 'part', ref: preview.body.ref, n: 2 });
assert.equal(part.status, 200); assert.equal(part.body.rows[0].part, 'preserve in export');
const request = { action: 'delete', ...range, ref: preview.body.ref, count: preview.body.count, digest: preview.body.digest, confirm: 'DELETE 2' };
assert.equal((await call({ ...request, confirm: 'DELETE' })).status, 400);
globalThis.__rangeTest.head = 'b'.repeat(40);
assert.equal((await call(request)).status, 409);
assert.equal(globalThis.__rangeTest.writes.length, 0);
globalThis.__rangeTest.head = preview.body.ref;
assert.equal((await call({ ...request, digest: 'wrong' })).status, 409);
assert.equal(globalThis.__rangeTest.writes.length, 0);
globalThis.__rangeTest.files['data/catalog/cards-0001.json'] = JSON.stringify(first.map(cardRow).reverse());
assert.equal((await expectedError(request)).status, 400);
assert.equal(globalThis.__rangeTest.writes.length, 0);
globalThis.__rangeTest.files['data/catalog/cards-0001.json'] = original['data/catalog/cards-0001.json'];
globalThis.__rangeTest.files['data/catalog/cards-0003.json'] = '[]';
assert.equal((await expectedError({ action: 'preview', ...range })).status, 400);
assert.equal(globalThis.__rangeTest.writes.length, 0);
delete globalThis.__rangeTest.files['data/catalog/cards-0003.json'];
const deleted = await call(request);
assert.equal(deleted.status, 200); assert.equal(deleted.body.count, 2);
assert.equal(globalThis.__rangeTest.writes.length, 1);
assert.equal(globalThis.__rangeTest.writes[0].expectedHead, preview.body.ref);
assert.equal(globalThis.__rangeTest.writes[0].files.length, 5); // two full/card pairs and manifest, one commit
const rows1 = JSON.parse(globalThis.__rangeTest.files['data/catalog/part-0001.json']);
const rows2 = JSON.parse(globalThis.__rangeTest.files['data/catalog/part-0002.json']);
assert.deepEqual(rows1.map((r) => r.id), ['keep', 'undated', 'moved']);
assert.deepEqual(rows2.map((r) => r.id), ['moved']);
const cards1 = JSON.parse(globalThis.__rangeTest.files['data/catalog/cards-0001.json']);
const cards2 = JSON.parse(globalThis.__rangeTest.files['data/catalog/cards-0002.json']);
assert.deepEqual(cards1.map((r) => r.id), rows1.map((r) => r.id));
assert.deepEqual(cards2.map((r) => r.id), rows2.map((r) => r.id));
const manifest = JSON.parse(globalThis.__rangeTest.files['data/catalog/manifest.json']);
assert.equal(manifest.total, 4); assert.deepEqual(manifest.parts.map((p) => p.count), [3, 1]);
console.log('ok    archive API: mocked authorization, preview/part, stale/mismatch refusal and one atomic scoped deletion');
