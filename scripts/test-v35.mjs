// v35 tests: the pro-level profile README package (animated art that stays true).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const P = (f) => path.join(root, 'profile', f);
const read = (f) => fs.readFileSync(P(f), 'utf8');
const exists = (f) => fs.existsSync(P(f));
let n = 0;
const ok = (msg) => { n++; console.log('ok    ' + msg); };

// ---------------------------------------------------------------------------
// 1. the package is complete
// ---------------------------------------------------------------------------
for (const f of ['README.md', 'SETUP.md', 'scripts/make-art.mjs', 'scripts/refresh-live.mjs', '.github/workflows/refresh.yml']) {
  assert.ok(exists(f), `profile/${f} exists`);
}
const ART = ['hero', 'ticker', 'live', 'stats', 'languages', 'logo', 'projects', 'tech-stack', 'philosophy'];
for (const name of ART) {
  for (const theme of ['', '-light']) {
    const f = `assets/${name}${theme}.svg`;
    assert.ok(exists(f), `profile/${f} exists`);
    const svg = read(f);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, `${f}: real SVG`);
    assert.match(svg, /viewBox="0 0 \d+ \d+"/, `${f}: viewBox`);
    assert.match(svg, /width="\d+" height="\d+"/, `${f}: explicit size`);
    assert.match(svg, /<style>[\s\S]*@keyframes mz-/, `${f}: CSS animation inside the file`);
    assert.match(svg, /prefers-reduced-motion/, `${f}: honours reduced motion`);
    assert.ok(!/<script/i.test(svg), `${f}: no script`);
    assert.ok(!/https?:\/\/(?!www\.w3\.org)/.test(svg.replace(/xmlns="[^"]+"/g, '')), `${f}: self-contained (no external asset)`);
    assert.ok(Buffer.byteLength(svg) < 110 * 1024, `${f}: under 110 kB`);
    assert.match(svg, /role="img"/, `${f}: announced as an image`);
  }
}
ok(`art: ${ART.length * 2} SVGs (dark + light), self-contained, animated, reduced-motion safe`);

// the dark and light versions really are different palettes
assert.notEqual(read('assets/hero.svg'), read('assets/hero-light.svg'), 'hero has a light palette too');
assert.match(read('assets/hero-light.svg'), /#F3FBF7|#EAF7F0/, 'light hero uses the light background');
assert.match(read('assets/hero.svg'), /#060F0D|#0A1A16/, 'dark hero uses the dark background');
ok('themes: separate light and dark files (the README picks with prefers-color-scheme)');

// ---------------------------------------------------------------------------
// 2. the motion the profile needs
// ---------------------------------------------------------------------------
const hero = read('assets/hero.svg');
for (const [cls, why] of [
  ['spin-slow', 'rotating monogram ring'],
  ['live-dot', 'pulsing LIVE dot'],
  ['ring', 'the radar ring'],
  ['ch', 'the typed line'],
  ['caret', 'a blinking caret'],
  ['sheen', 'the sweep across the name'],
  ['fade1', 'the rotating "currently" line'],
  ['bar', 'the waveform'],
  ['fill', 'the progress bar'],
  ['twinkle', 'the lights'],
  ['scan', 'the scan line over the card'],
]) assert.match(hero, new RegExp(`class="${cls}"`), `hero: ${why}`);

const live = read('assets/live.svg');
assert.equal((live.match(/class="fade\d"/g) || []).length, 3, 'live strip: three titles take turns');
const ticker = read('assets/ticker.svg');
assert.match(ticker, /class="tape"/, 'ticker: the tape moves');
assert.match(ticker, /translateX\(-/, 'ticker: it really slides');
const languages = read('assets/languages.svg');
assert.match(languages, /<animate attributeName="height"/, 'languages: the bar rows grow into place');
assert.match(languages, /JavaScript/, 'languages: real language names');
assert.match(languages, /SHARE OF REPOSITORIES/, 'languages: honest about what the % means');
const stats = read('assets/stats.svg');
assert.equal((stats.match(/class="pop"/g) || []).length, 6, 'stats: six number cards');
assert.match(stats, /data-k="repos"/, 'stats: the repo count is machine-readable');
ok('motion: rotating mark, LIVE dot + ring, typing, sweep, waveform, progress, tape, growing bars, popping cards');

// ---------------------------------------------------------------------------
// 3. every number the nightly job touches is marked
// ---------------------------------------------------------------------------
for (const key of ['repos', 'stars', 'followers']) assert.match(hero, new RegExp(`data-k="${key}"`), `hero carries data-k="${key}"`);
for (const key of ['repos', 'stars', 'followers', 'lastPush', 'topLang']) assert.match(live, new RegExp(`data-k="${key}"`), `live strip carries data-k="${key}"`);
for (const key of ['repos', 'stars', 'products', 'channels', 'tools', 'projects']) assert.match(stats, new RegExp(`data-k="${key}"`), `stats carries data-k="${key}"`);
const readmeText = read('README.md');
assert.match(readmeText, /<span data-k="updated">/, 'README has the "last refreshed" marker');
assert.match(readmeText, /refreshed every night|stays alive/i, 'README explains that the numbers refresh themselves');
ok('live markers: every number that changes is tagged data-k, so the Action can patch it');

// ---------------------------------------------------------------------------
// 4. the README is the pro layout and every image it points at exists
// ---------------------------------------------------------------------------
const imgs = [...readmeText.matchAll(/srcset="\.\/(assets\/[^"]+)"/g)].map((m) => m[1]);
assert.ok(imgs.length >= 12, `README references ${imgs.length} local art files`);
for (const rel of new Set(imgs)) assert.ok(exists(rel.replace(/^assets\//, 'assets/')), `README image exists: ${rel}`);
// ignore inline code spans (`<picture>` is mentioned in the docs section)
const readmeNoCode = readmeText.replace(/`[^`]*`/g, '');
assert.equal((readmeNoCode.match(/<picture>/g) || []).length, (readmeNoCode.match(/<\/picture>/g) || []).length, 'every <picture> is closed');
assert.match(readmeText, /prefers-color-scheme: dark/, 'dark variant');
assert.match(readmeText, /prefers-color-scheme: light/, 'light variant');
for (const section of ['Things I\'ve shipped', 'Tools I actually use', 'How I work', 'Let\'s build something', 'How this profile stays alive']) {
  assert.ok(readmeText.includes(section), `README keeps the "${section}" section`);
}
assert.match(readmeText, /```mermaid/, 'the mermaid flow diagram survived the upgrade');
assert.match(readmeText, /mizanora\.vercel\.app\/api\/github/, 'README links the shop GitHub feed');
assert.ok(!/!\[[^\]]*\]\(http:\/\//.test(readmeText), 'no insecure http images');
ok('README: hero + ticker + live + stats + languages + badges, all local files exist, sections kept');

// ---------------------------------------------------------------------------
// 5. the refresh script: pure functions first
// ---------------------------------------------------------------------------
const R = await import(pathToFileURL(P('scripts/refresh-live.mjs')).href);
assert.equal(R.ago(Date.now() - 30 * 1000), 'just now');
assert.equal(R.ago(Date.now() - 5 * 60000), '5 min ago');
assert.equal(R.ago(Date.now() - 3 * 3600000), '3 hours ago');
assert.equal(R.ago(Date.now() - 2 * 86400000), '2 days ago');
assert.equal(R.ago(Date.now() - 70 * 86400000), '2 months ago');
assert.equal(R.ago(0), 'just now', 'no timestamp never becomes "1970"');
assert.equal(R.monthYear(Date.UTC(2026, 9, 30)), 'October 2026');

const svgIn = '<text data-k="repos">92</text><tspan fill="#fff" data-k="stars">12</tspan><text>keep</text>';
const svgOut = R.applyStats(svgIn, { repos: 95, stars: 12, lastPush: '2 hours ago' });
assert.match(svgOut, /data-k="repos">95</, 'repos patched');
assert.match(svgOut, /data-k="stars">12</, 'stars patched');
assert.match(svgOut, /<text>keep<\/text>/, 'everything else untouched');
assert.equal(R.applyStats(svgIn, {}), svgIn, 'an empty fetch changes nothing');
assert.match(R.applyStats('<text data-k="topLang">JS</text>', { topLang: 'Kotlin & Kotlin' }), /Kotlin &amp; Kotlin/, 'text is escaped');
assert.match(R.applyReadme('<span data-k="updated">October 2026</span>', { updated: 'November 2026' }), /November 2026/);
ok('refresh: numbers are patched, everything else is byte-identical, text is escaped');

// the real files: patching with the same values is a no-op
const heroText = read('assets/hero.svg');
const same = R.applyStats(heroText, { repos: 92, stars: 12, followers: 6 });
assert.equal(same, heroText, 'patching the current numbers changes nothing');
ok('refresh: idempotent on the committed art (no noisy diffs every night)');

// ---------------------------------------------------------------------------
// 6. the workflow is safe and scheduled
// ---------------------------------------------------------------------------
const wf = read('.github/workflows/refresh.yml');
assert.match(wf, /schedule:/);
assert.match(wf, /cron:/);
assert.match(wf, /contents: write/, 'it may push its own commit');
assert.match(wf, /node scripts\/make-art\.mjs/, 'it regenerates the art first');
assert.match(wf, /node scripts\/refresh-live\.mjs/);
assert.match(wf, /git diff --cached --quiet/, 'it commits only when something changed');
assert.match(wf, /workflow_dispatch/, 'it can be run by hand');
ok('workflow: nightly + manual, regenerates, refreshes, commits only on change');

// ---------------------------------------------------------------------------
// 7. the generator is the single source and is deterministic
// ---------------------------------------------------------------------------
const before = Object.fromEntries(ART.map((x) => [`${x}.svg`, read(`assets/${x}.svg`)]));
execFileSync(process.execPath, [P('scripts/make-art.mjs')], { cwd: path.join(root, 'profile'), stdio: 'pipe' });
for (const [file, old] of Object.entries(before)) {
  assert.equal(read(`assets/${file}`), old, `${file}: generated deterministically`);
}
ok('generator: scripts/make-art.mjs rewrites the same bytes (safe for the nightly job)');

// ---------------------------------------------------------------------------
// 8. the shop repo keeps its own copies in sync (served at /brand/profile)
// ---------------------------------------------------------------------------
for (const name of ART) {
  const a = fs.readFileSync(path.join(root, 'public/brand/profile', `${name}.svg`), 'utf8');
  const b = read(`assets/${name}.svg`);
  assert.equal(a, b, `${name}.svg is identical in the shop and in the profile package`);
}
ok('sync: the same art ships in the shop (public/brand/profile) and in the profile package');

console.log(`\n${n} checks passed (v35: pro profile README)`);
