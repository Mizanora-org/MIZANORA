import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripModel } from '../lib/liveBadges.js';
import { loadLayoutData } from '../lib/layoutData.js';
import { lowestPriced } from '../lib/homeShelves.js';
import { createPrefetchBudget } from '../lib/prefetchBudget.js';

const page = readFileSync('app/page.js', 'utf8');
const hub = readFileSync('components/HomeHub.js', 'utf8');
const live = readFileSync('app/live/page.js', 'utf8');
assert.match(live, /channels: list\.slice\(0, 14\)/, 'live banner must not serialize the whole channel list');
assert.match(live, /<LiveTvPlayer cfg=\{cfg\}/, 'the full channel list remains available to the player');
assert.match(page, /categories\.slice\(0, 6\)/, 'home category shelves are bounded');
assert.match(page, /max: 24/, 'mixed feed stays compact');
assert.match(page, /tvItems\.slice\(0, 14\)/, 'TV client boundary receives a small preview');
assert.match(hub, /chans\.length >= 18/, 'home hub creates only 18 TV link objects');
const preview = Array.from({ length: 14 }, (_, i) => ({ name: `Channel ${i}`, slug: `channel-${i}` }));
const b = stripModel({ tv: { count: 100000, channels: preview } });
assert.equal(b.tvCount, 100000, 'the badge shows the full channel count');
assert.equal(b.channels.length, 14, 'no full TV catalogue is sent to the banner');

// The bounded selection must produce the same stable order as the old filter/sort/slice.
const products = Array.from({ length: 5000 }, (_, i) => ({ id: i, price: (i * 37) % 31, category: i % 3 }));
for (const category of [0, 1, 2, 10]) {
  for (const limit of [1, 4, 8]) {
    const matches = (p) => p.category === category;
    const expected = products.filter(matches).sort((a, b) => a.price - b.price).slice(0, limit);
    assert.deepEqual(lowestPriced(products, matches, limit), expected);
  }
}
assert.deepEqual(lowestPriced(products, () => true, 0), []);
assert.doesNotMatch(page, /Math\.min\(\.\.\./, 'large catalogues must not overflow the argument stack');

// Hover/touch prefetch is useful, but an accidental sweep over products must not trigger
// unbounded on-demand page generation. Exhausting the budget does not affect the links.
let clock = 0;
let network = {};
const prefetched = [];
const prefetch = createPrefetchBudget((href) => prefetched.push(href), { now: () => clock, connection: () => network });
for (let i = 0; i < 6; i += 1) assert.equal(prefetch(`/product/${i}`), true);
assert.equal(prefetch('/product/0'), false, 'the same link is not fetched twice');
assert.equal(prefetch('/product/6'), false, 'only six speculative requests are allowed per minute');
assert.equal(prefetched.length, 6);
clock = 60_000;
assert.equal(prefetch('/product/6'), true, 'the rolling budget recovers');
network = { saveData: true };
assert.equal(prefetch('/product/data-saver'), false, 'data-saver disables speculative requests');
network = { effectiveType: '2g' };
assert.equal(prefetch('/product/slow'), false, 'very slow connections skip speculative requests');
network = { effectiveType: '4g' };
assert.equal(prefetch('/product/fast'), true);
assert.match(readFileSync('components/CardEvents.js', 'utf8'), /createPrefetchBudget/, 'product cards use the budget');
let attempts = 0;
const retry = createPrefetchBudget(() => { attempts += 1; if (attempts === 1) throw new Error('failed'); });
assert.equal(retry('/product/retry'), false);
assert.equal(retry('/product/retry'), true, 'a synchronous prefetch failure is retryable');

// Every independent layout read begins before any of the others finishes; the assistant
// begins as soon as status arrives, and remains off for down/saver/disabled states.
const started = [];
const releases = {};
const loaders = {};
for (const name of ['getThemeMode', 'getSiteStatus', 'getCategories', 'getAppMusic', 'getQuranConfig', 'getInject', 'getPublicAssistant']) {
  loaders[name] = () => {
    started.push(name);
    return new Promise((resolve) => { releases[name] = resolve; });
  };
}
const layout = loadLayoutData(loaders);
assert.equal(started.length, 6, 'all six independent reads start immediately');
assert.ok(!started.includes('getPublicAssistant'), 'assistant waits for the status switch');
releases.getSiteStatus({ mode: 'normal', features: {} });
await Promise.resolve();
assert.ok(started.includes('getPublicAssistant'), 'assistant starts without waiting for the other settings');
for (const name of ['getThemeMode', 'getCategories', 'getAppMusic', 'getQuranConfig', 'getInject', 'getPublicAssistant']) releases[name](name);
const loaded = await layout;
assert.equal(loaded.assistant, 'getPublicAssistant');
assert.equal(loaded.music, 'getAppMusic');
for (const status of [{ mode: 'down', features: {} }, { mode: 'saver', features: {} }, { mode: 'normal', features: { assistant: false } }]) {
  let assistantReads = 0;
  const simple = Object.fromEntries(Object.keys(loaders).map((name) => [name, async () => null]));
  simple.getSiteStatus = async () => status;
  simple.getPublicAssistant = async () => { assistantReads += 1; return { enabled: true }; };
  const result = await loadLayoutData(simple);
  assert.equal(assistantReads, 0);
  assert.equal(result.assistant.enabled, false);
}
console.log('Home performance: bounded shelves/feed and prefetches, parallel layout reads and 100k-channel preview payload OK.');
