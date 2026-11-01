// Exercise the real admin component across its loading, success and failure renders.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import * as tv from '../lib/liveTv.js';
import { readTvAll, clearTvChannels } from '../lib/liveTvStore.js';

const dom = new JSDOM('<div id="root"></div>', { url: 'https://example.test' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const require = createRequire(import.meta.url);
const source = ts.transpileModule(readFileSync(new URL('../app/admin/tv/page.js', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
}).outputText;
const noop = () => null;
const mocks = {
  'next/link': { __esModule: true, default: ({ children }) => React.createElement('a', null, children) },
  'lucide-react': new Proxy({}, { get: () => noop }),
  '@/lib/firebase-client': { authClient: () => ({ currentUser: { getIdToken: async () => 'token' } }) },
  '@/lib/liveTv': tv,
  '@/components/XtreamImport': { __esModule: true, default: noop },
  '@/components/TvBulkTools': { __esModule: true, default: noop },
};
const exports = {};
vm.runInThisContext('(function(require, exports) {' + source + '\n})')((name) => mocks[name] || require(name), exports);
const AdminTv = exports.default;
const channel = { name: 'News', url: 'https://example.test/news.m3u8', group: 'News', sources: [], off: false };
let respond;
globalThis.fetch = () => new Promise((resolve) => { respond = (body) => resolve({ json: async () => body }); });
const root = createRoot(document.getElementById('root'));
await act(async () => { root.render(React.createElement(AdminTv)); });
assert.match(document.body.textContent, /Loading/);
await act(async () => { respond({ ok: true, cfg: { ...tv.TV_DEFAULT, channels: [channel], count: 1 }, recorded: 1 }); });
assert.match(document.body.textContent, /Live TV/);
assert.equal(document.querySelectorAll('button').length > 0, true);
assert.equal([...document.querySelectorAll('button')].find((b) => b.textContent === 'Save').disabled, false);
await act(async () => { root.unmount(); });

// A failed read displays a retry and cannot save defaults over an existing database.
const root2 = createRoot(document.getElementById('root'));
await act(async () => { root2.render(React.createElement(AdminTv)); });
await act(async () => { respond({ ok: false, error: 'database unavailable' }); });
assert.match(document.body.textContent, /database unavailable/);
assert.ok([...document.querySelectorAll('button')].filter((b) => b.textContent === 'Save').every((b) => b.disabled));
await act(async () => { [...document.querySelectorAll('button')].find((b) => b.textContent === 'Try again').click(); });
await act(async () => { respond({ ok: true, cfg: { ...tv.TV_DEFAULT, channels: [channel], count: 2 }, recorded: 2 }); });
assert.match(document.body.textContent, /only 1 came back/);
assert.ok([...document.querySelectorAll('button')].filter((b) => b.textContent === 'Save').every((b) => b.disabled));
await act(async () => { [...document.querySelectorAll('button')].find((b) => b.textContent === 'Try again').click(); });
await act(async () => { respond({ ok: true, cfg: { ...tv.TV_DEFAULT, channels: [channel], count: 1 }, recorded: 1 }); });
assert.equal([...document.querySelectorAll('button')].find((b) => b.textContent === 'Save').disabled, false);
await act(async () => { root2.unmount(); });
dom.window.close();

// Minimal Firestore double verifies count preservation, failed reads and legacy clearing.
function database(initial, fail = false) {
  let config = initial;
  const shards = new Map([['p0', { channels: [channel] }]]);
  const sub = { get: async () => { if (fail) throw new Error('shard read failed'); return { docs: [...shards].map(([id, data]) => ({ id, data: () => data })) }; }, doc: (id) => ({ id }) };
  return {
    collection: () => ({ doc: () => ({ get: async () => ({ data: () => config }), set: async (v) => { config = v; }, collection: () => sub }) }),
    batch: () => { const deleted = []; return { delete: (ref) => deleted.push(ref.id), commit: async () => deleted.forEach((id) => shards.delete(id)) }; },
    get config() { return config; },
  };
}
const db = database({ enabled: true, title: 'TV', count: 2, parts: 2 });
const data = await readTvAll(db);
assert.equal(data.config.count, 2);
assert.equal(data.channels.length, 1);
await assert.rejects(readTvAll(database({ count: 1 }, true)), /shard read failed/);
await assert.rejects(clearTvChannels(database({ count: 1 }, true)), /shard read failed/);
const legacy = database({ enabled: true, title: 'TV', channels: [channel] });
await clearTvChannels(legacy);
assert.equal(legacy.config.title, 'TV');
assert.equal(legacy.config.count, 0);
assert.ok(!('channels' in legacy.config));
assert.equal((await readTvAll(legacy)).channels.length, 0);
console.log('Admin TV render, retry, safety and Firestore regression tests passed');
