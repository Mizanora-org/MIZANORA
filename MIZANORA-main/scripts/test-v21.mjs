// v21: wishlist storage, AdSense, image settings, new pages. Run: node scripts/test-v21.mjs
import fs from 'node:fs';
let bad = 0;
const t = (name, ok, extra = '') => { if (!ok) bad++; console.log(`${ok ? 'ok   ' : 'FAIL '} ${name}${ok ? '' : ` ${extra}`}`); };
const read = (p) => fs.readFileSync(p, 'utf8');

// ---- wishlist: works with normal storage and with BLOCKED storage
const store = new Map();
globalThis.window = { dispatchEvent() { return true; } };
globalThis.Event = class { constructor(n) { this.type = n; } };
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
const w = await import('../lib/wish.js');
t('wishlist starts empty', w.getWish().length === 0);
t('toggle adds a product', w.toggleWish('a') === true && w.getWish().join() === 'a');
t('newest saved product comes first', (w.toggleWish('b'), w.getWish().join() === 'b,a'));
t('toggle removes a product', w.toggleWish('a') === false && w.getWish().join() === 'b');
w.setWish(['x', 'x', 'y', '']);
t('duplicates and blanks are cleaned', w.getWish().join() === 'x,y');
t('list is capped at 100', (w.setWish(Array.from({ length: 150 }, (_, i) => `p${i}`)), w.getWish().length === 100));
globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
w.setWish(['m1', 'm2']);
t('blocked storage: the list still works for this visit', w.getWish().join() === 'm1,m2');
t('blocked storage: toggle still works', w.toggleWish('m3') === true && w.getWish()[0] === 'm3');

// ---- AdSense
const layout = read('app/layout.js');
t('AdSense script is in the layout head', layout.includes('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4008582341764263') && layout.includes('crossOrigin="anonymous"'));
t('AdSense account meta is present', layout.includes('google-adsense-account'));
t('ads.txt is correct', read('public/ads.txt').trim() === 'google.com, pub-4008582341764263, DIRECT, f08c47fec0942fa0');

// ---- images
t('image optimizer is off by default', /unoptimized: process\.env\.NEXT_IMAGE_OPTIMIZE !== '1'/.test(read('next.config.js')));
let missing = [];
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]));
for (const f of [...walk('app'), ...walk('components')].filter((x) => x.endsWith('.js'))) {
  for (const m of read(f).matchAll(/<Image\b[^>]*>/g)) if (!m[0].includes('referrerPolicy')) missing.push(f);
}
t('every <Image> sends no referrer', missing.length === 0, [...new Set(missing)].join(' '));

// ---- pages and blogs
for (const p of ['shipping', 'size-guide', 'islamic', 'winter']) t(`page /${p} exists`, fs.existsSync(`app/${p}/page.js`));
t('sitemap lists the new pages', ['/shipping', '/size-guide', '/islamic', '/winter'].every((p) => read('app/sitemap.js').includes(`'${p}'`)));
const posts = fs.readdirSync('content/blog').filter((f) => f.endsWith('.md'));
t('at least 70 blog posts', posts.length >= 70, String(posts.length));
let badFm = [];
for (const f of posts) { const s = read(`content/blog/${f}`); const m = s.match(/^---\n([\s\S]*?)\n---\n/); if (!m || !/title: /.test(m[1]) || !/slug: /.test(m[1]) || !new RegExp(`slug: ${f.replace('.md', '')}\\n`).test(m[1] + '\n')) badFm.push(f); }
t('every blog post has valid front matter and a matching slug', badFm.length === 0, badFm.join(' '));
t('admin products page edits archived products', read('app/admin/products/page.js').includes('editArchived') && read('app/admin/products/page.js').includes("/api/admin/archive-edit"));
t('owner pencil layer is mounted in the layout', layout.includes('AdminEditLayer'));
console.log(bad ? `\n${bad} FAILED` : '\nAll v21 tests passed.');
process.exit(bad ? 1 : 0);
