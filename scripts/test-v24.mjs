// v24 tests: shop hours, closed-shop Quran, hadith data, review maths and spam check. Run: node scripts/test-v24.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const imp = (f) => import(pathToFileURL(path.join(root, f)).href);
const ok = (m) => console.log(`ok    ${m}`);
const at = (iso) => Date.parse(iso); // the clocks below are UTC; Pakistan = UTC+5

const H = await imp('lib/shopHours.js');
const day = { enabled: true, open: '09:00', close: '23:00' };
assert.equal(H.shopOpenNow(day, at('2026-10-23T05:00:00Z')).open, true);   // 10:00 PKT
assert.equal(H.shopOpenNow(day, at('2026-10-23T19:30:00Z')).open, false);  // 00:30 PKT
assert.equal(H.shopOpenNow(day, at('2026-10-23T03:59:00Z')).open, false);  // 08:59 PKT
assert.equal(H.shopOpenNow(day, at('2026-10-23T04:00:00Z')).open, true);   // 09:00 PKT sharp
assert.equal(H.shopOpenNow({ enabled: false }, at('2026-10-23T19:30:00Z')).open, true);
ok('shop hours: open and closed by Pakistan time, off = always open');
const night = { enabled: true, open: '18:00', close: '02:00', days: [5] }; // Fridays only, shift runs past midnight
assert.equal(H.shopOpenNow(night, at('2026-10-23T14:00:00Z')).open, true);   // Fri 19:00 PKT
assert.equal(H.shopOpenNow(night, at('2026-10-23T19:00:00Z')).open, true);   // Sat 00:00 PKT, belongs to Friday's shift
assert.equal(H.shopOpenNow(night, at('2026-10-24T19:00:00Z')).open, false);  // Sun 00:00 PKT, Saturday's shift: not an open day
assert.equal(H.shopOpenNow(night, at('2026-10-24T14:00:00Z')).open, false);  // Sat 19:00 PKT
ok('shop hours: shift past midnight and day filter');
const bad = H.cleanHours({ enabled: 'yes', open: '25:00', close: 'x', days: [9, -1, 3, 3], closedMessage: '<b>hi</b>' });
assert.equal(bad.enabled, false); assert.equal(bad.open, '09:00'); assert.deepEqual(bad.days, [3]); assert.ok(!bad.closedMessage.includes('<'));
ok('shop hours: garbage input is cleaned');

const G = await imp('lib/siteGate.js').catch(() => null); // needs next/cache: only the source is checked here
const gate = fs.readFileSync(path.join(root, 'lib/siteGate.js'), 'utf8');
assert.ok(gate.includes('hours: cleanHours(d.hours)'));
const layout = fs.readFileSync(path.join(root, 'app/layout.js'), 'utf8');
assert.ok(layout.includes('closed={<><ClosedShop') && layout.includes('<QuranSession cfg={closedQuran} />'));
assert.ok(/maintenance=\{<><Maintenance[^]*?<QuranSession cfg=\{closedQuran\}/.test(layout));
ok('layout: the Quran is mounted on both the shut-down screen and the closed-hours screen');
const Q = await imp('lib/quran.js');
assert.equal(Q.cleanQuran({}).closedPlay, true);
assert.equal(Q.cleanQuran({ closedPlay: false }).closedPlay, false);
assert.equal(Q.quranStatus({ ...Q.QURAN_DEFAULT, mode: 'always' }, at('2026-10-23T19:30:00Z')).live, true);
ok('quran: closedPlay flag, "always" is live at any hour');

const D = await imp('lib/hadith.js');
assert.equal(D.sectionUrl('urd', 'bukhari', 3), 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/urd-bukhari/sections/3.json');
assert.equal(D.okBook('bukhari'), true); assert.equal(D.okBook('../etc'), false); assert.equal(D.okLang('xx'), false);
const sec = D.parseSection({ metadata: { section: { 2: 'Belief' } }, hadiths: [{ hadithnumber: 8, text: '  one   two ', grades: [{ name: 'X', grade: 'Sahih' }, { name: 'Y' }], reference: { book: 2, hadith: 1 } }, { hadithnumber: 9, text: '' }] }, 2);
assert.equal(sec.title, 'Belief'); assert.equal(sec.hadiths.length, 1); assert.equal(sec.hadiths[0].text, 'one two'); assert.deepEqual(sec.hadiths[0].grades, [{ by: 'X', grade: 'Sahih' }]);
assert.equal(D.parseSection({ nope: 1 }, 1), null);
assert.deepEqual(D.parseSectionNames({ metadata: { section: { 2: 'B', 1: 'A', 0: '' } } }), [{ n: 1, name: 'A' }, { n: 2, name: 'B' }]);
assert.equal(D.filterHadiths([{ text: 'Actions are by intentions' }, { text: 'prayer' }], 'ACTIONS intentions').length, 1);
ok('hadith: urls, parsing, grades, section names, search');

const R = await imp('lib/reviewStats.js');
const s = R.summarize([{ rating: 5 }, { rating: 5 }, { rating: 4 }, { rating: 1 }, { rating: 'x' }]);
assert.equal(s.count, 4); assert.equal(s.avg, 3.75); assert.deepEqual(s.dist, [1, 0, 0, 1, 2]); assert.equal(R.summarize([]).avg, 0);
ok('reviews: average and breakdown count only real ratings');
assert.ok(R.reviewProblem('short'));
assert.ok(R.reviewProblem('Great product visit www.shop.com now please'));
assert.ok(R.reviewProblem('Great product call me 0300 1234567 for more'));
assert.ok(R.reviewProblem('aaaaaaaaaaaaaaaaaaaaaaa'));
assert.ok(R.reviewProblem('good good good good good good good good'));
assert.equal(R.reviewProblem('Jootay ka size bilkul theek aaya aur delivery 3 din mein ho gayi.'), '');
ok('reviews: links, phone numbers, repeats and too-short text are refused; a real review passes');
const seeded = fs.readdirSync(path.join(root, 'scripts')).concat(fs.readdirSync(path.join(root, 'lib')));
assert.ok(!seeded.some((f) => /fake|seed.?review/i.test(f)));
ok('no fake-review generator exists in the project');

// ---- Live TV (v24.1)
const T = await imp('lib/liveTv.js');
const m3u = `#EXTM3U\n#EXTINF:-1 tvg-logo="https://x.io/a.png" group-title="News",Channel A\nhttps://x.io/a.m3u8\n#EXTINF:-1,Channel B\nhttp://x.io/b.m3u8\n#EXTINF:-1 group-title="Kids",Channel C, Live\nhttps://x.io/c.m3u8?token=1\n#EXTINF:-1,Dup\nhttps://x.io/a.m3u8\n`;
const pl = T.parseM3U(m3u);
assert.equal(pl.channels.length, 4); assert.equal(pl.skipped, 0); assert.equal(pl.channels[1].url, 'http://x.io/b.m3u8');
assert.equal(pl.channels[0].name, 'Channel A'); assert.equal(pl.channels[0].group, 'News'); assert.equal(pl.channels[0].logo, 'https://x.io/a.png');
assert.equal(pl.channels[2].name, 'Channel C, Live');
assert.equal(T.cleanTv({ channels: pl.channels }).channels.length, 3); // the duplicate url is dropped by cleanTv
assert.equal(T.cleanTv({ channels: [...pl.channels, ...pl.channels] }).channels.length, 3);
ok('live tv: M3U parsing, http kept (played through the relay), duplicates dropped');
assert.equal(T.channelTarget('https://www.youtube.com/watch?v=dQw4w9WgXcQ').kind, 'youtube');
assert.equal(T.channelTarget('https://x.io/live.m3u8?a=1').kind, 'hls');
assert.equal(T.channelTarget('https://x.io/r.mp3').kind, 'audio');
assert.equal(T.channelTarget('https://x.io/v.mp4').kind, 'video');
assert.equal(T.channelTarget('http://x.io/live.m3u8').proxy, true); assert.equal(T.channelTarget('https://x.io/live.m3u8').proxy, false); assert.equal(T.channelTarget('ftp://x.io/a.m3u8'), null);
assert.equal(T.channelTarget('https://www.youtube.com/@name'), null);
ok('live tv: link kinds (youtube, hls, audio, video), http goes through the relay');
const ch = [{ off: false }, { off: true }, { off: false }];
assert.equal(T.stepIndex(ch, 0, 1), 2); assert.equal(T.stepIndex(ch, 2, 1), 0); assert.equal(T.stepIndex(ch, 0, -1), 2); assert.equal(T.stepIndex([], 0, 1), -1);
assert.equal(T.pickAd(['a', 'b'], 0), 'a'); assert.equal(T.pickAd(['a', 'b'], 3), 'b'); assert.equal(T.pickAd([], 1), null);
ok('live tv: next / previous skip switched-off channels and wrap; ads rotate');
const ct = T.cleanTv({ ads: { seconds: 999, skipAfter: -3, slugs: ['ok-slug', '../bad', 'ok-slug'] } });
assert.equal(ct.ads.seconds, 20); assert.equal(ct.ads.skipAfter, 0); assert.deepEqual(ct.ads.slugs, ['ok-slug']); assert.equal(ct.enabled, false);
ok('live tv: settings are cleaned (limits, safe slugs, off by default)');
const imp2 = fs.readFileSync(path.join(root, 'app/api/admin/tv-import/route.js'), 'utf8');
assert.ok(imp2.includes('verifyAdmin') && imp2.includes("redirect: 'error'") && imp2.includes('priv('));
ok('live tv: playlist import is admin only and blocks private addresses');
for (const f of ['muaaz-iqbal-biography-profile-projects-skills', 'muaaz-iqbal-noor-ai-assistant-quran-hadith-live-tv', 'hadith-reader-bukhari-muslim-urdu-english-arabic', 'live-quran-tilawat-urdu-translation-mizanora', 'mizanora-live-tv-channels-m3u-product-ads']) {
  const t = fs.readFileSync(path.join(root, 'content/blog', `${f}.md`), 'utf8');
  assert.ok(/^---\ntitle: .+\nslug: .+\ndescription: .+\ndate: 2026-10-23\n---\n/.test(t), f);
  assert.ok(!/2009|27 ?nov/i.test(t), `${f} must not contain the date of birth`);
}
ok('blogs: 5 new posts have front matter and no date of birth');
console.log('\nAll v24 tests passed.');
