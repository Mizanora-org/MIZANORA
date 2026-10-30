// v34 tests: the animated README art (self-hosted SVG that moves inside a GitHub <img>).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const exists = (f) => fs.existsSync(path.join(root, f));
let n = 0;
const ok = (msg) => { n++; console.log('ok    ' + msg); };

const ART = ['hero', 'logo', 'live', 'wave', 'marquee'];
const artPath = (name) => `public/brand/readme/${name}.svg`;

// ---------------------------------------------------------------------------
// 1. every art file exists and is a real, small, animated SVG
// ---------------------------------------------------------------------------
for (const name of ART) {
  assert.ok(exists(artPath(name)), `${name}.svg exists`);
  const svg = read(artPath(name));
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, `${name}: real SVG root with the namespace`);
  assert.match(svg, /viewBox="0 0 \d+ \d+"/, `${name}: viewBox`);
  assert.match(svg, /width="\d+" height="\d+"/, `${name}: width and height (older renderers need them)`);
  assert.match(svg, /<style>/, `${name}: CSS lives inside the file`);
  assert.match(svg, /@keyframes mz-/, `${name}: at least one keyframe animation`);
  assert.match(svg, /prefers-reduced-motion/, `${name}: a reduced-motion switch`);
  assert.ok(!/<script/i.test(svg), `${name}: no script (GitHub would strip it anyway)`);
  assert.ok(!/https?:\/\/(?!www\.w3\.org)/.test(svg.replace(/xmlns="[^"]+"/g, '')), `${name}: no external asset / font`);
  assert.ok(Buffer.byteLength(svg) < 100 * 1024, `${name}: under 100 kB (${Math.round(Buffer.byteLength(svg) / 1024)} kB)`);
  assert.match(svg, /role="img"[\s\S]*aria-label="[^"]+"/, `${name}: readable by a screen reader`);
}
ok('art: 5 self-contained animated SVGs, no script, no external font, under 100 kB');

// ---------------------------------------------------------------------------
// 2. the motion is really there (the pieces a "live" banner needs)
// ---------------------------------------------------------------------------
const hero = read(artPath('hero'));
assert.match(hero, /class="live-dot"/, 'hero: a pulsing LIVE dot');
assert.match(hero, /class="ring"/, 'hero: the radar ring around it');
assert.match(hero, /class="ch"/, 'hero: the typing line');
assert.match(hero, /class="caret"/, 'hero: a blinking caret');
assert.match(hero, /class="bar"/, 'hero: the waveform bars');
assert.match(hero, /class="fill"/, 'hero: a moving progress bar');
assert.match(hero, /class="tape"/, 'hero: the scrolling tape');
assert.match(hero, /class="spin-slow"/, 'hero: the rotating logo ring');
assert.match(hero, /class="scan"/, 'hero: the scan line over the live screen');
assert.match(hero, /MIZANORA/, 'hero: the MIZANORA wordmark');
assert.match(hero, /Quran Tilawat/, 'hero: real channel content, not a lorem ipsum');
assert.match(hero, /transform-box:fill-box/, 'hero: shapes animate around their own centre');
assert.match(hero, /animation-fill-mode:both|infinite both/, 'hero: delayed items stay hidden until their turn');

const live = read(artPath('live'));
assert.match(live, /NOW PLAYING/i);
assert.equal((live.match(/class="fade\d"/g) || []).length, 3, 'live: three titles take turns');
assert.match(live, /\.fade1,\.fade2,\.fade3\{opacity:0;/, 'live: the later titles start invisible');

const wave = read(artPath('wave'));
const bars = (wave.match(/class="bar"/g) || []).length;
assert.ok(bars >= 40, `wave: ${bars} bars (a real meter look)`);
const delays = new Set((wave.match(/animation-delay:[0-9.]+s/g) || []));
assert.ok(delays.size > 20, 'wave: every bar has its own delay (no marching in step)');

const logo = read(artPath('logo'));
assert.match(logo, /mask id="logo-cut"/, 'logo: the crescent is cut with a mask');
assert.match(logo, /class="twinkle"/, 'logo: twinkling stars');
const marquee = read(artPath('marquee'));
assert.match(marquee, /SHOP SMART/);
assert.match(marquee, /translateX\(-/, 'marquee: it really slides');
ok(`motion: LIVE dot + ring + typing + caret + waveform (${bars} bars) + progress + tape + rotating logo`);

// ---------------------------------------------------------------------------
// 3. reduced motion really turns everything off
// ---------------------------------------------------------------------------
for (const name of ART) {
  const svg = read(artPath(name));
  const block = svg.slice(svg.indexOf('@media (prefers-reduced-motion: reduce)'));
  const list = block.slice(0, block.indexOf('}'));
  for (const cls of ['.ch', '.bar', '.tape', '.live-dot', '.ring', '.spin-slow', '.glow', '.twinkle']) {
    if (!svg.includes(`class="${cls.slice(1)}"`)) continue;
    assert.ok(list.includes(cls), `${name}: ${cls} is stopped for reduced motion`);
  }
  assert.ok(/\.ch[^{]*\{opacity:1\}/.test(block), `${name}: with reduced motion the text is fully visible, not blank`);
}
ok('reduced motion: every animated class is switched off and the text still shows');

// ---------------------------------------------------------------------------
// 4. the README actually shows them (relative paths = no third-party host)
// ---------------------------------------------------------------------------
const readme = read('README.md');
for (const name of ART) {
  assert.ok(readme.includes(`src="public/brand/readme/${name}.svg"`), `README shows ${name}.svg from the repo itself`);
  assert.ok(exists(artPath(name)), `${name}.svg is committed next to the README`);
}
assert.match(readme, /<img src="public\/brand\/readme\/hero\.svg"[^>]*width="100%"/, 'the hero is full width');
assert.match(readme, /img\.shields\.io/, 'README keeps the live badges');
assert.match(readme, /# Animated README/, 'README explains how the animation is made');
assert.match(readme, /readme-typing-svg/, 'README lists the ready-made services');
assert.match(readme, /prefers-reduced-motion/, 'README documents reduced motion');
assert.match(readme, /docs\/README-ANIMATION\.md/, 'README links the full animation guide');
assert.match(readme, /docs\/PROFILE-README\.md/, 'README links the profile template');
assert.match(readme, /make-readme-art\.mjs/, 'README says how to regenerate the art');
ok('README: all five SVGs on the page, plus the guide and the regeneration command');

// ---------------------------------------------------------------------------
// 5. the docs exist and contain the real answers
// ---------------------------------------------------------------------------
const guide = read('docs/README-ANIMATION.md');
assert.match(guide, /<script>[\s\S]{0,40}remove|remove/i, 'guide: GitHub strips <script>');
assert.match(guide, /SMIL|<animate>/, 'guide: SMIL works inside an SVG');
assert.match(guide, /transform-box: fill-box/, 'guide: the classic transform-origin trap');
assert.match(guide, /animation-fill-mode: both/, 'guide: the delayed-item trap');
assert.match(guide, /cron/, 'guide: a daily GitHub Action');
assert.match(guide, /\?v=2/, 'guide: the image cache');
const profileDoc = read('docs/PROFILE-README.md');
assert.match(profileDoc, /readme-typing-svg/);
assert.match(profileDoc, /github-readme-stats/);
assert.match(profileDoc, /gh repo create/, 'profile template: the one command that creates the special repo');
ok('docs: animation guide (what GitHub allows, the traps, the Action) + profile template');

// ---------------------------------------------------------------------------
// 6. regenerating is safe: the script rewrites exactly the same bytes
// ---------------------------------------------------------------------------
const before = Object.fromEntries(ART.map((x) => [x, read(artPath(x))]));
execFileSync(process.execPath, [path.join(root, 'scripts', 'make-readme-art.mjs')], { cwd: root, stdio: 'pipe' });
for (const name of ART) assert.equal(read(artPath(name)), before[name], `${name}: the generator is deterministic`);
ok('generator: re-running scripts/make-readme-art.mjs changes nothing (safe to put in CI)');

console.log(`\n${n} checks passed (v34: animated README)`);
