# v35 — A PRO-LEVEL GITHUB PROFILE (generated, animated, self-updating)

The profile at <https://github.com/muaaziqbalvip> already looked good as *text*. Now its pictures
move, they have a light and a dark version, and the numbers inside them are refreshed by a workflow
instead of being typed once and forgotten.

Everything is written here, in the shop repo, and shipped as a ready package:
[`profile/`](../profile/SETUP.md).

---

## 1. What was built

`node scripts/make-profile-art.mjs` → 18 files in `public/brand/profile/` (and the same files in
`profile/assets/`):

| file (dark + `-light`) | what moves |
| --- | --- |
| `hero.svg` (1200×420) | rotating monogram rings, gradient name with a sweep, a typed line with a blinking caret, a rotating "currently …" line, three chips (one with a live dot), and a **live card**: pulsing LIVE badge + radar ring, three titles taking turns, 20-bar waveform, moving progress bar, `92 repos · 12 stars · 6 followers` |
| `ticker.svg` (1200×68) | endless tape — MIZANORA ✦ ASAAN LANG ✦ BARAKATWAVE TV ✦ SIRAVEX … |
| `live.svg` (1200×124) | "LIVE right now": LIVE chip, channel line, three rotating titles, waveform + progress, `LATEST PUSH MIZANORA · 2 days ago`, `HTML · 92 REPOS`, `12 STARS · 6 FOLLOWERS` |
| `stats.svg` (1200×300) | six number cards that pop in one by one (repos, stars, products, channels, tools, projects) |
| `languages.svg` (1200×210) | a share bar that grows segment by segment + a legend (share of **repositories**, not bytes) |
| `projects.svg` (1200×320) | six project cards revealed in turn, each with a stack pill |
| `tech-stack.svg` (1200×250) | four shelves of pills (languages, frameworks, AI, ship & stream) |
| `philosophy.svg` (1200×190) | “Unchi soch. Chhote qadam.” with a rule that draws itself and three rules that appear one by one |
| `logo.svg` (220×220) | the mark on its own — spinning rings, twinkling stars |

Every file: `viewBox` + explicit size, CSS keyframes inside the file, `transform-box: fill-box`,
`animation-fill-mode: both` where delayed, a `prefers-reduced-motion` block that **keeps the text
visible**, no `<script>`, no external font/image, under 110 kB, `role="img"` + `<title>`.

## 2. The numbers stay true (this is the “pro” part)

Each changing value is marked in the SVG:

```svg
<tspan font-size="17" font-weight="800" fill="#64E7B0" data-k="repos">92</tspan>
```

`profile/scripts/refresh-live.mjs`:

1. reads the public GitHub API (account, repositories, stars, followers, latest push, top language);
2. reads the shop’s `/api/github` (the same account, already normalised and cached);
3. rewrites **only the text** inside those `data-k` tags, plus the “Last refreshed” line in the README.

Nothing else is touched — the animation, colours, layout and words stay exactly as generated.
A dry run with the current numbers produced **zero changes**, so the nightly commit is quiet.

`profile/.github/workflows/refresh.yml` runs at 02:17 UTC: regenerate the art → refresh the numbers →
commit **only if something changed** (and it can be started by hand).

## 3. Light and dark

The README picks the right file for the reader’s theme:

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/hero.svg" />
  <source media="(prefers-color-scheme: light)" srcset="./assets/hero-light.svg" />
  <img src="./assets/hero.svg" alt="…" width="100%" />
</picture>
```

The light palette is a real palette (`#F3FBF7` background, `#0B2A1E` ink, `#12A06B` accent), not a
filter — checked by rendering both with resvg.

## 4. The README itself

`profile/README.md` keeps everything that already existed (the story, the flagship work, the “rest of
the lab” shelf, the mermaid diagram, the contact table, “everywhere else”) and adds:

- hero → ticker → badges → **live strip** at the top, each with a light/dark pair;
- the numbers banner and the language bar right under the intro;
- project cards, tech-stack shelves and the philosophy line in the sections they belong to;
- a new section **“How this profile stays alive”** — what is generated, where the numbers come from,
  how the theme switch works, reduced motion — plus a 4-line “add your own animation” snippet;
- a link to the shop’s live `/api/github`, so the profile and the website can never disagree.

## 5. Setup

The package is complete but the profile repository is a **different repo**, and the token available
here can read it but not write to it. So the last step is yours (5 minutes):

```bash
gh repo clone muaaziqbalvip/muaaziqbalvip
cp -r profile/. ./muaaziqbalvip/       # from this repo
cd muaaziqbalvip && git add -A && git commit -m "profile: animated art + live numbers" && git push
```

Then **Settings → Actions → General → Workflow permissions → Read and write**, so the nightly job can
push its own commit. Full notes: [`profile/SETUP.md`](../profile/SETUP.md).

## 6. Tests

`node scripts/test-v35.mjs` — 10 checks: all 18 files exist and are valid, self-contained, animated,
reduced-motion safe and under 110 kB; dark and light really differ; the motion classes the profile
needs are present; every changing number carries `data-k`; every image the README points at exists and
the `<picture>` tags balance; the refresh functions patch only the marked text (and are escaped,
idempotent, `ago()` never says “1970”); the workflow is nightly + manual + commit-only-on-change; the
generator is deterministic; and the shop keeps an identical copy in `public/brand/profile`.

`npm test` now runs 26 files (245 `ok` lines).
