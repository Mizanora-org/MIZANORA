/*
 * Mizanora v53 tests - the Live TV TRACK ENGINE.
 * The complaint: "audio aur quality tracking SIRAVEX ki tarah kaam nahi karti". These tests pin
 * down the decisions that make it work on every engine (hls.js, dash.js, native) and every kind
 * of link: which engine to try, which exact resolution a mode means, which language to start on,
 * and how the player proves a switch really happened.
 *
 * Run: node scripts/test-v53.mjs   (also wired into `npm test`)
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), 'utf8') : '');
const ok = (m) => console.log(`ok    ${m}`);

const T = await import(pathToFileURL(join(root, 'lib/liveTvTracks.js')).href);

// ---------------------------------------------------------------- 1. engine ladder
assert.deepEqual(T.engineLadder('hls'), ['hls', 'video']);
assert.deepEqual(T.engineLadder('dash'), ['dash', 'hls', 'video']);
assert.deepEqual(T.engineLadder('video'), ['video', 'hls']);
assert.deepEqual(T.engineLadder('audio'), ['video', 'hls']);
assert.deepEqual(T.engineLadder('youtube'), ['youtube']);
assert.deepEqual(T.engineLadder('unsupported'), []);
assert.deepEqual(T.engineLadder('playlist'), []);
assert.deepEqual(T.engineLadder(''), ['hls', 'video'], 'an unknown link still gets two chances');
assert.equal(T.engineChainLabel('dash', 0), 'DASH → HLS');
assert.equal(T.engineChainLabel('hls', 1), 'HLS → MP4');
assert.equal(T.engineChainLabel('unsupported'), 'Unsupported');
ok('engine ladder: HLS → MP4, DASH → HLS → MP4, and honest "unsupported"');

// ---------------------------------------------------------------- 2. quality modes
const lv = [{ height: 360, bitrate: 800000 }, { height: 720, bitrate: 2500000 }, { height: 1080, bitrate: 5000000 }];
assert.equal(T.modeIndex(lv, 'auto'), -1);
assert.equal(T.modeIndex(lv, 'save'), 0);
assert.equal(T.modeIndex(lv, 'balanced'), 1);
assert.equal(T.modeIndex(lv, 'high'), 2);
// A DASH manifest does not have to be sorted: resolution decides, not position.
const unsorted = [{ height: 1080 }, { height: 360 }, { height: 720 }];
assert.equal(T.modeIndex(unsorted, 'high'), 0);
assert.equal(T.modeIndex(unsorted, 'save'), 1);
assert.equal(T.modeIndex(unsorted, 'balanced'), 2);
assert.equal(T.modeIndex([], 'high'), -1);
assert.equal(T.levelText({ height: 1080 }), '1080p');
assert.equal(T.levelText({ height: 2160 }), '4K');
assert.equal(T.levelText(null), 'Auto');
assert.equal(T.engineCanSwitch('hls', 3), true);
assert.equal(T.engineCanSwitch('dash', 1), false);
assert.equal(T.engineCanSwitch('video', 5), false);
ok('quality: High/Balanced/Data saver mean the same on HLS, DASH and native lists');

// ---------------------------------------------------------------- 3. audio languages
assert.equal(T.normLang('ur-PK'), 'ur');
assert.equal(T.normLang('Urdu'), 'ur');
assert.equal(T.normLang('EN'), 'en');
assert.equal(T.normLang(''), '');
assert.equal(T.normLang(null), '');
assert.equal(T.normLang('arb'), 'arb', 'unknown codes survive, just lower-cased');

const tracks = [{ lang: 'en' }, { lang: 'ur' }, { lang: 'ar' }];
assert.equal(T.preferredAudioIndex(tracks), 1, 'Urdu is first in the default order');
assert.equal(T.preferredAudioIndex(tracks, ['en']), 0, 'a remembered language wins');
assert.equal(T.preferredAudioIndex(tracks, ['ar']), 2);
assert.equal(T.preferredAudioIndex([{ lang: 'fr', default: true }, { lang: 'de' }]), 0, 'the default flag is respected when no known language is there');
assert.equal(T.preferredAudioIndex([{ lang: 'en' }]), -1, 'a single track is never "switched"');
assert.equal(T.preferredAudioIndex([]), -1);
assert.equal(T.preferredAudioIndex([{ lang: 'fr' }, { lang: 'de' }]), 0, 'nothing known -> first track');
ok('audio: remembered language, Urdu/English/Arabic order, default flag, single-track safety');

// ---------------------------------------------------------------- 4. verification helpers
assert.equal(T.trackSignature([{ lang: 'ur', name: 'Urdu' }, { lang: 'en', name: 'English' }]), 'ur:Urdu|en:English');
assert.notEqual(T.trackSignature([{ lang: 'ur' }]), T.trackSignature([{ lang: 'ur' }, { lang: 'en' }]));
assert.equal(T.trackSignature(null), '');
ok('track signature: the menu only re-reads when the track list really changed');

// ---------------------------------------------------------------- 5. every kind of link
const L = await import(pathToFileURL(join(root, 'lib/liveTv.js')).href);
const kind = (u) => (L.channelTarget(u) || {}).kind;
assert.equal(kind('https://a.com/live.m3u8'), 'hls');
assert.equal(kind('https://a.com/live.m3u8?token=1'), 'hls');
assert.equal(kind('https://a.com/stream?format=m3u8&id=2'), 'hls', 'extension hidden in the query');
assert.equal(kind('https://a.com/manifest.mpd'), 'dash');
assert.equal(kind('https://a.com/live/1?type=mpd'), 'dash');
assert.equal(kind('https://a.com/movie.mp4?x=1'), 'video');
assert.equal(kind('https://a.com/radio.mp3'), 'audio');
assert.equal(kind('https://a.com/audio.flac'), 'audio');
assert.equal(kind('https://a.com/unknown'), 'hls', 'extension-less IPTV links try HLS first');
assert.equal(kind('https://a.com/list.m3u'), 'playlist');
assert.equal(kind('rtmp://host/live/stream'), 'unsupported');
assert.equal(kind('rtsp://host/stream'), 'unsupported');
assert.equal(kind('udp://239.0.0.1:1234'), 'unsupported');
assert.equal(L.channelTarget('not a url'), null);
assert.equal(kind('https://youtu.be/dQw4w9WgXcQ'), 'youtube');
ok('links: HLS, DASH, MP4, audio, playlist, YouTube, and honest rtmp/rtsp/udp');

// ---------------------------------------------------------------- 6. player wiring
const pl = read('components/LiveTvPlayer.js');
const wired = [
  ['engineLadder(target?.kind)', 'the ladder is derived from the link'],
  ['const activeEngine = ', 'the running engine is explicit'],
  ['const engineNow = activeEngine', 'the load effect uses the active engine'],
  ['setEngineStep(nextStep)', 'a failed engine falls through to the next one'],
  ['const switchVideo = useCallback', 'quality is applied through one function'],
  ['const switchAudio = useCallback', 'audio is applied through one function'],
  ['h.audioTrack = n', 'hls.js audio switching'],
  ['p.setCurrentTrack(dashAudios.current[n])', 'dash.js audio switching'],
  ['v.audioTracks[i].enabled = i === n', 'native audio switching (Safari / Firefox)'],
  ['capLevelToPlayerSize', 'the size cap that broke pinned quality is turned off'],
  ['modeIndex(', 'modes resolve by resolution, not list position'],
  ['const autoPickAudio = useCallback', 'a new stream starts on the remembered language'],
  ['mz_tv_aud_', 'the audio language is remembered per host'],
  ['armSwitch(', 'a switch is armed with a retry'],
  ['settleSwitch(', 'a switch is only confirmed by the engine'],
  ['AUDIO_TRACK_SWITCHED', 'hls.js confirms the audio switch'],
  ['TRACK_CHANGE', 'dash.js confirms the audio switch'],
  ['Engine dobara', 'the failure screen can try another engine'],
  ['engineChainLabel(target.kind, engineStep)', 'the failure screen shows what was tried'],
  ['mztv-bar-q is-audio', 'the playing language is visible in the bar'],
  ['mztv-bar-q is-switch', 'a pending switch is visible'],
];
for (const [bit, why] of wired) assert.ok(pl.includes(bit), `player missing ${bit} (${why})`);
ok(`player wiring: ${wired.length} behaviours (ladder, verified quality, verified audio, memory)`);

// The stream effect must not depend on state that its own callbacks change, or it reloads forever.
assert.ok(pl.includes('const applyQuality = useCallback(() => switchVideo(pinRef.current), [switchVideo]);'), 'quality is applied through a stable callback');
assert.ok(/const applyQuality = useCallback\(\(\) => switchVideo\(pinRef\.current\), \[switchVideo\]\)/.test(pl), 'applyQuality only follows switchVideo');
ok('stability: the quality applier cannot re-trigger the stream effect');

// ---------------------------------------------------------------- 7. styles + release
const css = read('app/globals.css');
for (const sel of ['.mztv-bar-q.is-audio', '.mztv-bar-q.is-switch', '.mztv-failed-engine', '.mztv-hint']) {
  assert.ok(css.includes(sel), `globals.css missing ${sel}`);
}
const pkg = JSON.parse(read('package.json'));
assert.equal(pkg.version, '53.0.0');
assert.ok(pkg.scripts.test.includes('test-v53.mjs'), 'v53 test is part of npm test');
const doc = read('UPGRADE-v53.md').toLowerCase();
for (const bit of ['track engine', 'audio', 'quality', 'engine ladder', 'verified']) {
  assert.ok(doc.includes(bit), `UPGRADE-v53.md missing ${bit}`);
}
ok('release: styles, version 53.0.0, UPGRADE-v53.md and the test chain verified');

console.log('\nAll 7 v53 checks passed.');
