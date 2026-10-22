// v23 tests: Quran logic, deals logic, Studio (injection) safety, AI manager repo guard. Run: node scripts/test-v23.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const imp = (f) => import(pathToFileURL(path.join(root, f)).href);

const Q = await imp('lib/quran.js');
assert.equal(Q.SURAHS.length, 114);
assert.equal(Q.SURAHS.reduce((a, s) => a + s.ayat, 0), Q.TOTAL_AYAT);
assert.equal(Q.globalAyah(114, 6), 6236);
assert.equal(Q.globalAyah(2, 1), 8);
// cleaning
const c = Q.cleanQuran({ surah: 999, from: 500, to: 3, reciter: 'evil', windows: [{ start: '25:00', end: '09:30' }, { start: '09:00', end: '09:30', days: [1, 9, 5] }] });
assert.equal(c.surah, 114); assert.ok(c.from <= 6); assert.equal(c.reciter, 'ar.alafasy'); assert.equal(c.windows.length, 1); assert.deepEqual(c.windows[0].days, [1, 5]);
// schedule in Pakistan time (UTC+5): 09:10 PKT = 04:10 UTC
const cfg = { mode: 'schedule', windows: [{ start: '09:00', end: '09:30', days: [] }] };
assert.equal(Q.quranStatus(cfg, Date.UTC(2026, 9, 21, 4, 10)).live, true);
assert.equal(Q.quranStatus(cfg, Date.UTC(2026, 9, 21, 4, 40)).live, false);
assert.equal(Q.quranStatus({ ...cfg, mode: 'off' }, Date.UTC(2026, 9, 21, 4, 10)).live, false);
assert.equal(Q.quranStatus({ ...cfg, mode: 'off', liveUntil: 0 }, 0).live, false);
assert.equal(Q.quranStatus({ ...cfg, liveUntil: Date.UTC(2026, 9, 21, 6, 0) }, Date.UTC(2026, 9, 21, 5, 0)).why, 'manual');
// midnight-crossing window and day filter (21 Oct 2026 is a Wednesday = 3)
const night = { mode: 'schedule', windows: [{ start: '23:30', end: '00:30', days: [3] }] };
assert.equal(Q.quranStatus(night, Date.UTC(2026, 9, 21, 18, 45)).live, true);   // 23:45 PKT Wednesday
assert.equal(Q.quranStatus(night, Date.UTC(2026, 9, 21, 19, 15)).live, true);   // 00:15 PKT Thursday: still Wednesday's window
assert.equal(Q.quranStatus(night, Date.UTC(2026, 9, 22, 18, 45)).live, false);  // Thursday 23:45
// API answer parsing + Bismillah split
const bism = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ';
assert.deepEqual(Q.splitBismillah(`${bism} قُلْ هُوَ ٱللَّهُ أَحَدٌ`), { bism: true, text: 'قُلْ هُوَ ٱللَّهُ أَحَدٌ' });
assert.equal(Q.splitBismillah('قُلْ هُوَ ٱللَّهُ أَحَدٌ').bism, false);
const j = { data: [
  { number: 112, name: 'x', edition: { identifier: 'quran-uthmani' }, ayahs: [{ numberInSurah: 1, text: `${bism} قُلْ هُوَ ٱللَّهُ أَحَدٌ` }, { numberInSurah: 2, text: 'ٱللَّهُ ٱلصَّمَدُ' }] },
  { edition: { identifier: 'ur.jalandhry' }, ayahs: [{ text: 'a' }, { text: 'b' }] },
  { edition: { identifier: 'ar.alafasy' }, ayahs: [{ audio: 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/6222.mp3' }, { audio: 'http://bad' }] },
] };
const p = Q.parseSurahResponse(j, { reciter: 'ar.alafasy', translation: 'ur.jalandhry' });
assert.equal(p.surah, 112); assert.equal(p.ayahs[0].bism, true); assert.equal(p.ayahs[0].tr, 'a');
assert.ok(p.ayahs[0].au.startsWith('https://')); assert.equal(p.ayahs[1].au, Q.fallbackAudio(112, 2));
const sh = Q.wordShares('أ بب ججج'); assert.equal(sh.length, 3); assert.equal(sh[0].start, 0); assert.ok(sh[2].start > sh[1].start);

const D = await imp('lib/deals.js');
const card = (id, price, cmp, extra = {}) => ({ id, slug: id, name: id, price, comparePrice: cmp, inStock: true, categories: ['Shoes'], category: 'Shoes', createdAt: 1, ...extra });
const cards = [card('a', 80, 100), card('b', 50, 100), card('c', 100, 100), card('d', 40, 100, { inStock: false }), card('e', 97, 100)];
assert.deepEqual(D.dealList(cards, { minPct: 5 }).map((x) => x.id), ['b', 'a']);
assert.deepEqual(D.dealList(cards, { minPct: 30 }).map((x) => x.id), ['b']);
assert.deepEqual(D.dealList(cards, { minPct: 5, pinned: ['c'] }).map((x) => x.id)[0], 'c');
assert.equal(D.dealList(cards, { minPct: 5, cat: 'bags' }).length, 0);
assert.equal(D.cleanDeals({ minPct: 500, pinned: 'A b, c' }).minPct, 90);
assert.deepEqual(D.cleanDeals({ pinned: 'A b, c' }).pinned, ['a', 'b', 'c']);

const I = await imp('lib/inject.js');
const bad = I.cleanItem({ type: 'html', code: '<div onclick="x()">hi<script>alert(1)</script><a href="javascript:alert(1)">t</a><iframe src=x></iframe></div>' });
assert.ok(!/script|onclick|javascript:|iframe/i.test(bad.code), bad.code);
assert.ok(!/@import/.test(I.cleanItem({ type: 'css', code: '@import url(x); a{color:red}' }).code));
assert.equal(I.cleanItem({ type: 'js', code: '   ' }), null);
assert.equal(I.cleanItem({ type: 'php', code: 'x' }), null);
assert.equal(I.cleanPages('/admin/x,/products'), '/products');
assert.equal(I.pageMatches('/products,/deals', '/deals'), true);
assert.equal(I.pageMatches('home', '/deals'), false);
const cfgI = I.cleanInject({ effects: ['reveal', 'evil'], items: [{ type: 'css', code: 'a{}', enabled: false }, { type: 'js', code: '1', id: 'x' }] });
assert.deepEqual(cfgI.effects, ['reveal']);
assert.equal(I.injectForViewer(cfgI).items.length, 1);
assert.equal(I.injectForViewer({ ...cfgI, disabled: true }).items.length, 0);

// AI manager repo guard (the same patterns as lib/aiManager.js)
const src = fs.readFileSync(path.join(root, 'lib/aiManager.js'), 'utf8');
const allow = new RegExp(src.match(/REPO_ALLOW = \/(.*)\/;/)[1]);
const deny = new RegExp(src.match(/REPO_DENY = \/(.*)\/;/)[1]);
const ok = (x) => allow.test(x) && !deny.test(x);
assert.equal(ok('components/NewThing.js'), true);
assert.equal(ok('app/admin/foo/page.js'), true);
assert.equal(ok('.env'), false); assert.equal(ok('lib/adminAuth.js'), false); assert.equal(ok('lib/firebase-admin.js'), false);
assert.equal(ok('app/../.env'), false); assert.equal(ok('package.json'), false); assert.equal(ok('firestore.rules'), false); assert.equal(ok('.github/workflows/D.yml'), false);

// ---- v23.1: live radio pointer
const S = await imp('lib/quranState.js');
assert.deepEqual(S.cleanState({ surah: 36, ayah: 9999 }), { surah: 36, ayah: 83, atMs: 0 });
assert.equal(S.cleanState({ surah: 0, ayah: 1 }), null);
const t0 = 1_000_000;
const here = { surah: 2, ayah: 10, atMs: t0 };
assert.equal(S.acceptMove(here, { surah: 2, ayah: 11, atMs: t0 }, t0 + 5000), true);       // the next ayah
assert.equal(S.acceptMove(here, { surah: 2, ayah: 10, atMs: t0 }, t0 + 5000), true);       // same ayah (second visitor)
assert.equal(S.acceptMove(here, { surah: 50, ayah: 1, atMs: t0 }, t0 + 5000), false);      // a stranger cannot throw the radio away
assert.equal(S.acceptMove(here, { surah: 50, ayah: 1, atMs: t0 }, t0 + 200000), true);      // ...unless nobody moved it for a while
assert.equal(S.acceptMove({ surah: 2, ayah: 286, atMs: t0 }, { surah: 3, ayah: 1, atMs: t0 }, t0 + 5000), true); // next surah
assert.equal(S.acceptMove({ surah: 114, ayah: 6, atMs: t0 }, { surah: 1, ayah: 1, atMs: t0 }, t0 + 5000), true);  // after An-Nas comes Al-Fatiha
assert.equal(S.acceptMove(null, { surah: 5, ayah: 1, atMs: t0 }), true);
assert.deepEqual(S.startPoint({ surah: 18, from: 1 }, null), { surah: 18, ayah: 1, resumed: false });
assert.deepEqual(S.startPoint({ surah: 18, from: 1 }, { surah: 36, ayah: 12 }), { surah: 36, ayah: 12, resumed: true });

// ---- v23.1: deal groups
const G = await imp('lib/dealGroups.js');
const mens = G.cleanGroup({ name: 'Mens catalogue', words: 'men, mens', exclude: 'women, ladies', pct: 20 });
assert.equal(G.matchesGroup({ name: 'Men Cotton Shirt' }, mens), true);
assert.equal(G.matchesGroup({ name: 'Women Cotton Shirt' }, mens), false);
assert.equal(G.matchesGroup({ name: 'Leather Belt', category: 'Mens' }, mens), true);
const shoes = G.cleanGroup({ name: 'Shoes', words: ['shoes'], price: 1499 });
assert.equal(G.matchesGroup({ name: 'Sports Shoe' }, shoes), true);
assert.equal(G.matchesGroup({ name: 'Shirt' }, shoes), false);
assert.equal(G.groupPrice(2000, shoes), 1499);
assert.equal(G.groupPrice(1200, shoes), 0);          // a "deal" that is not lower is no deal
assert.equal(G.groupPrice(1000, mens), 800);
assert.equal(G.cleanGroups([{ name: 'A', words: 'x', pct: 10 }, { name: 'A', words: 'y', pct: 10 }, { name: '' }]).length, 1);
assert.equal(D.cleanDeals({ groups: [{ name: 'Watches', words: 'watch', pct: 15 }] }).groups[0].id, 'watches');

// Every blog has front matter
for (const f of fs.readdirSync(path.join(root, 'content/blog'))) {
  const t = fs.readFileSync(path.join(root, 'content/blog', f), 'utf8');
  const fm = (t.match(/^---\n([\s\S]*?)\n---\n/) || [])[1] || '';
  for (const k of ['title', 'description', 'date']) assert.ok(new RegExp(`^${k}: .+`, 'm').test(fm), `${k} in ${f}`);
}
console.log('\nAll v23 tests passed.');
