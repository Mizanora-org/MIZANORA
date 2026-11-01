# Mizanora v37 — Live TV by Login, Open Analytics, and a News Desk

Version **37.0.0**. Branch `arena/ac8e9ee6-mizanora`.

v37 does five things:

1. **Live TV can now be connected with an Xtream Codes username and password** — not just an M3U file.
2. **The dashboard analytics got much deeper**, and part of them is now **public**.
3. **A news desk** (`/news`) for world, science and technology — written as blogs, so every dispatch indexes on its own.
4. **Eleven new articles**: 3 world, 2 science, 2 technology, 2 about Muaaz Iqbal, 2 supporting **BarakatWave TV** and **SIRAVEX**.
5. **A dedicated RSS feed** for the news desk, and `/news` + `/stats` in the sitemap.

Gates: `npm run check` 407 files / 0 problems · `node scripts/typecheck.js` clean · `npm test` green (incl. `scripts/test-v37.mjs`).

---

## 1. Live TV: connect a whole panel, not just a playlist

Before v37, an admin could only paste an M3U file. Most IPTV providers do not hand out
files — they hand out a **server, a username and a password**. v37 speaks that language.

### New files

| File | What it does |
| --- | --- |
| `lib/xtream.js` | The Xtream Codes client. Builds `player_api.php` URLs, calls the panel, normalises whatever it returns into Mizanora's channel shape. |
| `lib/xtreamServer.js` (where present) | Server-side helpers for the same job. |
| `app/api/admin/tv/xtream/route.js` | The admin-only API: `test` a connection and `import` channels. |
| `components/XtreamImport.js` | The UI: three fields, a **Test connection** button, group chips, and a live/movies/series switch. |

### What it can import

- **Live TV**, **movies (VOD)** and **series**, each with its own category list.
- **By group** — tap the groups you want, or leave it blank for everything.
- Optionally **force HLS (`.m3u8`)** instead of the panel's default stream.

### The safety rules (these matter)

| Rule | Why |
| --- | --- |
| **Admin-only.** The API checks an admin session on every call. | A panel login is a credential, not a public URL. |
| **No private or loopback addresses.** `127.0.0.1`, `10.x`, `192.168.x`, `::1` and friends are refused before the request is made. | Stops the endpoint being used to probe the host's own network. |
| **No redirect following.** The fetch is `redirect: 'manual'`. | Stops an open redirect walking the request somewhere unintended. |
| **Body capped** (~8 MB) and **timeout** (~20 s). | A hostile or broken panel cannot hang or flood the server. |
| **Nothing is stored.** The credentials are used for one request and are never written to a log, the database, or back into the browser response. | The admin's provider login stays the admin's. |

After an import, the channels appear in the ordinary editor — so **Check all channels**,
**Save**, and the usual on/off switches all work exactly as they did for M3U.

### Try it with BarakatWave

BarakatWave gives every signed-in user a free personal Xtream server. The step-by-step
walkthrough — including what each error message means — is
[the BarakatWave Xtream setup guide](/blog/barakatwave-tv-xtream-codes-setup-guide).

---

## 2. Analytics: deeper, and partly public

### The dashboard (`/admin/dashboard`)

`app/api/admin/analytics/route.js` now reads two more metric families (`pg` per-page views,
`rt` return-visit flags) and returns five new blocks:

| Block | What it answers |
| --- | --- |
| `days` | 3 to **90 days** of history (was a much shorter window). |
| `topPages` | Which pages actually get read. |
| `newVsReturning` | How many visitors came back. |
| `byHour` | What time of day the shop is busy. |
| `byWeekday` | Which day of the week is strongest. |
| `totals` | All-time views, unique visitors, orders and sales. |

`lib/track.js` now records a `pageKey` for every view, and `database.rules.json` allows the
`pg` and `rt` paths.

### The public part (`/stats`)

New. **No sign-in, no admin.** A live page showing:

- how many people are **on the site right now** (anyone seen in the last 90 seconds),
- views today and over the last 14 days, with a sparkline,
- the **most-read pages**,
- the **device split** (mobile / tablet / desktop),
- where the traffic **comes from**.

It refreshes every 60 seconds. `app/api/stats/route.js` is cached for 60 s at the edge.

**The privacy contract** — this is deliberate and should not be broken by future edits:

> `/api/stats` exposes **totals only**. It returns no visitor ids, no presence records,
> no order contents, no cart contents and no search words. The online number is a **count**,
> never a list.

`/stats` explains this to the reader in plain words, because a page about data that does
not say what it hides is not a trustworthy page about data.

---

## 3. The news desk

`/news` is new. It gathers the **world-news**, **science** and **technology** shelves into
one desk with tabs (Everything / World / Science / Technology), a lead story with its
cover image, and a card grid for the rest.

- `app/news/page.js` — the page (metadata, breadcrumb JSON-LD, category cards).
- `components/NewsDesk.js` — the client desk.
- `app/news/feed.xml` — **a dedicated RSS feed for the news desk only**, so `/news` can be
  followed without subscribing to the shopping-guides feed.
- `lib/blog.js` — three new shelves (`world-news`, `science`, `technology`), exported as
  `NEWS_CATEGORIES`, with labels and blurbs. No existing post was re-filed into them.

### Why it is written as blogs

Because a news ticker does not index. **Every dispatch is a dated article with its own
URL, its own title and its own structured data** — and each one links to at least two
pages inside the shop. That is how a news section also becomes traffic.

### The editorial rule

Each dispatch does three things: **what happened → what it changes for a reader in
Pakistan → where the number came from.** Anything that would be a rehashed press release
does not get written. Uncertain things are labelled uncertain.

---

## 4. The writing

Eleven new posts (136 total on the site):

### World news (3)

| Post | Angle |
| --- | --- |
| [The world economy in late 2026](/blog/world-economy-2026-what-it-means-for-pakistani-shoppers) | Debt past $40T, sticky inflation, energy as the hinge — and what each does to a Pakistani basket. |
| [Why your delivery charge moved](/blog/oil-prices-and-your-delivery-charge-pakistan-2026) | Diesel → freight → delivery. The four places fuel touches a parcel, and how to pay less. |
| [Tariffs, trade and import prices](/blog/global-trade-tariffs-2026-why-imports-cost-what-they-do) | The five cost layers on an imported gadget, and which one you can actually avoid. |

### Science (2)

| Post | Angle |
| --- | --- |
| [Five space discoveries of 2026](/blog/science-of-space-2026-five-discoveries-explained) | Interstellar sugar, the first confirmed atmosphere on a habitable-zone rocky planet, super-puffs, 11,000 asteroids, lunar ice and oxygen. |
| [Did we find life on Mars?](/blog/mars-life-clues-2026-what-curiosity-actually-found) | Seven new organic molecules, the 2026 Nobels, and the difference between a clue and a discovery. |

### Technology (2)

| Post | Angle |
| --- | --- |
| [AI is eating the world's electricity](/blog/ai-data-centres-energy-2026-why-it-reaches-your-phone) | 460 → 945 TWh, $600bn capex, 23% of DRAM wafers — and the chain that reaches a phone in Kasur. |
| [Chip scarcity in 2026](/blog/chip-shortage-2026-gadget-prices-pakistan) | What is genuinely short, the four tricks that get worse in a shortage year, and how not to overpay. |

### Muaaz Iqbal (2)

| Post | Angle |
| --- | --- |
| [His character](/blog/muaaz-iqbal-personality-trust-why-people-believe-him) | Six habits: admitting what is broken, answering the phone, writing it down, never inventing a number, building for the person with the least, staying teachable. |
| [Every project, mapped](/blog/muaaz-iqbal-projects-map-2026) | Mizanora, BarakatWave TV, SIRAVEX, Asaan Lang, HijriAnchor, MIO — and the one idea running through all of them. |

### BarakatWave & SIRAVEX (2)

| Post | Angle |
| --- | --- |
| [BarakatWave → Mizanora Live TV](/blog/barakatwave-tv-xtream-codes-setup-guide) | Get the free Xtream server, test it, import channels by group, and what each error means. |
| [SIRAVEX multi-view player](/blog/siravex-multi-view-iptv-player-guide) | Xtream vs M3U, four channels at once without wrecking your connection, and where it fits the ecosystem. |

---

## 5. Search / index

- `/news` → sitemap, priority **0.8**, daily.
- `/stats` → sitemap, priority **0.5**, daily.
- `/news/feed.xml` → a second RSS feed (the main `/blog/feed.xml` stays shopping-focused).
- Every dispatch carries breadcrumb + `CollectionPage`/`ItemList` structured data.

---

## Files changed

**New:** `lib/xtream.js`, `lib/xtreamServer.js`, `app/api/admin/tv/xtream/route.js`,
`components/XtreamImport.js`, `app/api/stats/route.js`, `app/stats/page.js`,
`components/PublicStats.js`, `app/news/page.js`, `app/news/feed.xml/route.js`,
`components/NewsDesk.js`, `UPGRADE-v37.md`, `scripts/test-v37.mjs`, 11 blog posts.

**Edited:** `app/api/admin/analytics/route.js`, `app/admin/tv/page.js`, `lib/track.js`,
`lib/blog.js`, `app/sitemap.js`, `database.rules.json`, `package.json` (37.0.0 + test chain),
`package-lock.json`.

---

## What is still open

- The **dashboard charts** for `topPages`, `newVsReturning`, `byHour` and `byWeekday` are
  served by the API but not yet drawn in `components/Charts.js` — the data is there, the
  graphs are next.
- A **Google Search Console** submit run (`node scripts/search-console.mjs`) should be done
  once this is deployed, so the eleven new URLs and the two new routes are queued early.
- The three news shelves need a **steady cadence**: one dispatch each per week is enough to
  keep `/news` fresh in Google's eyes.
