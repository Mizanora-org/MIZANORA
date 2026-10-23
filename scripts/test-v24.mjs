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
console.log('\nAll v24 tests passed.');
