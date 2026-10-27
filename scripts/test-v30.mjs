import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, createHmac } from 'node:crypto';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const imp = (f) => import(pathToFileURL(path.join(root, f)).href);
const { cleanChannel, cleanTv, channelSources, isChannelSourceAllowed, MAX_TV_SOURCES, tvTheme } = await imp('lib/liveTv.js');
const { archiveDateRange, archiveTimestamp, assertArchivePair, inArchiveRange, omitArchiveIds, selectArchiveRange, rangeSelectionKey } = await imp('lib/archiveRange.js');
const { mergeArchiveProduct } = await imp('lib/archiveProductEdit.js');
const { assistantIntent, localAssistantHelp } = await imp('lib/assistantIntent.js');
const { cleanProductDetails } = await imp('lib/productDetails.js');

// Live TV: existing one-link channels still work; backups are cleaned, deduplicated and bounded.
const legacy = cleanChannel({ name: 'News', url: 'https://primary.example/a.m3u8' });
assert.deepEqual(channelSources(legacy), ['https://primary.example/a.m3u8']);
assert.equal(cleanChannel({ name: 'Too long', url: 'https://x.example/' + 'a'.repeat(600) }), null);
const channel = cleanChannel({ name: 'News', url: 'https://primary.example/a.m3u8', sources: ['https://primary.example/a.m3u8', 'http://backup.example/b.m3u8', 'http://backup.example/b.m3u8', 'javascript:alert(1)', ...Array.from({ length: 12 }, (_, i) => `https://backup${i}.example/c.m3u8`)] });
assert.equal(channelSources(channel).length, MAX_TV_SOURCES);
assert.equal(channel.sources[0], 'http://backup.example/b.m3u8');
assert.ok(!channelSources(channel).some((u) => u.startsWith('javascript:')));
const cfg = cleanTv({ enabled: true, theme: 'ocean', channels: [channel] });
assert.equal(cfg.theme, 'ocean'); assert.equal(tvTheme('bad'), 'cinema');
assert.equal(isChannelSourceAllowed(cfg, 'http://backup.example/b.m3u8'), true);
assert.equal(isChannelSourceAllowed(cfg, 'https://not-saved.example/x'), false);
assert.equal(isChannelSourceAllowed({ ...cfg, enabled: false }, channel.url), false);
assert.equal(isChannelSourceAllowed({ ...cfg, channels: [{ ...channel, off: true }] }, channel.url), false);
assert.match(read('components/LiveTvPlayer.js'), /advanceSource\(\)/);
assert.match(read('components/LiveTvPlayer.js'), /failureHandled/);
// Cached relay hosts come from sessionStorage only after hydration, before playback begins.
assert.match(read('components/LiveTvPlayer.js'), /relayReady && sourceUrl && relayHosts\.has/);
assert.match(read('components/LiveTvPlayer.js'), /!relayReady \|\| !v/);
assert.match(read('components/LiveTvPlayer.js'), /setInterval\([\s\S]*BUFFER_STUCK_MS/);
assert.match(read('app/admin/tv/page.js'), /Backup streams/);
assert.match(read('app/api/tv/p/route.js'), /isChannelSourceAllowed/);

// In local/demo mode a public project ID must not be usable to forge arbitrary relay signatures.
const proxy = await imp('lib/tvProxy.js');
const proxyEnv = Object.fromEntries(['TV_PROXY_SECRET', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_SERVICE_ACCOUNT', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID'].map((k) => [k, process.env[k]]));
try {
  delete process.env.TV_PROXY_SECRET; delete process.env.FIREBASE_PRIVATE_KEY; delete process.env.FIREBASE_SERVICE_ACCOUNT;
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'public-project';
  const url = 'https://other.example/stream.m3u8';
  const guess = createHmac('sha256', 'mz-tv-public-project').update(url).digest('base64url').slice(0, 22);
  assert.equal(proxy.checkSig(url, guess), false);
  assert.equal(proxy.checkSig(url, proxy.signUrl(url)), true);
} finally {
  for (const [key, value] of Object.entries(proxyEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
}
console.log('ok    live TV: backwards-compatible multiple streams, limits, safe relay, theme, bounded failover');

// Both ends of a Pakistan calendar date are inclusive, even when UTC is still the previous day.
const day = archiveDateRange('2026-10-18', '2026-10-18');
assert.equal(new Date(day.start).toISOString(), '2026-10-17T19:00:00.000Z');
assert.equal(inArchiveRange(Date.parse('2026-10-17T18:59:59.999Z'), day), false);
assert.equal(inArchiveRange(Date.parse('2026-10-17T19:00:00Z'), day), true);
assert.equal(inArchiveRange(Date.parse('2026-10-18T18:59:59.999Z'), day), true);
assert.equal(inArchiveRange(Date.parse('2026-10-18T19:00:00Z'), day), false);
assert.throws(() => archiveDateRange('2026-02-30', '2026-03-01'));
assert.throws(() => archiveDateRange('2026-10-19', '2026-10-18'));
assert.equal(archiveTimestamp({ seconds: 1792263600, nanoseconds: 500000000 }), 1792263600500);
assert.equal(archiveTimestamp('not a date'), 0);
const rows = selectArchiveRange([
  { n: 3, rows: [{ id: 'new', createdAt: day.start, active: false, part: 'preserve me' }, { id: 'dup', createdAt: day.end }] },
  { n: 2, rows: [{ id: 'dup', createdAt: day.start }, { id: 'undated' }, { id: 'new', createdAt: day.start }] },
], day);
assert.deepEqual(rows.matches.map((x) => x.row.id), ['new']);
assert.equal(rows.matches[0].row.part, 'preserve me');
assert.equal(rows.matches[0].row.active, false);
assert.equal(rows.undated, 1);
assert.equal(rows.total, 3);

// Real catalogue: selecting slim cards and full products must yield exactly the same IDs and dates.
const manifest = JSON.parse(read('data/catalog/manifest.json'));
const parts = [...manifest.parts].sort((a, b) => b.n - a.n);
const cards = parts.map((p) => ({ n: p.n, rows: JSON.parse(read(`data/catalog/${p.cards}`)) }));
const full = parts.map((p) => ({ n: p.n, rows: JSON.parse(read(`data/catalog/${p.file}`)) }));
const range = archiveDateRange('2026-01-01', '2026-12-31');
const a = selectArchiveRange(cards, range), b = selectArchiveRange(full, range);
const sha = (v) => createHash('sha256').update(v).digest('hex');
assert.ok(a.matches.length > 1000);
assert.equal(a.matches.length, b.matches.length);
assert.equal(sha(rangeSelectionKey(a.matches)), sha(rangeSelectionKey(b.matches)));
const route = read('app/api/admin/archive-range/route.js');
assert.match(route, /verifyAdmin/); assert.match(route, /DELETE \$\{expectedCount\}/);
assert.match(route, /ghCommit\(files,[\s\S]*, ref\)/); assert.match(route, /fingerprint\(selected\.matches\) !== body\.digest/);
assert.match(route, /omitArchiveIds\(original\.rows, original\.cards, ids\)/);
// Deletion removes matching IDs in each part and refuses misaligned full/card files.
const deleteIds = new Set(['remove']);
for (const n of [1, 2]) {
  const docs = [{ id: 'remove', part: n }, { id: `keep-${n}`, value: n }];
  const slim = [{ id: 'remove' }, { id: `keep-${n}` }];
  assertArchivePair(n, docs, slim);
  const left = omitArchiveIds(docs, slim, deleteIds);
  assert.deepEqual(left.rows, [{ id: `keep-${n}`, value: n }]);
  assert.deepEqual(left.cards, [{ id: `keep-${n}` }]);
}
assert.throws(() => assertArchivePair(1, [{ id: 'a' }], [{ id: 'b' }]), /disagree/);
assert.throws(() => assertArchivePair(2, [{ id: 'a' }], []), /disagree/);
assert.match(read('components/ArchiveRangeManager.js'), /Firebase copies/);
console.log(`ok    archive: PKT boundaries, latest-version dedupe, hidden/undated safety, ${a.matches.length} real product dates verified`);

// Mock GitHub HTTP: large contents use the blob endpoint; a stale head cannot be committed.
// No credential or real repository is used by these checks.
const github = await imp('lib/github.js');
const prevFetch = globalThis.fetch;
const envBefore = Object.fromEntries(['GITHUB_TOKEN', 'GITHUB_REPO', 'GITHUB_BRANCH'].map((k) => [k, process.env[k]]));
try {
  process.env.GITHUB_TOKEN = 'test-only'; process.env.GITHUB_REPO = 'test/repository'; process.env.GITHUB_BRANCH = 'main';
  const head = 'a'.repeat(40), other = 'b'.repeat(40), result = 'c'.repeat(40);
  const requests = [];
  let updateConflict = false;
  globalThis.fetch = async (url, opts) => {
    const path = String(url).replace('https://api.github.com/repos/test/repository', '');
    requests.push({ path, method: opts.method, body: opts.body ? JSON.parse(opts.body) : undefined });
    let body;
    if (path.startsWith('/contents/data/catalog/part-0001.json')) body = { size: 1200000, sha: 'bigblob', content: '' };
    else if (path === '/git/blobs/bigblob') body = { content: Buffer.from('large file payload').toString('base64') };
    else if (path === '/git/ref/heads/main') body = { object: { sha: head } };
    else if (path === `/git/commits/${head}`) body = { tree: { sha: 'base-tree' } };
    else if (path === '/git/trees') body = { sha: 'new-tree' };
    else if (path === '/git/commits') body = { sha: result };
    else if (path === '/git/refs/heads/main') {
      if (updateConflict) return new Response(JSON.stringify({ message: 'Not a fast forward' }), { status: 422 });
      body = { object: { sha: result } };
    } else throw new Error(`unexpected mock GitHub request: ${opts.method} ${path}`);
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  assert.equal(await github.ghReadFile('data/catalog/part-0001.json', head), 'large file payload');
  assert.ok(requests.some((r) => r.path === '/git/blobs/bigblob'));
  requests.length = 0;
  await assert.rejects(github.ghCommit([{ path: 'file', sha: 'blob' }], 'test', other), (e) => e.status === 409);
  assert.equal(requests.filter((r) => r.method !== 'GET').length, 0);
  requests.length = 0;
  assert.equal(await github.ghCommit([{ path: 'file', sha: 'blob' }], 'test', head), result);
  assert.deepEqual(requests.find((r) => r.path === '/git/trees').body.tree, [{ path: 'file', mode: '100644', type: 'blob', sha: 'blob' }]);
  assert.deepEqual(requests.find((r) => r.path === '/git/refs/heads/main').body, { sha: result });
  updateConflict = true;
  await assert.rejects(github.ghCommit([{ path: 'file', sha: 'blob' }], 'test', head), (e) => e.status === 422);
} finally {
  globalThis.fetch = prevFetch;
  for (const [key, value] of Object.entries(envBefore)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
}
console.log('ok    mocked GitHub: large blob reads, expected-head protection and non-fast-forward rejection');

const original = {
  id: 'bag', name: 'Bag', price: 1500, createdAt: day.start, updatedAt: day.start,
  images: ['https://cdn.example/a.jpg'], videos: ['https://cdn.example/demo.mp4'],
  options: [{ name: 'Color', values: ['Red', 'Blue'] }], specs: ['Material: Canvas'],
  affOn: false, affRate: 12, dealRoom: 75, customField: 'keep', cost: 700, sourceUrl: 'private',
  brand: 'Example', highlights: ['Strong stitching'], boxContents: 'One bag', warranty: '30 days',
};
const saved = mergeArchiveProduct(original, { price: 1600, createdAt: Date.now(), name: 'Updated bag' }, 1234);
assert.equal(saved.createdAt, original.createdAt); assert.equal(saved.updatedAt, 1234);
assert.equal(saved.price, 1600); assert.equal(saved.customField, 'keep'); assert.equal(saved.dealRoom, 75);
assert.deepEqual(saved.options, original.options); assert.deepEqual(saved.specs, original.specs);
assert.deepEqual(saved.videos, original.videos); assert.equal(saved.boxContents, 'One bag');
assert.equal(saved.affOn, false); assert.equal(saved.affRate, 12);
assert.equal('cost' in saved, false); assert.equal('sourceUrl' in saved, false);
assert.equal(mergeArchiveProduct({ ...original, createdAt: 0 }, { createdAt: Date.now() }).createdAt, 0);
assert.deepEqual(cleanProductDetails({ highlights: 'One\nTwo\n\nThree' }).highlights, ['One', 'Two', 'Three']);
assert.match(read('lib/products.js'), /cleanProductDetails\(x\)/);
assert.match(read('app/product/[slug]/page.js'), /p\.boxContents/);
assert.doesNotMatch(read('app/admin/catalogue/page.js'), /createdAt: Date\.now\(\)/);
console.log('ok    product edits preserve existing fields, media, options, private-data rules and original creation date');

for (const q of ['what is AI?', 'How are shoes made?', 'Python kya hai?', 'Tell me a joke']) assert.equal(assistantIntent(q), 'general', q);
for (const q of ['Asaan Lang kya hai?', 'Muaaz Iqbal kaun hai?', 'Live TV kaise dekhein?', 'Quran sunna hai', 'track my shoe order', 'delivery kaise hoti hai?']) assert.equal(assistantIntent(q), 'site', q);
for (const q of ['black shoes dikhao', 'Quran cover khareedna hai', 'جوتے دکھائیں', 'find me a toaster']) assert.equal(assistantIntent(q), 'shopping', q);
assert.equal(assistantIntent('Is it waterproof?', { hasHistory: true }), 'followup');
assert.equal(assistantIntent('rate kam karo', { hasCurrent: true }), 'followup');
assert.equal(assistantIntent('what is Asaan Lang?', { hasHistory: true }), 'site');
assert.equal(assistantIntent('hello'), 'greeting');
assert.equal(localAssistantHelp('Asaan Lang kya hai?', 'site').links[0].href, '/blog/asaan-lang-urdu-programming-language-by-muaaz-iqbal');
assert.match(localAssistantHelp('Explain physics', 'general').text, /verify nahi/);
const assistant = read('app/api/assistant/route.js');
assert.match(assistant, /intent === 'shopping' && !shown\.size/);
assert.match(assistant, /\['site', 'general', 'greeting'\]\.includes\(intent\)/);
assert.match(assistant, /previousSlugs/);
assert.match(read('lib/webAnswer.js'), /!sources\.length/);
console.log('ok    Noor: general/site questions do not trigger products; honest offline help, follow-up context and source checks');

for (const slug of ['mizanora-vs-pakistan-marketplaces-which-is-right', 'mizanora-vs-social-media-shopping-pakistan', 'muaaz-iqbal-building-mizanora-pakistan', 'asaan-lang-beginners-hands-on-roman-urdu', 'asaan-lang-programming-logic-practice-urdu', 'noor-live-tv-and-product-details-guide']) {
  const post = read(`content/blog/${slug}.md`);
  assert.ok(post.includes(`slug: ${slug}`)); assert.ok(post.includes('date: 2026-10-27'));
}
console.log('ok    six detailed new guides are published with correct front matter');
console.log('\nAll v30 tests passed.');
