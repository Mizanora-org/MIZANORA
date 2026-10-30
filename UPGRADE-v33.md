# v33 — PURE LIVE (badges + animations) and GITHUB ON THE WEBSITE

Two things were asked for: the live side of Mizanora should *feel* live (real animations, real
badges, nothing fake), and GitHub should be properly attached to the website.

---

## 1. One badge, every surface

`lib/liveBadges.js` + `components/LiveBadge.js`

| state | look | where |
| --- | --- | --- |
| `live` | red gradient, white dot beating, slow sheen | on air, ACTIVE repo, PLAYING reel |
| `soon` | amber, dark dot | starts soon, LIVE DEMO, CACHED |
| `fresh` | green | NEW content, SYNCED |
| `idle` | grey, no glow | off air, MIT |
| `warn` | orange | stream failed / retry |

- Pure CSS (`app/globals.css`, `.mz-lb*`), only `transform` / `opacity` animate, so phones stay smooth.
- Every animation stops under `prefers-reduced-motion: reduce`.
- Nothing in a badge is invented: the tone comes from `channelStatus`, `comparePrice`, `pushed_at`, or the
  GitHub answer. No "12,438 watching" style numbers exist anywhere.

## 2. The live bar (`components/LiveStrip.js`)

Home page (compact) and `/live` (full). It shows, from left to right:

1. the pulsing badge — `LIVE` when the channel is on air, `OFF AIR` otherwise;
2. what is playing right now: `Quran Tilawat · Al-Baqarah 2:255`, `Hadees · bukhari`, or a product ad;
3. a progress bar for the current block, `N min baqi · phir ...` (what comes next);
4. the Pakistan clock (Asia/Karachi), ticking every second;
5. the number of Live TV channels on air and a **Watch** button;
6. the channel's own ticker lines in a marquee (paused on hover).

Hydration: the server renders a fixed `initialAt`; the first client render uses the same number, the
interval starts after mount. Server and browser can never disagree (`test-v33` checks this).

## 3. Reels and Live TV

- Reel cards: `TRENDING` (first), `NEW` (fresh), `-20% OFF` (only when `comparePrice > price`), plus the
  provider chip; the full-screen viewer shows `PLAYING` / `PAUSED`.
- `/live/<channel>`: `ON AIR` + group badges above the player.
- The player itself carries a pulsing `LIVE / CONNECTING / RETRY` ribbon on the picture.
- The Live TV clock is no longer hidden on phones (only the "LEVELS" chip and the keyboard hints are).

## 4. GitHub, attached

| piece | file |
| --- | --- |
| pure model (profile, repos, languages, badges, fallbacks) | `lib/githubRepos.js` |
| server read, cached 30 min, tag `github` | `lib/githubLive.js` |
| public JSON | `app/api/github/route.js` (`?bare=1`, `?limit=N`) |
| UI | `components/GitHubLive.js` |
| pages | `/muaaz-iqbal` (8 repos), `/team` (4 repos, compact) |
| links | `SITE.social` → footer icon + `/connect` |

- Rate limits are respected: one cached GitHub read per 30 minutes serves every visitor.
- `POST /api/revalidate` with `{"tags":["github"]}` (admin only) refreshes it immediately.
- The optional `GITHUB_TOKEN` is used server side only; the public route never touches it.
- Only `https://` avatar / demo links are rendered (a `javascript:` link is dropped).
- GitHub down / rate limited / offline build: the section renders `FALLBACK_REPOS` with a `CACHED` badge,
  so the page never shows an empty box.

### Environment (all optional)

```
GITHUB_USER=muaaziqbalvip
GITHUB_PINNED=MIZANORA,asaan-lang,BarakatWave-TV
GITHUB_CACHE_SECONDS=1800
NEXT_PUBLIC_GITHUB_URL=https://github.com/muaaziqbalvip
```

## 5. Tests

`node scripts/test-v33.mjs` — 11 checks:

1. badge tones from any word
2. Pakistan clock
3. Roman-Urdu `timeAgo` + `formatCount`
4. now playing (Quran / hadees / ad)
5. live bar on air, off air, scheduled
6. strip model: off-air channels dropped, tickers trimmed
7. reel badges (no fake discount)
8. GitHub model, https-only links, code fallback
9. routes and pages wired
10. every surface uses a badge
11. hydration safety

`npm test` runs it with the rest of the suite; `npm run check` (syntax + imports + typecheck) and
`npm run build:offline` must stay green.
