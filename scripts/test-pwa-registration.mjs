import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// PwaRegister has no JSX; run the real effect with a tiny service-worker/browser harness.
let source = await readFile(new URL('../components/PwaRegister.js', import.meta.url), 'utf8');
source = source.replace("'use client';", '').replace("import { useEffect } from 'react';", '')
  .replace('export default function PwaRegister()', 'function PwaRegister()');
source += '\nPwaRegister();';
const flush = () => new Promise((resolve) => setImmediate(resolve));

function run(initialController = null) {
  const listeners = new Map();
  const regListeners = new Map();
  let idle, cleanup, resolveRegistration;
  let reloads = 0;
  let intervalsCleared = 0;
  const registration = {
    waiting: null, installing: null,
    addEventListener(type, fn) { regListeners.set(type, fn); },
    removeEventListener(type) { regListeners.delete(type); },
    async update() {},
  };
  const worker = {
    controller: initialController,
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type) { listeners.delete(type); },
    register() { return new Promise((resolve) => { resolveRegistration = () => resolve(registration); }); },
  };
  const document = { readyState: 'complete', visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
  const window = {
    requestIdleCallback(fn) { idle = fn; return 1; }, cancelIdleCallback() {},
    addEventListener() {}, removeEventListener() {}, location: { reload() { reloads += 1; } },
  };
  vm.runInNewContext(source, {
    navigator: { serviceWorker: worker }, document, window,
    process: { env: { NODE_ENV: 'production' } },
    useEffect(fn) { cleanup = fn(); },
    setTimeout, clearTimeout,
    setInterval() { return 42; }, clearInterval() { intervalsCleared += 1; },
  });
  return {
    worker, listeners, registration,
    start() { idle(); }, finishRegistration() { resolveRegistration(); },
    change(controller) { worker.controller = controller; listeners.get('controllerchange')(); },
    cleanup() { cleanup(); },
    get reloads() { return reloads; }, get intervalsCleared() { return intervalsCleared; },
  };
}

// First claim happens while register() is still pending: it is not an update/reload.
const first = run();
first.start();
assert.ok(first.listeners.has('controllerchange'), 'listen before the registration resolves');
first.change({ scriptURL: '/sw.js' });
assert.equal(first.reloads, 0, 'first install must not reload and redownload the page');
first.finishRegistration();
await flush();
first.change({ scriptURL: '/sw.js' });
assert.equal(first.reloads, 1, 'a subsequent worker update reloads once');
first.change({ scriptURL: '/sw.js' });
assert.equal(first.reloads, 1, 'repeated controller events do not create a reload loop');
first.cleanup();
assert.equal(first.listeners.has('controllerchange'), false);
assert.equal(first.intervalsCleared, 1);

// Already controlled visitors still refresh when a new worker takes over.
const returning = run({ scriptURL: '/sw.js' });
returning.start();
returning.finishRegistration();
await flush();
returning.change({ scriptURL: '/sw.js' });
assert.equal(returning.reloads, 1);
returning.cleanup();
console.log('PWA registration: first install does not reload; updates reload once and listeners are cleaned up.');
