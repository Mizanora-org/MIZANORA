// v29 tests: private stream key, cast-key endpoint, player buffering/relay memory, logos, caster key lookup.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const ok = (m) => console.log('ok   ', m);
const C = await import(pathToFileURL(path.join(root, 'lib/liveChannel.js')).href);
const T = await import(pathToFileURL(path.join(root, 'lib/liveTv.js')).href);

// 1) the stream key must never be part of the public channel setting
const cleaned = C.cleanChannel({ youtube: { last: { broadcastId: 'abc', rtmpUrl: 'rtmps://a.rtmp.youtube.com/live2', streamKey: 'SECRET-KEY-1234', watchUrl: 'https://www.youtube.com/watch?v=abc' } } });
assert.equal(cleaned.youtube.last.streamKey, '');
assert.equal(cleaned.youtube.last.hasKey, true);
assert.ok(!JSON.stringify(cleaned).includes('SECRET-KEY-1234'));
ok('stream key is stripped from the public channel setting');

// 2) rules + routes
const rules = read('firestore.rules');
assert.ok(/match \/adminSecrets\/\{id\} \{ allow read, write: if false; \}/.test(rules));
const adm = read('app/api/admin/live-channel/route.js');
assert.ok(/setYtSecret\(\{ key: last\.streamKey/.test(adm) && /act === 'ytSetKey'/.test(adm) && /verifyAdmin/.test(adm));
assert.ok(!/ref\.set\(\{ youtube: \{ privacy, title: '', last \} \}/.test(adm), 'the key must not be written to the public doc');
const ck = read('app/api/live/cast-key/route.js');
assert.ok(/CAST_TOKEN/.test(ck) && /timingSafeEqual/.test(ck) && /length < 24/.test(ck) && /no-store/.test(ck));
ok('private key store, admin key actions and the token-protected cast-key route');

// 3) caster
const cast = read('scripts/live-cast.mjs');
assert.ok(/api\/live\/cast-key/.test(cast) && /await resolveKey\(\)/.test(cast) && /let key =/.test(cast));
assert.ok(/CAST_TOKEN/.test(read('.github/workflows/live-channel.yml')));
ok('caster loads the key from the admin panel when CAST_TOKEN is set');

// 4) player
const pl = read('components/LiveTvPlayer.js');
assert.ok(/maxBufferLength: 30/.test(pl) && /BUFFER_STUCK_MS/.test(pl) && /rememberRelay/.test(pl) && /manifestLoadError/.test(pl) && /onError=\{\(\) => setBad\(true\)\}/.test(pl));
assert.equal(T.cleanChannel({ name: 'Geo', url: 'https://x.example/a.m3u8', logo: 'http://logo.example/g.png' }).logo, 'http://logo.example/g.png');
const css = read('app/globals.css');
assert.ok(/-webkit-line-clamp: 2/.test(css) && /mztv-logo\.has-img/.test(css));
ok('player: bigger live buffer, stuck-buffer watchdog, relay memory, logo fallback, readable channel names');

// 5) live channel audio
const lc = read('components/LiveChannel.js');
assert.ok(/warm\.current/.test(lc) && /a\.onerror/.test(lc));
ok('live channel: next ayah is preloaded, one retry on a failed audio file');
console.log('\nAll v29 tests passed.');
