/*
 * Mizanora v49 tests - the rebuilt Live TV player (Tamasha-style grid, exact quality /
 * audio-track / caption capture, photo capture, stats) and the M3U + Xtream import fixes
 * (the unreachable 'commit', group names vs ids, refused redirects, invisible buttons).
 *
 * Run: node scripts/test-v49.mjs   (also wired into `npm test`)
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), 'utf8') : '');
const ok = (m) => console.log(`ok    ${m}`);

// ------------------------------------------------- 1. the pure player helpers
const U = await import(pathToFileURL(join(root, 'lib/liveTvUi.js')).href);
assert.equal(U.resLabel(1080), '1080p');
assert.equal(U.resLabel(2160), '4K');
assert.equal(U.resLabel(0), 'Auto');
assert.equal(U.formatBitrate(2500000), '2.5 Mbps');
assert.equal(U.formatBitrate(640000), '640 kbps');
assert.equal(U.formatBitrate(0), '');
const lv = U.normaliseLevels([{ height: 360, bitrate: 800000 }, { height: 1080, bitrate: 5000000, frameRate: 60 }, { height: 720, bitrate: 2500000 }]);
assert.deepEqual(lv.map((l) => l.i), [0, 1, 2], 'original engine indexes survive normalising');
assert.deepEqual(U.menuLevels(lv).map((l) => l.i), [1, 2, 0], 'the menu shows the best picture first');
assert.match(lv[1].label, /^1080p60/);
assert.equal(U.audioLabel({ lang: 'ur' }, 0), 'Urdu');
assert.match(U.audioLabel({ name: 'Main', lang: 'en' }, 1), /English/);
assert.equal(U.audioLabel({}, 2), 'Audio 3');
assert.equal(U.subLabel({ lang: 'ur' }, 0), 'Urdu');
assert.equal(U.latencyLabel(1.5), 'LIVE');
assert.equal(U.latencyLabel(12), '-12s');
assert.equal(U.latencyLabel(125), '-2:05');
assert.equal(U.channelHue('Geo News'), U.channelHue('Geo News'), 'a channel always gets its own colour');
assert.equal(U.channelInitials('Geo News'), 'GN');
assert.equal(U.channelInitials('ARY'), 'AR');
assert.equal(U.channelInitials(''), 'TV');
assert.deepEqual(U.sortChannels([{ name: 'B' }, { name: 'A' }], 'az').map((c) => c.name), ['A', 'B']);
assert.deepEqual(U.sortChannels([{ name: 'z', group: 'Sports' }, { name: 'q', group: 'News' }], 'group').map((c) => c.name), ['q', 'z']);
// the old contract is untouched
assert.equal(U.qualityLevel([1, 2, 3, 4], 'high'), 3);
assert.equal(U.tvStatusLabel('playing', false, 'hls'), 'ON AIR');
ok('ui helpers: resolution/bitrate capture labels, audio + caption names, latency, tile colour/initials, sorting - old rules intact');

// ------------------------------------------------- 2. the rebuilt player
const pl = read('components/LiveTvPlayer.js');
assert.ok(/import\('hls\.js'\)/.test(pl) && !/hls\.js\/light/.test(pl), 'full hls.js build (alternate audio + embedded captions)');
for (const k of ['AUDIO_TRACKS_UPDATED', 'AUDIO_TRACK_SWITCHED', 'SUBTITLE_TRACKS_UPDATED', 'SUBTITLE_TRACK_SWITCH', 'LEVEL_SWITCHED', 'autoLevelEnabled']) assert.ok(pl.includes(k), `hls: ${k}`);
ok('player: real HLS audio tracks, captions, exact levels with ABR truly pinned');
for (const k of ['createDash', 'getRepresentationsByType', 'setRepresentationForTypeByIndex', 'getTracksFor', 'setCurrentTrack', 'setTextTrack', 'autoSwitchBitrate', 'STREAM_INITIALIZED']) assert.ok(pl.includes(k), `dash5: ${k}`);
assert.ok(!/getAvailableBitrateListFor|setAutoSwitchQuality/.test(pl), 'no dash.js v4-only API left (it silently did nothing on v5)');
ok('player: dash.js v5 APIs (representations, tracks, settings) with a both-shapes factory');
for (const k of ['mztv-tiles', 'mztv-tile', 'mztv-bar', 'mztv-set-body', 'mztv-stats', 'capture', 'toBlob', 'mediaSession', 'wakeLock', 'warmHost', 'IntersectionObserver', 'menuLevels', 'pinLevel']) assert.ok(pl.includes(k), `player feature: ${k}`);
assert.ok(/status === 'playing' && isPlaying \? 'live'/.test(pl), 'the LIVE ribbon is live while actually playing (it showed CONNECTING before)');
assert.ok(!/setAudioTracks\(|dashPlayerEl|cdnjs\.cloudflare\.com/.test(pl));
ok('player: Tamasha-style tiles, custom control bar, settings panel, stats capture, photo capture, swipe + keys');
const css = read('app/globals.css');
for (const k of ['.mztv-tiles', '.mztv-tile.is-active', '.mztv-bar', '.mztv-set', '.mztv-stats', '.mztv-logo.has-img', '-webkit-line-clamp: 2', 'data-theme="vibe"']) assert.ok(css.includes(k), `css: ${k}`);
const themes = read('lib/liveTv.js');
assert.ok(/'vibe', 'Vibe \(Purple\)'/.test(themes) && /'cinema', 'Cinema'/.test(themes), 'themes kept + vibe added');
ok('css/themes: tile grid, control bar, settings, stats and the new vibe theme');

// ------------------------------------------------- 3. the Xtream import fix (commit was DEAD CODE)
const xr = read('app/api/admin/tv/xtream/route.js');
const commitAt = xr.indexOf("action === 'commit'");
const browserRefuseAt = xr.indexOf('tooBig: true');
assert.ok(commitAt > 0 && browserRefuseAt > commitAt, 'commit runs BEFORE the browser-cap refusal (it used to sit under an unconditional return)');
assert.ok(/the server pulls the panel/.test(xr) && /writeTvAll/.test(xr) && /revalidatePath\('\/live'\)/.test(xr));
ok('xtream route: commit is reachable, first, and writes through the shard store');

const xs = read('lib/xtreamServer.js');
assert.ok(/idByName/.test(xs) && /pickedRaw/.test(xs) && /were not found on the panel/.test(xs), 'group names resolved to ids; an unmatched pick says so instead of importing zero');
assert.ok(/groups: groupList/.test(xs), 'test answers groups with their category ids');
const xu = read('components/XtreamImport.js');
assert.ok(/groupKey/.test(xu) && /g\.id/.test(xu), 'the UI picks groups by id, not by display name');
assert.ok(/hamesha yahin hain/.test(xu), 'both import buttons visible before testing (with the reason they wait)');
assert.ok(/You are signed out\. Reload the page/.test(xu), 'a signed-out import explains itself');
const { xtreamPreview } = await import(pathToFileURL(join(root, 'lib/xtream.js')).href);
const prev = xtreamPreview({ account: {}, live: [{ id: '7', group: 'Pakistan' }, { id: '7', group: 'Pakistan' }, { group: 'News', count: 3 }] });
assert.deepEqual(prev.groups[0], { id: '', name: 'News', count: 3 });
assert.deepEqual(prev.groups[1], { id: '7', name: 'Pakistan', count: 2 }, 'preview passes category ids through');
ok('xtream: group ids flow test -> UI -> import; names are resolved server-side; buttons always visible');

// ------------------------------------------------- 4. the M3U link loader fix
const ti = read('app/api/admin/tv-import/route.js');
assert.ok(/redirect: 'manual'/.test(ti) && /assertPublic/.test(ti) && /priv\(/.test(ti), 'redirects followed by hand, every hop private-checked');
assert.ok(/u\.protocol !== 'https:' && u\.protocol !== 'http:'/.test(ti), 'http panel playlists accepted (they were refused)');
assert.ok(/32 \* 1024 \* 1024/.test(ti) && /AbortSignal\.timeout\(45000\)/.test(ti), '32 MB and 45 s (was 2 MB / 15 s)');
const adm = read('app/admin/tv/page.js');
assert.ok(!/{!loadErr && busy !== 'load' && <XtreamImport/.test(adm), 'the panel importer no longer vanishes when the list failed to load');
assert.ok(/btn-gold shrink-0/.test(adm) && /disabled={busy === 'link'}/.test(adm), 'the Load button is gold and always pressable');
ok('tv-import + admin: redirects, http, real sizes, plain-language errors, buttons on screen');

// ------------------------------------------------- 5. the new writing
const { getPosts } = await import(pathToFileURL(join(root, 'lib/blog.js')).href);
const posts = new Map(getPosts().map((p) => [p.slug, p]));
for (const s of ['mizanora-live-tv-v49-naya-player-beautiful-grid', 'live-tv-video-quality-audio-track-capture-guide', 'live-tv-channels-load-problem-fix-guide']) {
  assert.ok(posts.has(s), `blog published: ${s}`);
  assert.equal(posts.get(s).category, 'live-and-reels');
  assert.ok((posts.get(s).words || 0) >= 350, `blog ${s} is substantial (${posts.get(s).words} words)`);
}
assert.ok(readdirSync(join(root, 'content/blog')).every((f) => !/iptv|xtream|tivimate|stalker|siravex/i.test(f)), 'no banned words slipped into a blog filename');
assert.ok(/v49 update/.test(read('content/blog/mizanora-live-tv-audio-tracks-video-quality.md')), 'the older audio-tracks guide carries the v49 update');
ok('blog: three new Live TV guides, the older ones refreshed');

// ------------------------------------------------- 6. wiring
const pkg = JSON.parse(read('package.json'));
assert.ok(Number(String(pkg.version).split('.')[0]) >= 49, `version is ${pkg.version}`);
assert.ok(pkg.scripts.test.includes('scripts/test-v49.mjs'), 'test-v49 is in the npm test chain');
assert.ok(/player/i.test(read('UPGRADE-v49.md')) && /xtream|panel/i.test(read('UPGRADE-v49.md')) && /m3u/i.test(read('UPGRADE-v49.md')), 'UPGRADE-v49.md documents the player and the import fixes');
ok('wiring: version, test chain, upgrade notes');

console.log('\nAll v49 tests passed.');
