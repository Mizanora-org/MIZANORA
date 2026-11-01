// v36 tests: the founder's own photos on the site, and a blog that can carry 125+ guides.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const P = (f) => path.join(root, f);
const read = (f) => fs.readFileSync(P(f), 'utf8');
const exists = (f) => fs.existsSync(P(f));
let n = 0;
const ok = (msg) => { n++; console.log('ok    ' + msg); };

// ---------------------------------------------------------------------------
// 1. the photos really ship with the shop
// ---------------------------------------------------------------------------
const manifest = JSON.parse(read('data/muaaz-photos.json'));
assert.ok(Array.isArray(manifest.photos) && manifest.photos.length > 0, 'the manifest lists photos');
assert.equal(manifest.group, 'muaaz');

for (const ph of manifest.photos) {
  for (const key of ['src', 'thumb', 'square']) {
    assert.ok(ph[key].startsWith('/img/muaaz/'), `${ph.id}.${key} is served by the shop itself`);
    assert.ok(exists('public' + ph[key]), `public${ph[key]} exists on disk`);
  }
  assert.ok(ph.width > 0 && ph.height > 0, `${ph.id} has real dimensions (no layout jump)`);
  assert.ok(ph.alt && ph.alt.length > 10, `${ph.id} has real alt text`);
  assert.ok(ph.width <= 1200 && ph.height <= 1200, `${ph.id} is not oversized`);
}
ok(`photos: ${manifest.photos.length} self-hosted pictures, 3 sizes each, real width/height and alt text`);

// no EXIF: a camera can bake GPS coordinates into a file, and that must never go on the web
for (const f of fs.readdirSync(P('public/img/muaaz')).filter((x) => x.endsWith('.jpg'))) {
  const buf = fs.readFileSync(P(`public/img/muaaz/${f}`));
  assert.equal(buf[0], 0xff, `${f} is a JPEG`);
  const blob = buf.subarray(0, 4000).toString('latin1');
  assert.ok(!/GPS|GPST/i.test(blob), `${f}: no GPS marker in the first 4 kB`);
  assert.ok(!blob.includes('Exif'), `${f}: EXIF stripped`);
}
ok('privacy: EXIF and GPS are stripped from every shipped picture');

// ---------------------------------------------------------------------------
// 2. the library is defensive
// ---------------------------------------------------------------------------
const fp = await import(pathToFileURL(P('lib/founderPhotos.js')).href);
const photos = fp.getFounderPhotos();
assert.ok(photos.length > 0, 'getFounderPhotos reads the manifest');
assert.ok(fp.hasLocalFounderPhotos(), 'hasLocalFounderPhotos is true');
assert.ok(fp.founderAvatarPhotos([]).every((u) => u.startsWith('/img/')), 'avatars prefer the shop own files');
assert.ok(fp.founderAvatarPhotos(['https://x.test/a.png']).some((u) => u.startsWith('https://')), 'remote fallbacks come last');
assert.match(fp.founderHeroPhoto('/fallback.jpg'), /^\/img\//, 'the hero photo is one of ours');

const rows = fp.founderPhotoJsonLd('https://mizanora.vercel.app');
assert.ok(rows.length > 0 && rows.every((r) => r['@type'] === 'ImageObject'), 'ImageObject rows for structured data');
assert.ok(rows.every((r) => r.url.startsWith('https://mizanora.vercel.app/img/')), 'structured data uses absolute urls');
assert.ok(rows.every((r) => r.width && r.height), 'ImageObject carries width and height');

const urls = fp.founderPhotoUrls('https://mizanora.vercel.app');
assert.ok(urls.every((u) => u.startsWith('https://mizanora.vercel.app/img/')), 'image sitemap urls are absolute');
// the base is normally absUrl('/'), which ends in a slash - a naive join gives //img/... and Google drops it
assert.ok(fp.founderPhotoUrls('https://mizanora.vercel.app/').every((u) => !u.includes('.app//')), 'no double slash when the base ends in /');
assert.ok(fp.founderPhotoJsonLd('https://mizanora.vercel.app/').every((r) => !r.url.includes('.app//')), 'structured data has no double slash either');
ok('library: avatars, hero, ImageObject rows and sitemap urls are all built from the manifest');

// a damaged or hostile manifest must never throw, and must never emit a path it should not
const clean = fp.getFounderPhotos();
assert.ok(clean.every((p) => !/\.\./.test(p.src)), 'no path traversal survives');
assert.ok(clean.every((p) => p.group === 'muaaz'), 'group defaults to muaaz');
ok('safety: traversal and junk entries are dropped, a missing manifest returns []');

// ---------------------------------------------------------------------------
// 3. the pages are wired
// ---------------------------------------------------------------------------
const muaaz = read('app/muaaz-iqbal/page.js');
assert.match(muaaz, /sortedFounderPhotos/, '/muaaz-iqbal reads the local photos');
assert.match(muaaz, /founderAvatarPhotos/, '/muaaz-iqbal uses them for the avatar');
assert.match(muaaz, /PhotoGallery/, '/muaaz-iqbal renders the gallery');
assert.match(muaaz, /founderPhotoJsonLd/, '/muaaz-iqbal emits ImageObject data');
assert.match(muaaz, /ImageGallery/, 'an ImageGallery wraps the pictures');

const team = read('app/team/page.js');
assert.match(team, /founderAvatarPhotos\(FOUNDER\.photos\)/, '/team uses the local avatar with the old links as fallback');
assert.match(team, /founderHeroPhoto/, '/team person schema uses the best local picture');

const sitemap = read('app/sitemap.js');
assert.match(sitemap, /founderPhotoUrls\(absUrl\('\/'\)\)/, 'the sitemap leads with the self-hosted pictures');
assert.match(sitemap, /img\.startsWith\('http'\) \? img : absUrl\(img\)/, 'a local blog image is made absolute for the sitemap');

const cfg = read('next.config.js');
assert.match(cfg, /\.\/data\/\*\.json/, 'the manifest travels with the serverless functions');
ok('pages: /muaaz-iqbal, /team, the sitemap and next.config all use the new photos');

// ---------------------------------------------------------------------------
// 4. the gallery component
// ---------------------------------------------------------------------------
const gallery = read('components/PhotoGallery.js');
assert.match(gallery, /^'use client'/, 'gallery is a client component');
for (const needle of ['role="dialog"', 'aria-modal="true"', 'Escape', 'ArrowRight', 'ArrowLeft', 'aria-label="Close photo"']) {
  assert.ok(gallery.includes(needle), `gallery: ${needle}`);
}
assert.match(gallery, /document\.body\.style\.overflow/, 'the page scroll is locked while the lightbox is open');
assert.match(gallery, /removeEventListener/, 'the key handler is cleaned up');
assert.match(gallery, /loading=\{i < 4 \? 'eager' : 'lazy'\}/, 'the first row loads eagerly, the rest lazily');

const css = read('app/globals.css');
for (const cls of ['.mz-photo-grid', '.mz-photo-tile', '.mz-lightbox', '.mz-lightbox-nav', '.mz-table-wrap', '.mz-chip']) {
  assert.ok(css.includes(cls), `css: ${cls}`);
}
assert.match(css, /prefers-reduced-motion[^}]*\}[^}]*mz-lightbox|\.mz-lightbox \{ animation: none/, 'the lightbox respects reduced motion');
ok('gallery: keyboard, focus, scroll lock and reduced motion are all handled');

// ---------------------------------------------------------------------------
// 5. the blog engine (v36 fixes)
// ---------------------------------------------------------------------------
const blog = await import(pathToFileURL(P('lib/blog.js')).href);
const posts = blog.getPosts();
assert.ok(posts.length >= 120, `the blog is large (${posts.length} guides)`);
assert.equal(new Set(posts.map((p) => p.slug)).size, posts.length, 'no duplicate slugs');
assert.ok(posts.every((p) => p.category && p.date && p.title), 'every guide has a title, date and category');

// quoted front matter: before v36 the quotes were kept in the value
const quoted = blog.getPost('quoted-front-matter-fixture-does-not-exist');
assert.equal(quoted, null, 'a missing slug returns null');
const parsed = blog.getPosts().every((p) => !/^["'].*["']$/.test(p.title || ''));
assert.ok(parsed, 'no front-matter value still wears its quotes');
ok(`blog: ${posts.length} guides, unique slugs, quotes stripped from front matter`);

// categories
const cats = blog.getBlogCategories();
assert.ok(cats.length >= 4, 'there are real category shelves');
assert.ok(cats.every((c) => c.count > 0 && c.label), 'each shelf has a label and a count');
const muaazCat = cats.find((c) => c.slug === 'muaaz-iqbal');
assert.ok(muaazCat && muaazCat.count >= 20, 'the Muaaz Iqbal shelf is populated');
ok(`categories: ${cats.map((c) => c.label + ' ' + c.count).join(', ')}`);

// related posts are actually related
const one = blog.getPost('muaaz-iqbal-mizan-mindset-balance-theory');
assert.ok(one, 'the mizan mindset guide exists');
const rel = blog.relatedPosts(one, 3);
assert.equal(rel.length, 3, 'three related guides');
assert.ok(rel.every((r) => r.slug !== one.slug), 'a guide never links to itself');
assert.ok(rel.filter((r) => r.category === one.category).length >= 2, 'most related guides share the topic');
const two = blog.getPost('how-to-buy-electronics-online-safely-pakistan');
assert.ok(blog.relatedPosts(two, 3).every((r) => r.slug !== two.slug), 'related works for every guide');
ok('related: "Keep reading" now picks guides that share the topic, not the newest two');

// markdown: local images, tables, rules
const tablePost = blog.getPost('zero-quota-theory-systems-that-survive-free-limits');
assert.match(tablePost.html, /<table>/, 'pipe tables render');
assert.match(tablePost.html, /<thead><tr><th>/, 'the header row is a header row');
const imgPost = blog.getPost('muaaz-iqbal-mizan-mindset-balance-theory');
assert.match(imgPost.html, /<img src="\/img\/muaaz\//, 'local images render (before v36 only https worked)');
assert.match(imgPost.html, /<figcaption/, 'a picture with a title gets a caption');
assert.match(imgPost.html, /<div class="callout">/, 'blockquotes still work');
ok('markdown: local images, captions, callouts and tables all render');

// a broken file must not break the build
const blogSrc = read('lib/blog.js');
assert.match(blogSrc, /console\.warn\(`blog: skipped/, 'a damaged file is skipped and reported');
assert.match(blogSrc, /duplicate slug/, 'duplicate slugs are reported, not silently overwritten');
ok('resilience: one broken guide can no longer take the whole build down');

// ---------------------------------------------------------------------------
// 6. the new pages
// ---------------------------------------------------------------------------
assert.ok(exists('app/blog/category/[slug]/page.js'), 'category hub pages exist');
const catPage = read('app/blog/category/[slug]/page.js');
assert.match(catPage, /generateStaticParams/, 'category pages are static');
assert.match(catPage, /dynamicParams = false/, 'unknown categories 404 instead of rendering empty');
assert.match(catPage, /CollectionPage/, 'category pages carry collection structured data');
assert.match(catPage, /notFound\(\)/, 'a missing category is a 404');

const index = read('app/blog/page.js');
assert.match(index, /BlogBrowser/, 'the index uses the browser');
assert.match(index, /getBlogCategories/, 'the index lists the shelves');
assert.match(index, /'@type': 'Blog'/, 'the index carries Blog structured data');

const browser = read('components/BlogBrowser.js');
assert.match(browser, /^'use client'/, 'the browser is a client component');
assert.match(browser, /slice\(0, page \* PAGE\)/, 'posts are paginated (not 125 cards at once)');
assert.match(browser, /aria-live="polite"/, 'the result count is announced');
ok('pages: /blog/category/[slug] hubs plus a paginated, searchable /blog');

// ---------------------------------------------------------------------------
// 7. the new content
// ---------------------------------------------------------------------------
const NEW = [
  ['muaaz-iqbal-mizan-mindset-balance-theory', 'muaaz-iqbal'],
  ['zero-quota-theory-systems-that-survive-free-limits', 'muaaz-iqbal'],
  ['urdu-first-design-theory-technology-in-your-own-language', 'muaaz-iqbal'],
  ['small-steps-theory-unchi-soch-chhote-qadam', 'muaaz-iqbal'],
  ['compound-builder-theory-one-hour-every-day', 'muaaz-iqbal'],
  ['trust-first-theory-why-mizanora-shows-real-prices', 'muaaz-iqbal'],
  ['ai-orchestra-theory-claude-gemini-qwen-chatgpt-together', 'muaaz-iqbal'],
  ['muaaz-iqbal-dimaag-kaise-kaam-karta-hai', 'muaaz-iqbal'],
  ['online-shopping-mistakes-pakistan-avoid', 'shopping-guides'],
  ['how-to-buy-electronics-online-safely-pakistan', 'shopping-guides'],
  ['cash-on-delivery-vs-advance-payment-pakistan', 'shopping-guides'],
  ['smart-search-ka-tareeqa-mizanora', 'shopping-guides'],
  ['search-by-price-not-by-name-pakistan-shopping', 'shopping-guides'],
  ['google-search-tips-for-pakistani-online-shoppers', 'shopping-guides'],
  ['voice-search-shopping-urdu-roman-urdu-guide', 'shopping-guides'],
  ['online-shopping-2026-five-changes-that-reached-pakistan', 'shopping-guides'],
  ['agentic-commerce-2026-what-it-means-for-pakistani-shops', 'earning-and-business'],
  ['pakistan-cash-on-delivery-2026-what-the-data-shows', 'earning-and-business'],
  ['ai-agent-payment-protocols-acp-ap2-ucp-explained', 'earning-and-business'],
  ['how-small-pakistani-shops-stay-visible-to-ai', 'earning-and-business'],
];
for (const [slug, cat] of NEW) {
  const p = blog.getPost(slug);
  assert.ok(p, `new guide exists: ${slug}`);
  assert.equal(p.category, cat, `${slug} is filed under ${cat}`);
  assert.ok(p.description && p.description.length > 60, `${slug} has a real description`);
  assert.ok(p.words > 350, `${slug} is a substantial guide (${p.words} words)`);
  assert.ok(/^2026-1[01]-\d\d$/.test(p.date), `${slug} is dated`);
  assert.ok(p.heads.length >= 3, `${slug} has headings`);
  assert.match(p.html, /<!--cta-->/, `${slug} has its call-to-action slot`);
  assert.ok(!p.html.includes('{cta}'), `${slug} does not leak the raw placeholder`);
}
ok(`content: ${NEW.length} new guides (Muaaz Iqbal theories, shopping, searching, and 2026 tech news)`);

// internal linking: every new guide links to at least two others
for (const [slug] of NEW) {
  const p = blog.getPost(slug);
  const links = (p.html.match(/href="\/blog\//g) || []).length;
  assert.ok(links >= 2, `${slug} links to at least 2 other guides (found ${links})`);
}
ok('linking: every new guide links onwards, so Google (and readers) can walk the whole blog');

// ---------------------------------------------------------------------------
// 8. the Search Console pack
// ---------------------------------------------------------------------------
assert.ok(exists('scripts/search-console.mjs'), 'the submission helper exists');
const sc = read('scripts/search-console.mjs');
assert.match(sc, /URL Inspection/, 'it explains URL Inspection');
assert.match(sc, /day-\$\{stamp/, 'it writes daily batches');
assert.match(sc, /INDEXNOW_KEY/, 'it can ping IndexNow too');
assert.ok(!/google\.com\/webmasters\/v3|client_secret/.test(sc), 'it never pretends to hold Google credentials');

assert.ok(exists('scripts/muaaz-photos.mjs'), 'the photo pipeline exists');
const pp = read('scripts/muaaz-photos.mjs');
assert.match(pp, /rotate\(\)/, 'EXIF rotation is baked into the pixels');
assert.match(pp, /data\/muaaz-photos\.json/, 'it writes the manifest');
ok('tooling: scripts/muaaz-photos.mjs and scripts/search-console.mjs are both in place');

// ---------------------------------------------------------------------------
// 9. the GitHub profile package carries the same pictures
// ---------------------------------------------------------------------------
const profReadme = read('profile/README.md');
assert.match(profReadme, /## 📸 Photos/, 'the profile README has a Photos section');
assert.match(profReadme, /#-photos/, 'the profile nav links to it');
const photoRows = (profReadme.match(/assets\/photos\/muaaz-iqbal-\d\d\.jpg/g) || []);
assert.equal(new Set(photoRows).size, manifest.photos.length, `all ${manifest.photos.length} pictures appear in the profile grid`);
for (const f of new Set(photoRows)) {
  assert.ok(exists(`profile/${f}`), `profile/${f} exists`);
  const buf = fs.readFileSync(P(`profile/${f}`));
  assert.ok(!buf.subarray(0, 4000).toString('latin1').includes('Exif'), `${f}: EXIF stripped`);
}
assert.match(read('profile/SETUP.md'), /assets\/photos/, 'the profile setup notes explain the folder');
ok(`profile: the same ${manifest.photos.length} pictures are wired into github.com/muaaziqbalvip`);

console.log(`\n${n} checks passed (v36: founder photos on the site + a blog built for 125 guides)`);
