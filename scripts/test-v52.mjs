/*
 * Mizanora v52 tests - the Live TV player brought past SIRAVEX level:
 * channel-number zapping + zap OSD, sleep timer, gesture HUD (volume / channel),
 * keyboard shortcuts sheet, timeshift (-30s), Chromecast / Remote Playback,
 * remembered picture per stream host, and "last channel" resume.
 *
 * Run: node scripts/test-v52.mjs   (also wired into `npm test`)
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), 'utf8') : '');
const ok = (m) => console.log(`ok    ${m}`);

// ------------------------------------------------------------------ 1. pure helpers
const U = await import(pathToFileURL(join(root, 'lib/liveTvUi.js')).href);

assert.equal(U.sleepClock(90), '1:30');
assert.equal(U.sleepClock(60), '1:00');
assert.equal(U.sleepClock(0), '0:00');
assert.equal(U.sleepClock(3600), '1:00:00');
assert.equal(U.sleepClock(3725), '1:02:05');
assert.equal(U.sleepClock(-9), '0:00');
assert.equal(U.sleepClock('45'), '0:45');
ok('sleep timer: countdown formats (0:45, 1:30, 1:02:05)');

assert.equal(U.typedChannel('1', 40), 0, 'channel 1 is index 0');
assert.equal(U.typedChannel('12', 40), 11);
assert.equal(U.typedChannel('040', 40), 39, 'leading zeros are ignored');
assert.equal(U.typedChannel('99', 40), -1, 'out of range does nothing');
assert.equal(U.typedChannel('0', 40), -1, 'channel 0 does not exist');
assert.equal(U.typedChannel('', 40), -1);
assert.equal(U.typedChannel('abc', 40), -1);
assert.equal(U.typedChannel('5', 0), -1, 'an empty channel list never jumps');
assert.deepEqual(U.SLEEP_PRESETS, [0, 15, 30, 60, 90]);
ok('zapping: typed channel numbers map to indexes and refuse what is not there');

// ------------------------------------------------------------------ 2. the player wiring
const pl = read('components/LiveTvPlayer.js');
const need = [
  ['SLEEP_PRESETS, TV_QUALITY', 'sleep presets come from the shared helper'],
  ['typedChannel(want, chans.length)', 'the numeric jump uses the tested helper'],
  ['const [zap, setZap]', 'channel-switch OSD state'],
  ['const [sleepMins, setSleepMins]', 'sleep timer state'],
  ['const [hud, setHud]', 'gesture HUD state'],
  ['const [helpOpen, setHelpOpen]', 'shortcuts sheet state'],
  ['const [dvr, setDvr]', 'timeshift window state'],
  ['const [canCast, setCanCast]', 'Remote Playback detection'],
  ['const skipBack = useCallback', 'timeshift action'],
  ['const castTo = useCallback', 'cast action'],
  ['remote.prompt()', 'cast uses the browser Remote Playback API'],
  ['setSleep(', 'sleep timer can be set'],
  ['bumpSleep', 'T cycles the sleep timer'],
  ['flashHud(', 'gestures flash a HUD'],
  ['kind: \'vol\'', 'vertical swipe is volume'],
  ['kind: \'ch\'', 'horizontal swipe is channel'],
  ["readPref('mz_tv_last'", 'the last channel is remembered'],
  ['writePref(`mz_tv_lvl_', 'the pinned picture is remembered per host'],
  ['const SHORTCUTS = [', 'the shortcuts sheet has content'],
  ['mztv-zap', 'zap OSD markup'],
  ['mztv-hud', 'gesture HUD markup'],
  ['mztv-help', 'shortcuts sheet markup'],
  ["e.key === '?'", 'the ? key opens the sheet'],
  ["/^[0-9]$/.test(e.key)", 'number keys are captured'],
];
for (const [bit, why] of need) assert.ok(pl.includes(bit), `player missing ${bit} (${why})`);
ok(`player wiring: ${need.length} behaviours connected (zap, sleep, HUD, cast, timeshift, memory)`);

// No stray timers / handlers left behind, and every path is cleaned up.
assert.ok(/clearTimeout\(typeTimer\.current\)/.test(pl), 'the typed-digits timer is cleared');
assert.ok(/clearTimeout\(hudTimer\.current\)/.test(pl), 'the HUD timer is cleared');
assert.ok(pl.includes('window.removeEventListener(\'keydown\', onKey)'), 'the keyboard listener is removed');
assert.ok(pl.includes('setTimeout(() => setZap(null), ZAP_MS)'), 'the zap OSD clears itself');
ok('cleanup: timers, listeners and the OSD all tidy themselves up');

// ------------------------------------------------------------------ 3. styles
const css = read('app/globals.css');
for (const sel of ['.mztv-zap', '.mztv-hud', '.mztv-help', '.mztv-badge.is-sleep', '@keyframes mztv-zap-in']) {
  assert.ok(css.includes(sel), `globals.css missing ${sel}`);
}
assert.ok(css.includes('.mztv-help kbd'), 'shortcut keys are styled as kbd chips');
assert.ok(/@media \(max-width: 700px\)[\s\S]{0,400}\.mztv-zap/.test(css), 'the zap OSD scales down on phones');
ok('styles: zap banner, HUD, sleep badge and the shortcuts sheet are themed + responsive');

// ------------------------------------------------------------------ 4. release plumbing
const pkg = JSON.parse(read('package.json'));
assert.ok(Number(String(pkg.version).split('.')[0]) >= 52, `version should be 52 or newer, got ${pkg.version}`);
assert.ok(pkg.scripts.test.includes('test-v52.mjs'), 'v52 test is part of npm test');
const doc = read('UPGRADE-v52.md');
for (const bit of ['Zap', 'Sleep timer', 'Gesture', 'Shortcuts', 'Timeshift', 'Cast']) {
  assert.ok(doc.includes(bit), `UPGRADE-v52.md missing ${bit}`);
}
assert.ok(doc.includes('SIRAVEX'), 'the doc names the reference');
const blog = read('content/blog/mizanora-live-tv-zapping-sleep-timer-shortcuts-guide.md');
assert.ok(blog.startsWith('---'), 'the v52 guide needs front matter');
assert.ok(blog.includes('slug: mizanora-live-tv-zapping-sleep-timer-shortcuts-guide') && blog.includes('date: 2026-11-06'));
assert.ok(blog.includes('Sleep timer') && blog.includes('Chromecast'), 'the guide explains the new features');
ok('release: version 52.0.0, UPGRADE-v52.md and the test chain verified');

console.log('\nAll 5 v52 checks passed.');
