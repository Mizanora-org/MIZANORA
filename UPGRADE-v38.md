# Mizanora v38 — 100,000 Live TV Channels, Bulk Import, and Editing Tools

Version **38.0.0**.

v38 does what was asked in one go:

1. **Live TV now holds 100,000 channels** (it used to stop at 800).
2. **Xtream Codes can fill the shop by itself** — one press, straight into the database.
3. **Delete every channel at once.**
4. **A full set of small editing tools** in Admin → Live TV.
5. Plus the dashboard charts that were still missing, and a by-hour graph that had never worked.

Gates: `npm run check` 410 files / 0 problems · `node scripts/typecheck.js` clean · `npm test` green (incl. `scripts/test-v38.mjs`, 86 checks).

---

## 1. Why 100,000 needed a new storage shape

A **Firestore document may hold 1 MB.** One channel is 200–1,200 bytes depending on its logo
and its backup links. At 800 channels that was already ~190 KB, and it only gets worse — so the
old design (the whole channel list inside `siteMeta/liveTv`) would have broken somewhere around
2,000–4,000 channels. Not with an error, either: Firestore just refuses the write.

**So the list is sharded:**

```
siteMeta/liveTv                  <- the setting: enabled, title, theme, ads, count, parts
siteMeta/liveTv/channels/p0      <- { n: 1250, channels: [ ... ] }
siteMeta/liveTv/channels/p1      <- { n: 1250, channels: [ ... ] }
...
```

A subcollection does not count towards the size of its parent document, so the setting stays a
few hundred bytes no matter how many channels there are.

**Parts are packed by SIZE as well as by count** (`lib/liveTvStore.js` → `packChannels`). A new
shard starts when either 2,000 channels or ~600 KB of estimated payload is reached, because a
channel with a logo and seven backups is several times bigger than a bare one. Measured:

| Channels | Shards | Largest shard |
| --- | --- | --- |
| 800 | 1 | 190 KB |
| 25,000 | 20 | 306 KB |
| 100,000 | 80 | 306 KB |
| 3,000 "fat" channels (7 backups each) | 12 | 299 KB |

Every one of those is comfortably under 1 MB. Packing 100,000 channels takes **247 ms**.

**Old installs need no migration.** `readTvAll()` still understands the old shape (one
`channels` array inside the setting document) and returns it as-is. The next Save rewrites it
into shards.

### New files

| File | What it does |
| --- | --- |
| `lib/liveTvStore.js` | Pack, read, write and clear the shards. Takes any Firestore handle. |
| `app/api/admin/tv/config/route.js` | Admin-only `load` / `save` / `clear`. Re-validates every link **server-side**. |

Saving used to happen from the browser with the client SDK. It happens on the server now, so a
100,000-channel list can be split into shards and so the validation cannot be skipped by
editing the page in devtools. It checks, per channel: a non-empty name, a usable single http(s)
link with **no credentials inside it**, no two channels sharing a link, and at most 7 backups.

`save` also **deletes shards left over from a longer previous list** — otherwise shrinking from
50 shards to 3 would leave 47 stale shards that silently reappear on the next read.

---

## 2. Xtream: two ways in

`components/XtreamImport.js` now offers both, because a big panel does not fit through a browser tab:

| | Add to the editor | **Straight into the shop** |
| --- | --- | --- |
| What happens | The channels come back to the browser so you can look before you keep them | The **server** pulls the panel, merges, writes the shards, revalidates `/live` |
| Saved? | No — you still press Save | Yes, immediately |
| Right for | A few thousand channels | 10,000+, or any panel that times out |
| Mode | — | **Add to what the shop has** or **Replace everything** |

Only the counts travel back from a straight import, so a 100,000-channel panel takes seconds
instead of freezing the tab.

### The importer no longer downloads 30 MB in one go

`lib/xtreamServer.js` → `pullStreams()`. When the panel publishes categories, the list is
fetched **one category at a time** (`&category_id=…`), four at a time in parallel. Each answer
is a few hundred KB instead of 30 MB, which is the difference between a serverless function
succeeding and timing out. Panels that publish no categories fall back to one bulk fetch.

Limits raised accordingly:

| | Before | Now |
| --- | --- | --- |
| `XTREAM_LIMITS.channels` | 2,000 | **100,000** |
| `XTREAM_MAX_BYTES` (bulk fallback) | 8 MB | **48 MB** |
| `XTREAM_PART_MAX_BYTES` (one category) | — | 12 MB |
| `XTREAM_TIMEOUT_MS` | 20 s | **60 s** |
| Route `maxDuration` | 60 s | 120 s |

The stream reader still **cancels** the moment the cap is passed, so a runaway panel cannot fill
the function's memory, and a timeout now comes back as a readable message ("took too long to
answer — try importing fewer groups at a time") instead of a stack trace.

If someone tries to push more than 20,000 channels **through the browser**, the route says so
and points at the straight-into-the-shop button instead of sending 25 MB of JSON to a tab.

---

## 3. Delete everything at once

- **`components/TvBulkTools.js` → "Delete all channels"** — asks for confirmation, then clears
  the list in the page. Press Save and the shards go with it.
- **`app/admin/tv/page.js` → "Delete all channels from the database"** — calls
  `action: 'clear'` and deletes the shards there and then, keeping the settings and the ads.

Also in the same panel: delete the **ticked** channels, delete the **search results**, delete a
whole **group**, and delete every channel whose links are all **dead**.

---

## 4. The editing tools

New section **"Edit in bulk"** in Admin → Live TV. Every tool works on a **scope** you pick:

| Scope | Means |
| --- | --- |
| **Tick** | Only the channels you ticked |
| **Search** | Only the ones matching the search box |
| **All** | Every channel in the list |

And nothing is saved until you press Save — each tool only edits the list in the browser.

| Tool | What it does |
| --- | --- |
| **Find & replace** | One word across every name, stream link, logo or group. Case-sensitive if you want it. Empty replacement deletes the text. |
| **Prefix / suffix** | Put the same text in front of or behind every name. |
| **Capitalise Each Word** / **Tidy spaces** | Fix names that came out of a panel badly. |
| **Rename group** | Move every channel from one group to another. |
| **Switch a group on / off** | Silence a whole category in one press. |
| **Remove duplicate links** | Keeps the first copy of each stream URL. |
| **Remove duplicate names** | Keeps the first spelling. |
| **Remove all logos** | A fast way to shrink a list that is near the size limit. |
| **Sort A → Z / by group / reverse** | Ordering. |
| **Delete ticked / search results / a group / dead / all** | As above. |

## The channel list is paged

Rendering 100,000 rows would freeze the tab, so the list shows **50 at a time** with
prev/next, "tick page", and "select all N found" (which selects the whole search result, not
just the page). Search covers name, group **and** link.

---

## 5. The dashboard charts that were missing

`app/admin/dashboard/page.js` now draws:

- **Most read pages** — the pages people actually open, over the whole range
- **New vs returning visitors** — a donut with percentages
- **Busiest hours** — added over the range, Pakistan time
- **Busiest days of the week** — *averaged* per weekday, so one viral Monday cannot distort it
- **A totals strip** for the range: views, visitors, orders, sales, views per visitor
- The range selector now goes up to **90 days**

Two new chart primitives in `components/Charts.js`: `Donut` and `HBarChart` (a bar that grows
to the right, which suits long labels like `/blog/how-to-…` far better than a column).

### The by-hour chart had never worked

It read `stats/d/<day>/hours` — an array **nothing in the codebase ever wrote**. The graph was
flat zero on every shop that had one.

Fixed: `lib/track.js` now writes `stats/hr/<day>/<HH>` on every page view, the analytics route
reads that (and the cleaner sweeps `hr` with everything else, and `database.rules.json` allows
it). Days recorded before the fix contribute nothing rather than a made-up curve.

---

## 6. SEO and correctness fixes

- **`lib/seo.js` emitted relative URLs.** `canonical`, `og:url`, `og:image` and `twitter:image`
  were bare paths like `/news`. Google, Facebook and X all need the full address. They are
  absolute now — and an absolute address handed in by a caller is left alone rather than
  doubled up.
- **`scripts/check.js` now validates internal `/blog/<slug>` links** across every post. A guide
  that links to a guide that was never written is a 404 waiting to be crawled; nothing else in
  the chain caught it. Verified by planting a broken link and watching it fail, then removing it.
- **Sitemap**: Live TV channels were capped at 800, so a bigger line-up was invisible to
  Google. Now **8,000**, with the archived-product budget reduced to keep the file inside the
  50,000-address limit.
- **`lib/xtreamServer.js` and `lib/seo.js` imported `./xtream` / `./config` without the `.js`
  extension**, which works inside Next's bundler but is not valid Node ESM — so neither file
  could be imported by a plain-Node test. Now `./xtream.js` / `./config.js`.

---

## Files changed

**New:** `lib/liveTvStore.js`, `app/api/admin/tv/config/route.js`, `components/TvBulkTools.js`,
`UPGRADE-v38.md`, `scripts/test-v38.mjs`.

**Rewritten:** `app/admin/tv/page.js` (server load/save, paging, selection, bulk tools).

**Edited:** `lib/liveTv.js` (100,000 cap + `TV_PART`), `lib/liveTvServer.js` (reads shards),
`lib/xtream.js` + `lib/xtreamServer.js` (category-by-category pull, bigger limits),
`app/api/admin/tv/xtream/route.js` (`commit` action, browser cap),
`components/XtreamImport.js` (two ways in), `components/Charts.js` (`Donut`, `HBarChart`),
`app/admin/dashboard/page.js` (4 new cards + totals + 90 days),
`app/api/admin/analytics/route.js` + `lib/track.js` + `database.rules.json` (the `hr` fix),
`lib/seo.js` (absolute URLs), `app/sitemap.js` (8,000 channels), `scripts/check.js` (blog-link
validation), `package.json` (38.0.0 + test chain), `package-lock.json`, `README.md`.

---

## What is still open

- **Google Search Console.** `node scripts/search-console.mjs` should be run once this is
  deployed so the new URLs are queued early. Search Console itself still needs a signed-in
  human — there is no way around that.
- **The `/live` page sends the whole channel list to the browser.** At 100,000 channels that is
  a big first load, and the player's list should eventually be lazy. It is fine at a few
  thousand, which is where a real shop sits.
- **The relay's allow-check** (`isChannelSourceAllowed`) scans the channel list per request. It
  is in-memory and cached, so it is fine today; at 100,000 channels it wants an index.
