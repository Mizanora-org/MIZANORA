/**
 * Mizanora v62 — Vercel `ignoreCommand`.
 *
 * Exit 0 = Vercel SKIPS the deployment. Exit 1 = Vercel builds (the safe default).
 *
 * Every deployment re-prerenders the site, uploads the prerendered HTML and re-fills the CDN. A
 * push that only touches a README, an UPGRADE note, a workflow, or the weekly IMDb/sitemap data
 * file does not change a single rendered byte — but it used to cost a full build and a fresh wave
 * of origin transfers. On a Hobby account that is a real part of the monthly allowance.
 *
 * Conservative by design: ANY file that is not on this short list builds. If git is unavailable,
 * anything throws, or ANY file was changed that the site reads, we BUILD — never skip a release.
 *
 * NOTE (v62 hotfix): an earlier draft also skipped whenever the commit MESSAGE contained a skip
 * marker. That is gone on purpose — the v62 release commit itself mentioned the marker while
 * describing the fix and Vercel then skipped a real code deploy ("Deployment was blocked").
 * The weekly IMDb workflow already commits only data-only paths, so changed-file detection alone
 * covers it; no message check is ever trusted.
 *
 * Force a deploy anyway: put [deploy] in the commit message, or set VERCEL_FORCE_BUILD=1 in Vercel.
 *
 * Run locally:   node scripts/vercel-ignore.mjs   (uses the current HEAD diff)
 */
import { execFileSync } from 'node:child_process';

const KEEP_BUILDING = () => { console.log('[ignore] build: this commit changes the deployed app'); process.exit(1); };
const SKIP = (why) => { console.log(`[ignore] skip: ${why}`); process.exit(0); };

// Forcing a deploy must work, even on a docs-only commit.
if (/\[deploy\]/i.test(String(process.env.VERCEL_GIT_COMMIT_MESSAGE || '')) || String(process.env.VERCEL_FORCE_BUILD || '') === '1') KEEP_BUILDING();

let files = [];
try {
  const out = execFileSync('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  files = String(out).split('\n').map((s) => s.trim()).filter(Boolean);
} catch (_) { KEEP_BUILDING(); }

// No changed files (shallow clone, first deploy, manual redeploy): never skip.
if (!files.length) KEEP_BUILDING();

// Files the running site genuinely does not read.
const NON_DEPLOYED = [
  /\.md$/i,
  /^docs\//i,
  /^\.github\//i,
  /^\.env\.example$/i,
  /^\.gitignore$/i,
  /\.rar$/i,
  // Read at REQUEST time by the sitemap routes, not baked into the build.
  /^data\/imdb-ids\.txt$/i,
  /^data\/sitemap-version\.txt$/i,
];
const deployed = files.filter((f) => !NON_DEPLOYED.some((re) => re.test(f)));
if (deployed.length) KEEP_BUILDING();
SKIP(`${files.length} doc/data-only file(s), nothing the app renders changed`);
