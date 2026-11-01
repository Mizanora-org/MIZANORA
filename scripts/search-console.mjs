#!/usr/bin/env node
// v36: GET THE NEW PAGES AND PICTURES INTO GOOGLE.
//
// Google Search Console has no "upload" button for pages: you either submit a sitemap (Google
// crawls it on its own schedule) or you paste individual URLs into URL Inspection and press
// "Request indexing" (about 10 a day - that is the daily limit). This script prepares all of it.
//
//   node scripts/search-console.mjs               -> write the batches, print the plan
//   node scripts/search-console.mjs --ping        -> also ping IndexNow (Bing, Yandex, Seznam, Naver)
//   node scripts/search-console.mjs --since 30    -> only guides added in the last 30 days
//   node scripts/search-console.mjs --stdout      -> print instead of writing files
//
// Nothing here talks to Google, because Google Search Console needs a human to be signed in.
// What it does is produce the exact lists, in the exact batches the daily limit allows, so the
// remaining work is copy, paste, click.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(root, 'out', 'search-console');
const args = new Set(process.argv.slice(2));
const flag = (name, dflt) => {
  const i = process.argv.indexOf('--' + name);
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : dflt;
};

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://mizanora.vercel.app').replace(/\/$/, '');
const abs = (p = '/') => `${SITE}${String(p).startsWith('/') ? p : '/' + p}`;

const { getPosts } = await import(pathToFileURL(path.join(root, 'lib', 'blog.js')).href);
const { sortedFounderPhotos } = await import(pathToFileURL(path.join(root, 'lib', 'founderPhotos.js')).href);

const sinceDays = Number(flag('since', 0));
const cutoff = sinceDays > 0 ? Date.now() - sinceDays * 864e5 : 0;
const fresh = (iso) => !cutoff || new Date(iso).getTime() >= cutoff;

const all = getPosts().filter((p) => fresh(p.date));
const photos = sortedFounderPhotos();

// ---- priority 1: the pages that make money --------------------------------
const core = [
  '/', '/products', '/deals', '/blog', '/team', '/muaaz-iqbal', '/winter', '/tools', '/islamic', '/workers',
];

// ---- priority 2: the topic hubs (new in v36) ------------------------------
const { getBlogCategories } = await import(pathToFileURL(path.join(root, 'lib', 'blog.js')).href);
const hubs = getBlogCategories().map((c) => `/blog/category/${c.slug}`);

// ---- priority 3: newest guides first --------------------------------------
const guides = all.map((p) => `/blog/${p.slug}`);

const urlList = [...new Set([...core, ...hubs, ...guides])];
const imageList = [...new Set(photos.map((p) => p.src))];

// ---- batching: Google's URL Inspection allows about 10 a day ---------------
const BATCH = 10;
const batches = [];
for (let i = 0; i < urlList.length; i += BATCH) batches.push(urlList.slice(i, i + BATCH));

const stamp = (n) => String(n).padStart(2, '0');

if (args.has('--stdout')) {
  console.log(urlList.map(abs).join('\n'));
} else {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'all-urls.txt'), urlList.map(abs).join('\n') + '\n');
  fs.writeFileSync(path.join(OUT, 'image-urls.txt'), imageList.map(abs).join('\n') + '\n');
  batches.forEach((b, i) => fs.writeFileSync(path.join(OUT, `day-${stamp(i + 1)}.txt`), b.map(abs).join('\n') + '\n'));
  fs.writeFileSync(path.join(OUT, 'README.txt'), [
    'MIZANORA - Google Search Console submission pack',
    `Generated ${new Date().toISOString()} for ${SITE}`,
    '',
    'STEP 1 (once) - add the property',
    '  Search Console > Add property > URL prefix > ' + SITE,
    '  Verify with the HTML tag: put the content="..." value in the Vercel env var',
    '  NEXT_PUBLIC_GSC_VERIFICATION, redeploy, then press Verify.',
    '',
    'STEP 2 (once) - submit the sitemaps',
    '  Sitemaps > add:  sitemap.xml',
    '  Sitemaps > add:  blog/feed.xml',
    '',
    'STEP 3 (daily, ~10 a day) - request indexing',
    `  Open day-01.txt, paste each URL into the URL Inspection bar at the top of`,
    '  Search Console, press ENTER, then "Request indexing".',
    '  Next day use day-02.txt, and so on. That is the daily limit - do not rush it.',
    '',
    'STEP 4 (weekly) - check the reports',
    '  Page indexing: fix anything that says "Crawled - currently not indexed" by',
    '  adding internal links from other guides (every new guide links to 3 others).',
    '  Core Web Vitals: images under public/img/ are served with a 30-day cache.',
    '',
    'OPTIONAL - faster discovery outside Google',
    '  Set INDEXNOW_KEY in Vercel (16-64 letters/numbers) and the shop pings Bing,',
    '  Yandex, Seznam and Naver the moment a page changes. Run this script with',
    '  --ping to push the current list right now.',
    '',
    `Files: ${batches.length} daily batches, ${urlList.length} pages, ${imageList.length} images.`,
    '',
  ].join('\n'));
}

// ---- IndexNow (Bing / Yandex / Seznam / Naver + partners) ------------------
async function ping() {
  const key = process.env.INDEXNOW_KEY || '';
  if (!key) { console.log('\nIndexNow: skipped (set INDEXNOW_KEY in your shell or in Vercel to enable it).'); return; }
  const host = new URL(SITE).host;
  const body = JSON.stringify({ host, key, keyLocation: abs('/api/indexnow-key'), urlList: urlList.map(abs).slice(0, 500) });
  try {
    const r = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body,
      signal: AbortSignal.timeout(10000),
    });
    console.log(`\nIndexNow: ${r.ok || r.status === 202 ? 'accepted' : 'rejected'} (HTTP ${r.status}) for ${Math.min(500, urlList.length)} urls`);
  } catch (e) {
    console.log('\nIndexNow: failed -', String(e.message || e).slice(0, 160));
  }
}

// ---- the report -----------------------------------------------------------
console.log(`MIZANORA -> Google Search Console (${SITE})`);
console.log(`  ${urlList.length} pages   ${imageList.length} images   ${photos.length} founder photos in the manifest`);
console.log(`  ${batches.length} daily batches of ${BATCH} (Google's URL Inspection limit is about 10 a day)`);
if (!args.has('--stdout')) {
  console.log(`\n  written to out/search-console/`);
  console.log(`     README.txt      <- the 4 steps, in order`);
  console.log(`     all-urls.txt    <- every page`);
  console.log(`     image-urls.txt  <- every founder photo (same list that goes in the image sitemap)`);
  console.log(`     day-01.txt …    <- paste these into URL Inspection, one batch per day`);
  console.log(`\n  The six most important pages to do first:`);
  for (const u of urlList.slice(0, 6)) console.log(`     ${abs(u)}`);
}
if (args.has('--ping')) await ping();
