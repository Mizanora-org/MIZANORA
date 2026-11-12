import fs from 'node:fs';
import path from 'node:path';

// Mizanora v62 — a STABLE sitemap `lastmod`.
//
// Bug this fixes: both sitemap routes used `new Date()` for every URL's <lastmod>. So a file that
// regenerated at 00:01 told Google that 40,000 pages had "changed today", and the same file
// regenerated six hours later said it again. Nothing had changed. The result was pointless re-crawls
// (each crawl is a Function/edge request) and a body that could never be reused across days.
//
// Now every file is stamped with the date the underlying catalogue data last changed. The weekly
// imdb-ids workflow writes that date to data/sitemap-version.txt; a plain code deploy changes
// nothing, so the bytes stay identical and the CDN keeps them for a week.
//
// Server-only (route handlers), and deliberately tiny: one synchronous read of a 10-byte file.
const FALLBACK = '2026-11-12';

export function sitemapLastmod() {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'data', 'sitemap-version.txt'), 'utf8').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : FALLBACK;
  } catch (_) { return FALLBACK; }
}
