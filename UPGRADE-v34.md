# v34 — THE README IS ALIVE (animated SVG art) + CI

The README was a normal document: text, badges, no motion. Now it moves like a live
video — a pulsing LIVE badge, a typing line, a rotating logo, a live waveform, a moving
progress bar and an endless news tape — and every answer about *how* to build such a
README is written down in the repo.

---

## 1. The art (self-hosted, so it can never break)

`node scripts/make-readme-art.mjs` → `public/brand/readme/*.svg`

| file | what moves |
| --- | --- |
| `hero.svg` (1200×430) | rotating dotted rings around the crescent logo, gold wordmark, a typing line with a blinking caret, pulsing **LIVE** badge + radar ring, "live screen" with a scan line, 22-bar waveform, moving progress bar, scrolling tape at the bottom |
| `logo.svg` (260×260) | the MIZANORA mark on its own: emerald tile, gold crescent (masked), 8-point star, two rings turning in opposite directions, twinkling stars |
| `live.svg` (1200×150) | "NOW PLAYING": LIVE dot + ring, three titles that take turns (Quran → Hadees → product ad), moving progress bar, PKT clock, mini tape |
| `wave.svg` (1200×120) | 58-bar live audio meter, every bar with its own delay and speed |
| `marquee.svg` (1200×84) | endless `SHOP SMART ✦ SHOP HALAL ✦ CASH ON DELIVERY …` tape |

Why self-hosted instead of a service:

- GitHub strips `<script>`/`<style>` from a README, but **renders an SVG `<img>` and plays the CSS
  keyframes and SMIL inside it** — that is the whole trick;
- nothing can 404, nothing is rate-limited, and the shop repo does not depend on a stranger's server;
- the same files are served by the site as `/brand/readme/hero.svg` (checked: `200 image/svg+xml`).

Every file:

- has `viewBox` **and** `width`/`height`;
- uses `transform-box: fill-box` (so each shape spins around itself, not around `0,0`);
- uses `animation-fill-mode: both` for delayed items (so titles wait their turn instead of all showing);
- puts every animated class inside a `@media (prefers-reduced-motion: reduce)` block **and** makes the
  text visible in that mode (a static banner, never an empty one);
- has no script, no external font, no external image, and stays under 100 kB.

## 2. The README

- Logo → hero → live bar → waveform → tape at the top (all centred, full width).
- Live badges (site, live channel, GitHub feed, stars, forks, issues, PRs, last commit, size, Next.js,
  Tailwind, Firebase, PWA, Ads API).
- A new section **“Animated README — poori guide”** in Roman Urdu: what GitHub strips, what works,
  copy-paste snippets (pulse, radar ring, typing, marquee, waveform, spinning rings, sheen), the three
  classic mistakes, how to regenerate the art, the ready-made services, the daily GitHub Action, and a
  troubleshooting list (5-minute cache, `?v=2`, Preview apps, relative paths).
- Deep docs: [`docs/README-ANIMATION.md`](docs/README-ANIMATION.md) and a copy-paste profile README
  [`docs/PROFILE-README.md`](docs/PROFILE-README.md).

## 3. CI (the "checks" badge is now real)

`.github/workflows/ci.yml` runs on every push and PR: `npm ci` → `npm run check` → `npm test` →
`npm run build:offline`. Before this the README linked to a workflow that did not exist.

## 4. Tests

`node scripts/test-v34.mjs` — 6 checks:

1. five real SVGs: namespace, viewBox, width/height, `<style>`, keyframes, reduced motion, no script,
   no external asset, under 100 kB, `role="img"` + `aria-label`;
2. the motion is really there (LIVE dot, ring, typing, caret, 58 bars with distinct delays, progress,
   tape, rotating rings, scan line, real channel text);
3. reduced motion turns every animated class off **and** keeps the text visible;
4. the README shows all five files with repo-relative paths, plus the guide and the regeneration command;
5. the docs contain the real answers (SMIL, `fill-box`, `fill-mode: both`, cron, `?v=2`);
6. the generator is deterministic — re-running it changes nothing, so it is safe in CI.

`npm test` now runs 25 files (235 `ok` lines).
