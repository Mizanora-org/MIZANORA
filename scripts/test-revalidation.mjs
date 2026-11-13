import assert from 'node:assert/strict';
import { POST } from '../app/api/revalidate/route.js';

globalThis.__revalidationTest = { tags: [], paths: [] };
const state = globalThis.__revalidationTest;
const request = (body, auth = true) => new Request('https://mizanora.example/api/revalidate', {
  method: 'POST', headers: { 'content-type': 'application/json', ...(auth ? { authorization: 'Bearer test-admin' } : {}) },
  body: JSON.stringify(body),
});
const clear = () => { state.tags.length = 0; state.paths.length = 0; };

let response = await POST(request({ tags: ['images'] }, false));
assert.equal(response.status, 401);
assert.deepEqual(state.tags, []);
assert.deepEqual(state.paths, []);

for (const tag of ['images', 'ads', 'quran', 'deals-config', 'reel-music', 'livetv', 'github']) {
  clear();
  response = await POST(request({ tags: [tag, tag] }));
  assert.equal(response.status, 200);
  assert.deepEqual(state.tags, [tag], `${tag} is invalidated once`);
  assert.deepEqual(state.paths, [], 'settings-only changes must not invalidate the entire layout');
}
clear();
response = await POST(request({ tags: ['not-a-real-tag'] }));
assert.equal(response.status, 400);
assert.deepEqual(state.tags, []);
assert.deepEqual(state.paths, []);

clear();
response = await POST(request({ slug: 'test-product' }));
assert.equal(response.status, 200);
assert.ok(state.tags.includes('catalog'), 'normal product saves still invalidate the catalogue');
assert.ok(state.paths.some(([path, type]) => path === '/' && type === 'layout'), 'normal saves still refresh shared layout');
assert.ok(state.paths.some(([path]) => path === '/product/test-product'), 'changed product page is refreshed');
console.log('Revalidation: authenticated, tagged settings stay targeted; full product refresh remains intact.');
