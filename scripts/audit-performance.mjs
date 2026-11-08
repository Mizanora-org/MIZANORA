// MIZANORA v60 — THE PAGE WEIGHT AUDIT.
//
//   node scripts/audit-performance.mjs            # table for the built pages
//   node scripts/audit-performance.mjs --json     # machine readable (used by test-v60)
//   node scripts/audit-performance.mjs --budget   # exit 1 when a page breaks a v60 budget
//
// It reads the HTML that `next build` actually produced (.next/server/app/**/*.html) and counts the
// things PageSpeed punishes on a phone: bytes of markup, DOM nodes, inline SVGs, images, font
// preloads, eager/LCP-candidate images and third-party scripts. Run it before and after any change;
// it is the fastest honest "did this make the shop lighter?" answer without a browser.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const APP = path.join(ROOT, '.next/server/app');

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const count = (s, re) => (s.match(re) || []).length;

export function auditHtml(html) {
  const head = html.slice(0, html.indexOf('</head>') + 7);
  const body = html.slice(head.length);
  const preload = (kind) => count(head, new RegExp(`<link rel="preload"[^>]*as="${kind}"`, 'g'));
  const imgs = [...body.matchAll(/<img[^>]*>/g)].map((m) => m[0]);
  const eager = imgs.filter((t) => /loading="eager"/.test(t) && !/loading="lazy"/.test(t)).length;
  const high = imgs.filter((t) => /fetchpriority="high"/i.test(t)).length;
  return {
    kb: Math.round(html.length / 1024),
    nodes: count(html, /<[a-zA-Z]/g),
    svgs: count(html, /<svg/g),
    paths: count(html, /<path/g),
    imgs: imgs.length,
    lazyImgs: imgs.filter((t) => /loading="lazy"/.test(t)).length,
    eagerImgs: eager,
    highPriorityImgs: high,
    preloadImages: preload('image'),
    preloadFonts: preload('font'),
    scripts: count(html, /<script/g),
    inlineKb: Math.round([...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
      .reduce((n, m) => n + m[1].length, 0) / 1024),
    thirdPartyScripts: count(html, /<script[^>]*src="https:\/\//g),
    externalImgHosts: [...new Set(imgs.map((t) => (t.match(/src="(https:\/\/[^/"]+)/) || [])[1]).filter(Boolean))],
  };
}

// The budgets are the v60 contract. They are deliberately generous (real data grows), but they
// catch the regressions that cost points on PageSpeed: a page twice as heavy, a second LCP
// candidate stealing bandwidth, fonts preloaded that nobody sees above the fold.
export const BUDGET = {
  home: { kb: 1100, nodes: 4200, svgs: 400, preloadImages: 2, highPriorityImgs: 2, preloadFonts: 5, thirdPartyScripts: 0 },
  page: { kb: 700, nodes: 3000, svgs: 400, preloadImages: 2, highPriorityImgs: 2, preloadFonts: 5, thirdPartyScripts: 0 },
};

// Everything below is the command line run; importing this file (the v60 test does) only gets the
// helpers and the budget, with no output.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
const files = isMain ? walk(APP).sort() : [];
const rows = files.map((f) => {
  const rel = `/${path.relative(APP, f).replace(/index\.html$/, '').replace(/\\/g, '/')}`;
  return { page: rel, ...auditHtml(fs.readFileSync(f, 'utf8')) };
});

const json = isMain && process.argv.includes('--json');
if (isMain && json) {
  console.log(JSON.stringify({ budget: BUDGET, rows }, null, 2));
} else if (isMain) {
  const pad = (v, n) => String(v).padEnd(n);
  console.log(`${pad('page', 34)}${pad('KB', 7)}${pad('nodes', 7)}${pad('svg', 6)}${pad('img', 6)}${pad('lazy', 6)}${pad('eager', 7)}${pad('hi', 4)}${pad('pre-img', 9)}${pad('pre-font', 10)}${pad('3p', 4)}`);
  console.log('-'.repeat(100));
  for (const r of rows.sort((a, b) => b.kb - a.kb).slice(0, 30)) {
    console.log(`${pad(r.page, 34)}${pad(r.kb, 7)}${pad(r.nodes, 7)}${pad(r.svgs, 6)}${pad(r.imgs, 6)}${pad(r.lazyImgs, 6)}${pad(r.eagerImgs, 7)}${pad(r.highPriorityImgs, 4)}${pad(r.preloadImages, 9)}${pad(r.preloadFonts, 10)}${pad(r.thirdPartyScripts, 4)}`);
  }
  const homes = rows.filter((r) => r.page === '/');
  const total = rows.reduce((n, r) => n + r.kb, 0);
  console.log(`\n${rows.length} built pages, ${Math.round(total / 1024)} MB of HTML in total`);
  if (homes[0]) console.log(`home: ${homes[0].kb} KB, ${homes[0].nodes} nodes, ${homes[0].svgs} SVGs, ${homes[0].imgs} images (${homes[0].lazyImgs} lazy), ${homes[0].preloadImages} image preloads, ${homes[0].preloadFonts} font preloads`);
}

if (isMain && process.argv.includes('--budget')) {
  const fails = [];
  for (const r of rows) {
    const b = r.page === '/' ? BUDGET.home : BUDGET.page;
    for (const [key, limit] of Object.entries(b)) {
      if (key === 'kb' && r.kb > limit) fails.push(`${r.page}: ${r.kb} KB > ${limit} KB`);
      else if (key !== 'kb' && r[key] > limit) fails.push(`${r.page}: ${key} ${r[key]} > ${limit}`);
    }
  }
  if (fails.length) {
    console.log('\nBUDGET FAILURES:\n' + fails.map((f) => `  - ${f}`).join('\n'));
    process.exit(1);
  }
  console.log('\nEvery page is inside the v60 weight budget.');
}
