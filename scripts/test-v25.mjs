// v25 tests: tools hub (formulas, registry, links), Live TV channel pages and groups, site search, blog links. Run: node scripts/test-v25.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const imp = (f) => import(pathToFileURL(path.join(root, f)).href);
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const ok = (m) => console.log(`ok    ${m}`);

const L = await imp('lib/toolsLogic.js');
assert.equal(L.calc('2+3*4').value, 14); assert.equal(L.calc('(2+3)*4').value, 20); assert.equal(L.calc('2^3^2').value, 512);
assert.equal(L.calc('sqrt(16)+sin(90)').value, 5); assert.equal(L.calc('50%*200').value, 100); assert.equal(L.calc('-2^2').value, -4);
for (const bad of ['process.exit()', 'require("fs")', '1/0', '2+', '(1', 'alert(1)', '__proto__']) assert.equal(L.calc(bad).ok, false, bad);
ok('calculator: precedence, functions, and it never runs code');
const z = L.zakat({ cash: 1000000, silverPerG: 200, debts: 100000 });
assert.equal(Math.round(z.zakat), 22500); assert.equal(z.due, true);
assert.equal(L.zakat({ cash: 10000, silverPerG: 200 }).due, false);   // below nisab: nothing due
assert.equal(L.zakat({ cash: 1000000 }).due, false);                    // no price entered: it must not claim zakat is due
assert.ok(Math.abs(L.NISAB_SILVER_G - 52.5 * L.GRAMS_PER_TOLA) < 0.01); assert.ok(Math.abs(L.NISAB_GOLD_G - 7.5 * L.GRAMS_PER_TOLA) < 0.01);
ok('zakat: 2.5% after debts, nisab check, no price = not due, nisab = 52.5 / 7.5 tola');
assert.equal(L.convertUnit('Land', 'kanal', 'marla', 1), 20); assert.ok(Math.abs(L.convertUnit('Gold', 'tola', 'gram', 1) - 11.664) < 1e-9);
assert.equal(Math.round(L.convertUnit('Temperature', 'celsius', 'fahrenheit', 100)), 212); assert.equal(L.convertUnit('Land', 'acre', 'kanal', 1), 8);
ok('units: marla, kanal, acre, tola, temperature');
assert.equal(L.rupeesInWords(100000), 'One lakh rupees only'); assert.equal(L.rupeesInWords(1234567.5), 'Twelve lakh thirty-four thousand five hundred sixty-seven rupees and fifty paisa only'); assert.equal(L.toWords(0), 'zero');
const e = L.emi(1000000, 12, 12); assert.ok(Math.abs(e.emi - 88848.79) < 0.01); assert.equal(L.emi(120000, 0, 12).emi, 10000);
assert.deepEqual(L.discount(1000, 20, 10).final, 720); assert.equal(L.margin(80, 100).margin, 20); assert.equal(L.margin(80, 100).markup, 25);
assert.ok(Math.abs(L.tax(118, 18, true).base - 100) < 1e-9);
ok('money: words, EMI, discount (two steps), margin vs markup, tax');
assert.deepEqual(L.chmod({ r: [1, 1, 1], w: [1, 0, 0], x: [1, 1, 1] }), { octal: '755', symbolic: 'rwxr-xr-x' });
assert.equal(L.cronText('*/5 * * * *'), 'Every 5 minutes'); assert.equal(L.cronText('30 3 * * 1-5'), 'At 03:30, on Monday to Friday'); assert.match(L.cronText('1 2 3'), /5 fields/);
assert.equal(L.b64.dec(L.b64.enc('سلام 👋')), 'سلام 👋'); assert.deepEqual(L.hexToRgb('#0af'), { r: 0, g: 170, b: 255 });
ok('developer: chmod, cron words, base64 with Urdu and emoji, colours');
const h = L.hijriOf(new Date(Date.UTC(2026, 9, 23))); assert.ok(h && h.year >= 1447 && h.year <= 1448);
const back = L.gregorianFromHijri(h.year, h.month, h.day); assert.equal(back.toISOString().slice(0, 10), '2026-10-23');
const q = L.qibla(31.1, 74.45); assert.ok(q.bearing > 250 && q.bearing < 270, String(q.bearing)); assert.ok(L.qibla(21.4225, 39.8262).km < 1);
assert.equal(L.ageOf('2010-03-10', new Date(Date.UTC(2026, 9, 23))).years, 16); assert.equal(L.daysBetween('2026-10-23', '2026-12-25').days, 63);
ok('dates: Hijri both ways, Qibla for Lahore area, age, days between');
assert.equal(L.slugify('Zakat Calculator — Pakistan (2026)!'), 'zakat-calculator-pakistan-2026'); assert.equal(L.waLink('0300-1234567', 'Hi there'), 'https://wa.me/923001234567?text=Hi%20there'); assert.equal(L.waLink('12', ''), '');
assert.ok(L.keywordIdeas('sandal').length > 100 && L.keywordIdeas('x').length === 0); assert.equal(L.caseConvert('hello big world', 'title'), 'Hello Big World');
ok('text and SEO: slug, WhatsApp number to link, keyword ideas, case');

// registry <-> runner <-> blog
const { TOOLS, GROUP_BLOG, TOOL_GROUPS, getTool, relatedTools, searchTools } = await imp('lib/tools.js');
assert.ok(TOOLS.length >= 30);
assert.equal(new Set(TOOLS.map((t) => t.slug)).size, TOOLS.length);
const groupIds = TOOL_GROUPS.map((g) => g[0]);
for (const t of TOOLS) { assert.ok(groupIds.includes(t.group), t.slug); assert.ok(t.faq.length >= 2 && t.keywords.length >= 4 && t.short.length > 20, t.slug); }
const runner = read('components/tools/ToolRunner.js');
for (const t of TOOLS) assert.ok(runner.includes(`'${t.slug}':`), `runner lacks ${t.slug}`);
ok(`tools registry: ${TOOLS.length} tools, unique slugs, FAQ and keywords, every tool has a screen`);
const posts = new Set(fs.readdirSync(path.join(root, 'content/blog')).map((f) => f.replace(/\.md$/, '')));
for (const g of groupIds) assert.ok(posts.has(GROUP_BLOG[g]), `blog for ${g} missing`);
let bad = [];
for (const f of fs.readdirSync(path.join(root, 'content/blog'))) {
  const s = read(`content/blog/${f}`);
  for (const m of s.matchAll(/\]\(\/tools\/([a-z0-9-]+)\)/g)) if (!getTool(m[1])) bad.push(`${f} -> /tools/${m[1]}`);
  for (const m of s.matchAll(/\]\(\/blog\/([a-z0-9-]+)\)/g)) if (!posts.has(m[1])) bad.push(`${f} -> /blog/${m[1]}`);
}
assert.deepEqual(bad, [], bad.join('\n'));
ok('blog: every group has a guide and every /tools and /blog link in all posts points to a real page');
assert.equal(relatedTools('zakat-calculator').length, 6); assert.ok(searchTools('marla').some((t) => t.slug === 'unit-converter')); assert.ok(searchTools('zakat nisab')[0].slug === 'zakat-calculator');
ok('tool search finds marla and zakat');

// Live TV
const T = await imp('lib/liveTv.js');
const chans = [{ name: 'Geo News', url: 'https://a.example/1.m3u8' }, { name: 'Geo News', url: 'https://a.example/2.m3u8' }, { name: 'سماء', url: 'https://a.example/3.m3u8' }, { name: 'ARY & Co', url: 'https://a.example/4.m3u8', off: true }];
const sl = T.channelSlugs(chans); assert.deepEqual(sl, ['geo-news', 'geo-news-2', 'channel-3', 'ary-and-co']);
assert.equal(new Set(sl).size, sl.length);
const gr = T.channelGroups([{ group: 'News' }, { group: 'News' }, { group: 'Kids' }, { group: 'News', off: true }, {}]); assert.deepEqual(gr, [{ name: 'News', count: 2 }, { name: 'Kids', count: 1 }, { name: 'Other', count: 1 }]);
assert.ok(T.TV_PRESETS.length >= 8 && T.TV_PRESETS.every(([n, u]) => n && /^https:\/\/iptv-org\.github\.io\/iptv\/.+\.m3u$/.test(u)));
ok('live tv: one unique slug per channel (Urdu names too), groups counted, presets are https');
const pg = read('app/live/[slug]/page.js'); assert.ok(/notFound\(\)/.test(pg) && /noindex|robots: \{ index: false/.test(pg), 'unknown or switched-off channel must be 404 / not indexed');
const pl = read('components/LiveTvPlayer.js'); for (const k of ['mz_tv_fav', 'autoSkip', 'MAX_AUTO_SKIPS', 'requestFullscreen', 'ArrowRight']) assert.ok(pl.includes(k), k);
ok('live tv: channel page 404s for a missing channel; player has favourites, auto-skip, full screen, keyboard');

// Site search
const S = await imp('lib/siteSearch.js');
const r = S.siteSearch('geo', { channels: chans, posts: [{ title: 'Geo guide', description: 'x', slug: 'g' }], surahs: [{ name: 'Yasin', n: 36 }], books: [['bukhari', 'Sahih al-Bukhari', 'x']] });
assert.equal(r.channels.length, 2); assert.equal(r.posts.length, 1);
assert.equal(S.siteSearch('bukhari', { books: [['bukhari', 'Sahih al-Bukhari', 'x']] }).hadith.length, 1); assert.equal(S.siteSearch('yasin', { surahs: [{ name: 'Yasin', n: 36 }] }).quran.length, 1);
assert.equal(S.siteSearch('ary', { channels: chans }).channels.length, 0, 'a switched-off channel is never listed');
assert.equal(S.siteSearch('a', {}).tools.length, 0); assert.ok(S.siteSearch('zakat', {}).tools.length >= 1);
ok('site search: channels (not the off ones), posts, surahs, hadith books, tools');

// wiring
assert.ok(/\/tools/.test(read('app/sitemap.js')) && /channelSlugs/.test(read('app/sitemap.js')));
assert.ok(/'\/tools'/.test(read('components/SiteGate.js')) && /'\/live'/.test(read('components/SiteGate.js')));
assert.ok(/HomeHub/.test(read('app/page.js')) && /\/search/.test(read('components/SearchBox.js')) && /\/tools/.test(read('components/Header.js')));
for (const f of ['app/tools/[slug]/page.js', 'app/tools/page.js', 'app/live/page.js', 'app/live/[slug]/page.js', 'app/hadith/page.js', 'app/quran/page.js', 'app/search/page.js']) assert.ok(/ProductAds/.test(read(f)), `${f} has no product strip`);
assert.ok(/noindex: true/.test(read('app/search/page.js')));
ok('wiring: sitemap, shop-closed allow list, home hub, header, search box, product strips on every section');
for (const f of fs.readdirSync(path.join(root, 'components/tools'))) { const s = read(`components/tools/${f}`); assert.ok(!/eval\(|new Function|dangerouslySetInnerHTML/.test(s), `${f} must not eval or inject html`); }
ok('tools: no eval, no new Function, no raw html');
