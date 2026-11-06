# Mizanora v59 — real release dates, a complete sitemap, and songs everywhere

> **Scope:** movies & series systems only (as instructed), plus the two things that were reported broken:
> the **release calendar dates** and **songs in the sitemap + site search**. No home-page redesign.

---

## 1. Release calendar — real dates, not "date TBA"

**The problem:** the offline IMDb snapshot only stores a *year* (`data/imdb-seed.json` has `i, t, y, g, r, d, c, l, dir, ca, s` — no day). So
`buildReleaseCalendar()` grouped every title under `2026 — date TBA`, and `/movies` showed
`(0 Upcoming)` because nothing carried a future date.

**The fix — `lib/releaseDates.js` (new):**

| Function | What it does |
|---|---|
| `dateFromMeta(meta)` | Turns Cinemeta's meta block into a strict `YYYY-MM-DD`. Accepts `released: "2026-12-18T00:00:00.000Z"`, a plain date, or `releaseInfo`. **Prose like "Coming soon" returns `''` — nothing is invented.** |
| `releaseDateFor(imdbId)` | `https://v3-cinemeta.strem.io/meta/{movie|series}/<id>.json` for one id, with a 12-hour in-memory cache and a 5 s abort. |
| `enrichReleaseDates(movies, {limit, budgetMs, concurrency})` | Fills `m.releaseDate` in place, flips `m.status` to `upcoming`/`released` from the actual date, and repairs `m.year`. Budgeted (8 s) and concurrent (12) so a serverless render can never hang. Only titles from the current year onwards (or already marked upcoming) are asked about. |
| `countUpcoming(movies)` | Counts real future dates only. |

**`app/movies/calendar/page.js`** now calls `enrichReleaseDates(movies, { limit: 200, budgetMs: 8000, concurrency: 12 })`,
exports `maxDuration = 20`, and prints how many dates are exact:

> `N upcoming releases · M exact dates confirmed`

**`lib/movies.js` → `buildReleaseCalendar()`**: the `<year> — date TBA` bucket now sorts **after** every
month that has a real date (stable sort, so month order inside the dated groups is untouched).
A calendar that opens on "date TBA" was the most obvious symptom of the old behaviour.

**`app/movies/page.js`**: the badge no longer prints a bare `(0 Upcoming)`.

**Two more date bugs found while wiring this up:**

1. **`lib/cinemeta.js` threw away every real release date.** `movieFromCinemeta()` tested
   `meta.released` with `/^\d{4}-\d{2}-\d{2}$/`, but Cinemeta sends a full timestamp
   (`2026-12-18T00:00:00.000Z`) — so the test never matched and every card lost its day. It now slices
   the day, rejects `0000-00-00`-style placeholders, and sets `upcoming`/`released` from the actual date.
2. **Nothing in the calendar was genuinely in the future.** The committed snapshot stops at the current
   year, so "0 upcoming releases" was arithmetically true. New `upcomingFromPool()` reads the id pool
   (`data/imdb-ids.txt` carries next year's announcements), asks Cinemeta for a card for the few ids whose
   year is in the future, and keeps only the ones that really are upcoming — budgeted (6 s, 10 workers).
   The page header now says `N upcoming releases · M exact dates confirmed` when there are any, and
   otherwise states plainly that the next release has not been announced yet.

If Cinemeta cannot be reached, the calendar keeps its old honest behaviour — dates stay empty rather
than being guessed.

---

## 2. Sitemap — every title, every actor, every song

### 2.1 `titles-unknown.xml` (new)
Two ids in `data/imdb-ids.txt` have no usable year (`tt8206668`, `tt21030032`). They could never fall
into a `titles-YYYY.xml` file, so they silently fell out of the sitemap. `/sitemaps/titles-unknown.xml`
now publishes them, and `/sitemap-index.xml` lists that file whenever the pool contains such ids.

### 2.2 Actor files — the whole letter, not the first 200
`seedActorRows()` clamps `limit` at **200** (it feeds on-screen lists). The letter sitemaps were passing
`limit: 40000` and silently getting 200. New `seedActorSlugs({letter, minTitles, limit})` in
`lib/imdbSeed.js` returns the full letter:

| letter | before | after |
|---|---|---|
| j | 200 | **1,181** |
| s | 200 | **810** |
| every letter | — | A–Z, **10,394 cast members** with 3+ titles |

`/sitemaps/actors.xml` (the directory file) went from ≤ a few hundred to **10,756 URLs**.

### 2.3 The index knows about all of it
`app/sitemap-index.xml/route.js` uses the new `seedActorLetters(3)` helper (one pass over the cast
index instead of 26 filtered passes) and lists `titles-unknown.xml` when needed. With the committed
pool the index now advertises **151 files**.

### 2.4 The human guide stays truthful
`/sitemaps` — file count now includes the unknown-year file, the actor row reports
`10,394 cast + curated` instead of only the curated list, and the "how to add more titles" card
states the **committed pool size** (`86,783` ids) next to the 500,000 ceiling of `npm run imdb:ids`.
No page claims 500k titles while the committed file holds 86,783.

---

## 3. Songs — sitemap and search, in full

### 3.1 `getSongsForSitemap()` — bigger and cheap
* Searches `SONG_QUERIES` **and** every `ARTIST_PROFILES` name (23 queries × 40 results), dedupes by song id,
  and returns `{ songs (≤900), artists (≤4000), generatedAt }`.
* Singers come from the songs themselves (not a fixed list), and the hand-written profiles are always
  included so a mirror hiccup cannot empty the artist files.
* **New:** the whole catalogue is memoised for 6 hours and de-duplicated in flight. `songs.xml` plus one
  file per letter ask for it ~28 times per revalidation — only the first caller pays for the searches.

### 3.2 Site search
`components/SearchSongsBlock.js` shows the matches **with play/pause on every row**, a *Play all* queue,
same-origin artwork via `/api/songs/cdn` (through `songImageSrc`), an explicit empty state that links to
`/songs?q=…`, and an *All songs →* link. `app/search/page.js` now advertises songs in its title,
description, intro and placeholder (`Kesariya`, `Atif Aslam`).

### 3.3 Playback stays correct
`song.url` from JioSaavn is a **web page**, never audio. `lib/songs.js` keeps it in `permalink` and out of
`audioSources` / `stream`; only CDN media is playable.

---

## 4. Verification

```bash
npm run check     # 489 files, 0 problems
npm test          # includes the new 76-check v59 suite
rm -rf .next && npm run build:offline
```

Offline smoke test of the built server (`next start`):

| URL | Result |
|---|---|
| `/sitemap-index.xml` | 200 · **151** files |
| `/sitemaps/titles-unknown.xml` | 200 · 2 ids |
| `/sitemaps/titles-1894.xml` | 200 · the 1894 film the old 1900 floor used to drop |
| `/sitemaps/actors-j.xml` | 200 · **1,201 URLs** |
| `/sitemaps/actors-s.xml` | 200 · **854 URLs** |
| `/sitemaps/actors.xml` | 200 · **10,756 URLs** |
| `/sitemaps/blog.xml` | 200 |
| `/sitemap.xml` | 200 · **12,183 URLs** |
| `/movies/calendar`, `/search?q=atif`, `/sitemaps` | 200 |

`scripts/test-v59.mjs` (76 checks) proves the behaviour without any network: it stubs `fetch` to return
Cinemeta-shaped payloads and asserts that dates are filled, statuses flip, limits/budgets hold, prose is
rejected, TBA groups sort last, letter files are complete, the songs feed is memoised and search is playable.

**What cannot be proven from the sandbox:** this environment reaches GitHub/npm only. Cinemeta, the music
mirrors, metahub and saavncdn are all blocked here, so *live* date lookups and *live* song playback must be
confirmed on the deployed site (`https://mizanora.vercel.app/movies/calendar`). If Cinemeta is unreachable at
request time the page degrades to the honest "date TBA" grouping — by design.
