// v27 tests: the live channel programming (deterministic wall-clock program), the m3u8 builder, the Pakistan clock,
// the WAV helper and the cleaners. Run: node scripts/test-v27.mjs
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const L = await import(pathToFileURL(path.join(root, 'lib/liveChannel.js')).href);

// ---- cleaning -----------------------------------------------------------------------------------------------------
const c = L.cleanChannel({
  mode: 'evil', title: '<b>Tilawat</b>', quranMin: 999, hadithMin: -5, startSurah: 200, reciter: 'nobody',
  windows: [{ start: '09:00', end: '09:30', days: [1, 9, 3] }, { start: '25:00', end: '10:00' }],
  hadith: { books: ['bukhari', 'nope', 'bukhari'], lang: 'klingon', voiceName: 'Unknown' },
  ads: { enabled: true, slugs: ['ok-slug', 'bad slug!', 'ok-slug'], seconds: 999, voiceName: 'Kore' },
  youtube: { privacy: 'secret', last: { broadcastId: 'abc', streamKey: 'k', rtmpUrl: 'javascript:alert(1)' } },
});
assert.equal(c.mode, 'schedule');
assert.equal(c.title, 'Tilawat');                       // < > stripped
assert.equal(c.quranMin, 120);                          // clamped
assert.equal(c.hadithMin, 0);
assert.equal(c.startSurah, 114);
assert.equal(c.reciter, 'ar.alafasy');
assert.equal(c.windows.length, 1);
assert.deepEqual(c.windows[0].days, [1, 3]);            // day 9 dropped
assert.deepEqual(c.hadith.books, ['bukhari']);
assert.equal(c.hadith.lang, 'urd');
assert.equal(c.ads.slugs.length, 1);
assert.equal(c.ads.seconds, 120);
assert.equal(c.youtube.privacy, 'public');
assert.equal(c.youtube.last.rtmpUrl, '');               // only rtmp(s):// is accepted
assert.equal(c.youtube.last.broadcastId, 'abc');
assert.equal(L.cleanChannel({ mode: 'always' }).mode, 'always');
assert.equal(L.cleanChannel({ mode: 'off' }).mode, 'off');

// ---- voice ids ---------------------------------------------------------------------------------------------
assert.equal(L.adVoiceId('Winter-Jacket 2'), 'ad-winter-jacket-2');
assert.equal(L.hadithVoiceId('bukhari', 3, 'urd'), 'h-bukhari-3-urd');
assert.ok(L.voiceIdOk('ad-some-product'));
assert.ok(L.voiceIdOk('h-bukhari-3-urd'));
assert.ok(!L.voiceIdOk('h-bukhari-3-urd/../x'));
assert.ok(!L.voiceIdOk('../etc/passwd'));
assert.ok(!L.voiceIdOk(''));

// ---- the programming clock: cycle = [quran 20 min | hadith 10 min | ad 30 s] ---------------------------------------
const cfg = L.cleanChannel({
  quranMin: 20, hadithMin: 10, startSurah: 1,
  hadith: { books: ['bukhari', 'muslim'] },
  ads: { enabled: true, slugs: ['a', 'b'], seconds: 30 },
});
const { parts, cycleSec } = L.segLayout(cfg);
assert.equal(cycleSec, 20 * 60 + 10 * 60 + 30);
assert.deepEqual(parts.map((p) => p.kind), ['quran', 'hadith', 'ad']);

const cyc = (n, sec) => (n * cycleSec + sec) * 1000;
let seg = L.segmentAt(cfg, cyc(5, 100));
assert.equal(seg.kind, 'quran');
assert.equal(seg.cycleIndex, 5);
assert.equal(seg.startMs, cyc(5, 0));
assert.equal(seg.endMs, cyc(5, 1200));
seg = L.segmentAt(cfg, cyc(5, 1300));
assert.equal(seg.kind, 'hadith');
assert.equal(seg.startMs, cyc(5, 1200));
assert.equal(seg.endMs, cyc(5, 1800));
seg = L.segmentAt(cfg, cyc(5, 1810));
assert.equal(seg.kind, 'ad');
assert.equal(seg.slug, 'b');                             // cycle 5 -> ads[5 % 2]
assert.equal(seg.voiceId, 'ad-b');
assert.equal(seg.endMs - seg.startMs, 30000);

// ---- the endless tilawat: position is a pure function of the wall clock --------------------------------------------
assert.deepEqual(L.ayahFromGlobal(0), { surah: 1, ayah: 1 });
assert.deepEqual(L.ayahFromGlobal(7), { surah: 2, ayah: 1 });
assert.deepEqual(L.ayahFromGlobal(6235), { surah: 114, ayah: 6 });
for (const [s, a] of [[1, 1], [2, 1], [2, 286], [114, 6], [67, 30]]) {
  assert.deepEqual(L.ayahFromGlobal(L.globalAyah(s, a) - 1), { surah: s, ayah: a });
}
// at the very start of a cycle: start surah 1, ayah 1
assert.deepEqual((({ surah, ayah }) => ({ surah, ayah }))(L.quranPoint(cfg, cyc(0, 0))), { surah: 1, ayah: 1 });
// one AYAH_SEC later: the next ayah
assert.deepEqual((({ surah, ayah }) => ({ surah, ayah }))(L.quranPoint(cfg, cyc(0, L.AYAH_SEC))), { surah: 1, ayah: 2 });
// only the QURAN seconds of the cycles count: one full cycle later we are exactly 20 minutes deeper
assert.deepEqual((({ surah, ayah }) => ({ surah, ayah }))(L.quranPoint(cfg, cyc(1, 0))),
  (({ surah, ayah }) => ({ surah, ayah }))(L.quranPoint(cfg, cyc(0, 0) + 20 * 60 * 1000)));
// wrapping at the end of the Quran back to the start
const endCfg = L.cleanChannel({ ...cfg, startSurah: 114 });
const p = L.quranPoint(endCfg, cyc(0, 6 * L.AYAH_SEC));
assert.deepEqual({ surah: p.surah, ayah: p.ayah }, { surah: 1, ayah: 1 });
// the run of a block carries real audio addresses
const run = L.quranRun(cfg, cyc(0, 0), 3);
assert.equal(run.length, 3);
assert.equal(run[0].surah, 1); assert.equal(run[0].ayah, 1);
assert.equal(run[1].surah, 1); assert.equal(run[1].ayah, 2);
assert.ok(run[0].au.startsWith('https://cdn.islamic.network/'));

// ---- hadith + ad rotation ------------------------------------------------------------------------------------------
const h0 = L.hadithPoint(cfg, cyc(0, 1250));
const h1 = L.hadithPoint(cfg, cyc(1, 1250));
const h2 = L.hadithPoint(cfg, cyc(2, 1250));
assert.equal(h0.book, 'bukhari'); assert.equal(h0.section, 1);
assert.equal(h1.book, 'muslim'); assert.equal(h1.section, 1);
assert.equal(h2.book, 'bukhari'); assert.equal(h2.section, 2);  // round 1 -> section 2
assert.equal(h0.voiceId, L.hadithVoiceId('bukhari', 1, 'urd'));
assert.deepEqual([L.adPoint(cfg, cyc(0, 1810)).slug, L.adPoint(cfg, cyc(1, 1810)).slug], ['a', 'b']);
assert.equal(L.adPoint(L.cleanChannel({ ads: { enabled: false, slugs: ['a'] } }), cyc(0, 1810)), null);

// ---- the m3u8 playlist --------------------------------------------------------------------------------------
const base = 'https://shop.example';
const m3u = L.buildM3U8(cfg, cyc(0, 0), 4, { base, endlist: true, resolve: (s) => (s.voiceId ? `${base}/api/live/voice/${s.voiceId}.wav` : null) });
assert.ok(m3u.startsWith('#EXTM3U\n'));
assert.ok(m3u.includes('#EXT-X-TARGETDURATION:'));
assert.ok(m3u.includes('#EXT-X-ENDLIST'));
const urls = m3u.split('\n').filter((l) => l && !l.startsWith('#'));
assert.ok(urls.length > 4);                                // quran segments expand into one file per ayah
assert.ok(urls.every((u) => u.startsWith('https://')));
assert.ok(urls.some((u) => u.includes('cdn.islamic.network')));   // the tilawat
assert.ok(urls.some((u) => u.includes('/api/live/voice/ad-')));   // the ad voiceover
assert.ok(urls.some((u) => u.includes('/api/live/voice/h-')));    // the hadith voiceover
assert.ok(m3u.split('\n').filter((l) => l.startsWith('#EXTINF:')).length === urls.length);
// no voiceover at all -> the stream is NEVER silent: the slots fall back to Quran audio
const fill = L.buildM3U8(cfg, cyc(0, 0), 3, { base, resolve: () => null });
assert.ok(fill.includes('cdn.islamic.network'));
assert.ok(!fill.includes('/api/live/voice/'));
// without endlist it stays a live window
assert.ok(!L.buildM3U8(cfg, cyc(0, 0), 3, { base, endlist: false }).includes('#EXT-X-ENDLIST'));

// ---- Pakistan clock (UTC+5) ---------------------------------------------------------------------------------
const clock = L.pktClock(Date.UTC(2026, 9, 21, 18, 30, 5));   // 21 Oct 2026 18:30:05 UTC = 23:30:05 PKT (Wednesday)
assert.equal(clock.time, '23:30:05');
assert.equal(clock.hm, '23:30');
assert.equal(clock.date, '21 Oct 2026');
assert.equal(clock.day, 'Wednesday');
assert.equal(clock.tz, 'PKT');

// ---- on-air rules (same semantics as the Quran session) ------------------------------------------------------
const win = L.cleanChannel({ mode: 'schedule', windows: [{ start: '05:00', end: '12:00', days: [] }] });
assert.equal(L.channelStatus(win, Date.UTC(2026, 9, 21, 4, 10)).onAir, true);    // 09:10 PKT
assert.equal(L.channelStatus(win, Date.UTC(2026, 9, 21, 14, 0)).onAir, false);   // 19:00 PKT
assert.equal(L.channelStatus({ ...win, mode: 'off' }, Date.UTC(2026, 9, 21, 4, 10)).onAir, false);
assert.equal(L.channelStatus({ ...win, liveUntil: Date.UTC(2026, 9, 21, 6, 0) }, Date.UTC(2026, 9, 21, 5, 0)).why, 'manual');
assert.equal(L.channelStatus({ ...win, mode: 'off', liveUntil: Date.UTC(2026, 9, 21, 6, 0) }, Date.UTC(2026, 9, 21, 5, 0)).onAir, false); // "off" wins (same rule as the Quran session)
assert.equal(L.channelStatus({ ...win, mode: 'always' }, Date.UTC(2026, 9, 21, 14, 0)).onAir, true);
const np = L.nowPlaying(cfg, cyc(2, 1350));
assert.equal(np.seg.kind, 'hadith');
assert.equal(np.next.length, 2);
assert.ok(np.progress >= 0 && np.progress <= 1);

// ---- cast budget: the "master timing" of the 24/7 action -----------------------------------------------------------
// always-on: the full request, no cut
let b = L.castBudget(L.cleanChannel({ mode: 'always' }), Date.UTC(2026, 9, 21, 4, 10), 330);
assert.deepEqual([b.ok, b.minutes, b.why], [true, 330, 'always']);
// a 5:00-12:00 window at 09:10 PKT: 2h50m left, minus the 2-minute safety margin -> 168 minutes cut
b = L.castBudget(win, Date.UTC(2026, 9, 21, 4, 10), 330);
assert.deepEqual([b.ok, b.minutes], [true, 168]);
assert.equal(b.endsAtMs > Date.UTC(2026, 9, 21, 4, 10), true);
// a short request is never lengthened
b = L.castBudget(win, Date.UTC(2026, 9, 21, 4, 10), 45);
assert.equal(b.minutes, 45);
// 2 minutes before the window ends: do not start (the next baton catches the next window)
b = L.castBudget(win, Date.UTC(2026, 9, 21, 6, 58, 30), 330);   // 11:58:30 PKT
assert.deepEqual([b.ok, b.why], [false, 'window-ending']);
// off air: only --force starts, with the full budget
b = L.castBudget(win, Date.UTC(2026, 9, 21, 14, 0), 330);
assert.equal(b.ok, false);
b = L.castBudget(win, Date.UTC(2026, 9, 21, 14, 0), 330, { force: true });
assert.deepEqual([b.ok, b.minutes, b.why], [true, 330, 'forced']);
// the budget is capped at the GitHub job limit
b = L.castBudget(L.cleanChannel({ mode: 'always' }), Date.UTC(2026, 9, 21, 4, 10), 10000);
assert.equal(b.minutes, L.CAST_MAX_MIN);
assert.equal(L.CAST_MAX_MIN <= 350, true);
// a manual "go live now" is honored with its own end
b = L.castBudget(L.cleanChannel({ mode: 'always', liveUntil: Date.UTC(2026, 9, 21, 5, 0) }), Date.UTC(2026, 9, 21, 4, 10), 330);
assert.deepEqual([b.ok, b.minutes], [true, 48]);   // 50 min left minus 2

// ---- WAV helper (the AI voiceover files) ---------------------------------------------------------------------
const wav = L.pcmToWav(Buffer.alloc(100, 7), 24000);
assert.equal(wav.length, 144);
assert.equal(wav.slice(0, 4).toString(), 'RIFF');
assert.equal(wav.readUInt32LE(4), 136);
assert.equal(wav.slice(8, 12).toString(), 'WAVE');
assert.equal(wav.slice(12, 16).toString(), 'fmt ');
assert.equal(wav.readUInt32LE(16), 16);
assert.equal(wav.readUInt16LE(20), 1);                  // PCM
assert.equal(wav.readUInt16LE(22), 1);                  // mono
assert.equal(wav.readUInt32LE(24), 24000);
assert.equal(wav.readUInt32LE(28), 48000);
assert.equal(wav.readUInt16LE(32), 2);
assert.equal(wav.readUInt16LE(34), 16);
assert.equal(wav.slice(36, 40).toString(), 'data');
assert.equal(wav.readUInt32LE(40), 100);
assert.equal(L.silenceWav(2).length, 44 + 2 * 24000 * 2);
assert.equal(L.silenceWav(99).length, 44 + 30 * 24000 * 2);  // capped at 30 s

// ---- ticker --------------------------------------------------------------------------------------------
assert.ok(L.TICKER_DEFAULT.length >= 4);
assert.deepEqual(L.tickerLines({ ticker: 'A | B |  C ' }), ['A', 'B', 'C']);
assert.equal(L.tickerLines({ ticker: '' }).length, L.TICKER_DEFAULT.length);

console.log('test-v27: all good');
