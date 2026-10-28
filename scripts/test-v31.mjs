import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const imp = (f) => import(pathToFileURL(path.join(root, f)).href);

// ---- blog: Muaaz Iqbal birthday / age -------------------------------------
const { getPosts, getPost } = await imp('lib/blog.js');
const posts = getPosts();
const bday = getPost('muaaz-iqbal-birthday-27-november-2009-age');
assert.ok(bday, 'birthday blog post exists');
assert.match(bday.html, /27 November 2009/);
assert.match(bday.html, /16 years old/);
assert.match(bday.html, /turns 17 on 27 November 2026/);
assert.ok(bday.image && /^https?:\/\//.test(bday.image), 'birthday post carries an image (front matter)');
assert.ok(posts.some((p) => p.slug === 'muaaz-iqbal-biography-profile-projects-skills'));
assert.match(getPost('muaaz-iqbal-biography-profile-projects-skills').html, /27 November 2009/);

// ---- images server + admin panel -------------------------------------------
const { cleanImage } = await imp('lib/images.js');
const img = cleanImage({ url: 'https://x.test/a.jpg', title: '<b>hi</b>', group: 'muaaz', atMs: 5 });
assert.equal(img.url, 'https://x.test/a.jpg');
assert.ok(!img.title.includes('<b>'));
assert.equal(img.group, 'muaaz');
assert.equal(cleanImage({ url: '   ' }).url, '');
assert.match(read('app/api/admin/images/route.js'), /verifyAdmin/);
assert.match(read('app/api/admin/images/route.js'), /act === 'add'/);
assert.match(read('app/admin/images/page.js'), /admin\/images/);
assert.match(read('components/AdminNav.js'), /'\/admin\/images'/);
assert.match(read('firestore.rules'), /match \/siteImages\/\{id\}/);

// ---- sitemap carries Muaaz Iqbal's images + blog post images ----------------
const sitemap = read('app/sitemap.js');
assert.match(sitemap, /getMuaazImages/);
assert.match(sitemap, /muaazPageImgs/);
assert.match(sitemap, /p\.image/);

// ---- home feed: Muaaz Iqbal photo cards -----------------------------------
const { buildFeed } = await imp('lib/marketFeed.js');
const feed = buildFeed({
  products: [{ id: 'p1', slug: 'p1', name: 'X', price: 1, inStock: true, images: [], comparePrice: 0, featured: false }],
  islamic: [], channels: [], tools: [],
  images: [{ title: 'Muaaz', url: 'https://x.test/m.jpg', caption: 'c' }],
  day: 3, max: 12,
});
assert.ok(feed.some((f) => f.kind === 'muaaz'), 'feed contains a muaaz photo card');
assert.match(read('components/MarketFeed.js'), /kind === 'muaaz'/);
assert.match(read('app/page.js'), /images: muaazImgs/);

// ---- muaaz page gallery + blog cards ----------------------------------------
assert.match(read('app/muaaz-iqbal/page.js'), /getMuaazImages/);
assert.match(read('app/muaaz-iqbal/page.js'), /birthDate/);
assert.match(read('app/blog/page.js'), /p\.image/);
assert.match(read('app/blog/\[slug\]/page.js'), /p\.image/);

console.log('ok    v31: Muaaz Iqbal birthday/age blogs (27 Nov 2009, age 16, turns 17)');
console.log('ok    v31: admin Images panel + sitemap images + feed photo cards');
console.log('\nAll v31 blog/image tests passed.');
