/**
 * Mizanora v61 — ISR WRITE / RENDER BUDGET.
 *
 * Why this suite exists:
 *   2026-11-09 ko Vercel ne project dobara pause kiya. Is dafa sirf bandwidth nahi, ye bhi thi:
 *        ISR Writes            620K / 200K   (3x)
 *        Fast Origin Transfer  23.92 GB / 10 GB
 *        Fluid Active CPU      3h 23m / 4h
 *   Wajah: build par 534 pages prerender ho rahe thay aur ~500 par `revalidate = 1800/600` tha.
 *   534 pages x 48 writes/day x 30 din ≈ 770K writes. Plus har regenerate = Function se poora HTML
 *   (origin transfer). Plus har hafte ek bot commit jo poora rebuild karwata tha.
 *
 * Ye suite un niyamon ko pin karta hai:
 *   1. koi page 86400 (1 din) se chhota revalidate na rakhe
 *   2. repo-only pages (blog, tools, quran, hadith, islamic, news, ...) par revalidate na ho
 *   3. prerender caps wahi rahein (products 12, categories 12, live 24, actors 200)
 *   4. weekly data commit deploy trigger na kare (`[skip vercel]`)
 *   5. v60 ke bandwidth fix bhi maujood rahein
 *
 * Run: node scripts/test-v61.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), 'utf8') : '');
let checks = 0;
const ok = (m) => { checks += 1; console.log(`ok    ${m}`); };
const check = (cond, msg) => { assert.ok(cond, msg); checks += 1; };

// ---- collect every app router page/route ----------------------------------
const files = [];
(function walk(dir) {
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`;
    const st = statSync(join(root, rel));
    if (st.isDirectory()) walk(rel);
    else if (/^(page|route)\.js$/.test(name)) files.push(rel);
  }
})('app');

// ---- 1. no page may revalidate more often than once a day ----------------
const tooFrequent = [];
for (const f of files) {
  const m = read(f).match(/export const revalidate = (\d+)/);
  if (m && Number(m[1]) < 86400) tooFrequent.push(`${f} (${m[1]}s)`);
}
check(tooFrequent.length === 0, `these pages revalidate more often than once a day (ISR writes!): ${tooFrequent.join(', ')}`);
ok('no page/route revalidates more often than daily');

// ---- 2. repo-only pages must be static (no revalidate) -------------------
const mustBeStatic = [
  'app/blog/[slug]/page.js', 'app/blog/category/[slug]/page.js', 'app/blog/author/[name]/page.js',
  'app/tools/[slug]/page.js', 'app/tools/page.js', 'app/news/page.js', 'app/muaaz-iqbal/page.js',
  'app/islamic/page.js', 'app/hadith/page.js', 'app/quran/[surah]/page.js', 'app/quran/page.js',
  'app/reviews/page.js', 'app/sitemaps/page.js', 'app/live-channel/page.js',
  'app/winter/page.js', 'app/team/page.js', 'app/movies/world/page.js', 'app/stats/page.js',
];
for (const f of mustBeStatic) {
  check(!/export const revalidate/.test(read(f)), `${f} is built from the repo and must not revalidate (ISR writes)`);
}
ok('repo-only pages are static (0 ISR writes after the build)');

// ---- 3. prerender caps ---------------------------------------------------
check(/slice\(0, 12\)/.test(read('app/product/[slug]/page.js')), 'products: at most 12 prerendered');
check(/slice\(0, 12\)/.test(read('app/category/[slug]/page.js')), 'categories: at most 12 prerendered');
check(/slice\(0, 24\)/.test(read('app/live/[slug]/page.js')), 'live channels: at most 24 prerendered');
check(/actors\.slice\(0, 200\)/.test(read('app/movies/actor/[slug]/page.js')), 'actors: at most 200 prerendered');
check(/generateStaticParams/.test(read('app/movies/[slug]/page.js')), 'movies still prerender the starter titles');
ok('prerender caps hold (the build no longer prerenders the whole catalogue)');

// ---- 3b. no INNER cache TTL may pull a page below a day -------------------
// THE ROOT CAUSE of the 2026-11-09 pause. Next floors a page's ISR to the smallest
// `unstable_cache` / `fetch(..., { next: { revalidate } })` its render tree touches, so ONE helper
// with 6h (the catalogue count, the reviews list, the GitHub card) silently made 325 "daily" pages
// regenerate many times a day. A page-level literal is therefore not enough: the inner TTLs must be
// a day too, and they must be literals - `process.env.X || 1800` lets one env var move the whole
// site's budget again.
const libFiles = [];
(function walkLib(dir) {
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`;
    const st = statSync(join(root, rel));
    if (st.isDirectory()) walkLib(rel);
    else if (/\.(js|mjs)$/.test(name)) libFiles.push(rel);
  }
})('lib');

const secondsOf = (expr) => {
  const m = expr.match(/\d+(\s*\*\s*\d+)+/);
  if (!m) return /^\d+$/.test(expr) ? Number(expr) : null;
  return m[0].split('*').reduce((a, b) => a * Number(b.trim()), 1);
};

const shortInner = [];
for (const f of libFiles) {
  for (const m of read(f).matchAll(/revalidate:\s*([^,}\n]+)/g)) {
    const expr = m[1].trim();
    if (/process\.env/.test(expr)) { shortInner.push(`${f}: revalidate reads process.env (${expr})`); continue; }
    const val = secondsOf(expr);
    // a bare constant name (CATALOG_TTL, TTL) is checked by the name-specific tests below
    if (val !== null && val < 86400) shortInner.push(`${f}: revalidate: ${expr}` + (val === Number(expr) ? '' : ` (= ${val}s)`));
  }
}
check(shortInner.length === 0, `these inner cache TTLs floor the site's ISR below a day: ${shortInner.join(', ')}`);
ok('inner cache TTLs are a day or longer, and never read from an env var');

// ---- 3c. the helpers that used to floor the whole site --------------------
const prod = read('lib/products.js');
check(/const CATALOG_TTL = Number\(process\.env\.CATALOG_CACHE_SECONDS\) \|\| 24 \* 60 \* 60;/.test(prod),
  'CATALOG_TTL defaults to 24h (12h or less re-burns ISR writes)');
check(/revalidate: 24 \* 60 \* 60, tags: \['catalog'\]/.test(prod), 'the catalogue count is cached for 24h too');
check(/const TTL = 86400;/.test(read('lib/githubLive.js')), 'the GitHub card TTL is a fixed day (no GITHUB_CACHE_SECONDS)');
check(/revalidate: 86400, tags: \['reviews'\]/.test(read('lib/reviews.js')), 'the reviews list is a day, not 6h');
ok('the helpers that used to floor the site are a day long');

// ---- 4. the weekly data commit must not deploy ---------------------------
const imdb = read('.github/workflows/imdb-ids.yml');
check(imdb.includes('[skip vercel]'), 'the weekly imdb-ids commit is marked [skip vercel] (no rebuild)');
ok('weekly data refresh no longer triggers a deployment');

// ---- 5. v60 bandwidth rules still hold ----------------------------------
const img = read('lib/imgFallback.js');
check(img.includes('shouldRelay') && img.includes('markBrokenHost'), 'the photo relay is still a last resort');
check(/s-maxage/.test(read('next.config.js')), 'relayed media is still edge-cached');
check(/RELAY_BUDGET/.test(read('lib/liveTv.js')), 'the TV relay still has a budget');
ok('v60 bandwidth rules are intact');

// ---- 6. documentation ----------------------------------------------------
check(existsSync(join(root, 'lib/cachePolicy.js')), 'lib/cachePolicy.js documents the write budget');
check(existsSync(join(root, 'UPGRADE-v61.md')), 'UPGRADE-v61.md documents this release');
ok('documentation present');

console.log(`\nAll v61 render-budget tests passed (${checks} checks).`);
