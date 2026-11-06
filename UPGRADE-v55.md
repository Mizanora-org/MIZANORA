# Mizanora v55 — "sab kaam kare": offline IMDb snapshot, real search, singer pages, calendar aur poora sitemap

> **TL;DR** — v54 ne sab kuch Cinemeta (IMDb) se live padhna shuru kiya. Deployed site par wo theek
> chalta hai, lekin **jahan internet block/slow ho** (preview sandbox, build machine, upstream
> outage) wahan movies, search, calendar, songs aur sitemap **khali** ho jate hain — aur bilkul
> yehi hua. v55 us kharabi ki jarr pakadta hai:
>
> * **16,229 films + 928 series ka IMDb snapshot** repo mein commit — pages/search/calendar/sitemap
>   kabhi khali nahi.
> * **Search** ab films, series, actors, IMDb IDs aur songs — sab par chalti hai, type filter ke saath.
> * **Songs**: singer (artist) pages, singers strip, browser-side fallback (server mirror tak na
>   pohnche to browser khud try karta hai), aur songs sitemap mein singers bhi.
> * **Release calendar** dobara kaam karta hai (year-only titles bhi "date TBA" ke saath).
> * **Sitemaps**: har file ka naam, content, URL count aur submit karne ka tareeqa — website par
>   `/sitemaps` page aur repo mein `SITEMAPS.md`.
> * **86,783 IMDb IDs** ka committed pool → sitemap abhi bhi 11 files, aur 500,000 tak barh sakta hai.
> * **Player upgrade**: theater mode, iPhone fullscreen fallback, touch gestures (double-tap seek,
>   swipe volume), poora shortcut set, next-episode countdown, embed servers ke apne controls aur
>   shortcut help panel — fullscreen se le kar har experience.

Version: **55.0.0** · Pichla: v54 (Cinemeta movies + songs + sitemap index)

---

## 1. Asal masla kya tha (root cause, imandari se)

v54 ke baad jab site dekhi gayi to "movies series song search sab nahi" tha. Wajah code ki ghalti
nahi thi — **network ki deewar** thi:

| Cheez | Kahan se aati thi | Masla |
| --- | --- | --- |
| Movies / series | `v3-cinemeta.strem.io` (live) | sandbox/preview se reachable nahi → hub khali |
| Posters | `images.metahub.space` | browser load karta hai, is liye ye theek tha |
| Songs | `saavn.dev`, `jiosavan-api2` | server se reachable nahi → 0 songs |
| Search | hub + Cinemeta | hub khali, Cinemeta down → kuch nahi |
| Calendar | hub ke `upcoming` | hub khali → calendar khali |
| Sitemap chunks | hub + crawl | dono khali → 0 URLs |

Is liye do kaam kiye: **(a)** catalogue ka ek snapshot repo mein rakha jo hamesha maujood rahe,
**(b)** jahan live data zaroori hai (songs) wahan browser ko bhi chance diya.

---

## 2. Fix #1 — IMDb snapshot (sab se bara change)

### 2.1 Kya hai

`data/imdb-seed.json` — **16,229 films + 928 series**, har entry:

```json
{ "i": "tt0111161", "t": "The Shawshank Redemption", "y": 1994,
  "g": ["Drama","Crime"], "r": 9.3, "d": 142, "c": "USA", "l": "English",
  "dir": "Frank Darabont", "ca": ["Tim Robbins","Morgan Freeman"],
  "s": "Two imprisoned men bond over a number of years…" }
```

* Poster/backdrop **runtime par** IMDb id se bante hain (`images.metahub.space/poster/medium/{tt}/img`)
  — file mein images nahi, is liye size sirf ~7 MB.
* `data/imdb-ids.txt` — **86,783 ids** (naye saal pehle) sitemap ke chunks ke liye.
* Dono files **commit** hain, is liye deployment ke saath jati hain (`next.config.js` tracing).

### 2.2 Kaise banti hai

```bash
npm run imdb:seed                                    # default source se
npm run imdb:seed -- --csv ./IMDb\ movies.csv \
                    --series-dir ./series-jsons      # apne source se
```

`scripts/build-imdb-seed.mjs`:

1. **Films** — IMDb ka public "IMDb movies" dataset (85,855 films, factual metadata; Kaggle/CC0
   mirror). Votes ≥ 3,000 wale 16,229 titles rakhe jaate hain, baqi sirf id list mein.
2. **Series** — Stremio-style `{"meta":{…}}` JSON ka folder (default series source). Sirf `tt…`
   ids, English titles; Spanish descriptions drop kar di jati hain.
3. Spanish genres ka English mapping (Crimen → Crime, Ciencia ficción → Science Fiction…).
4. Output: `data/imdb-seed.json` + `data/imdb-ids.txt` (newest-first).

> **Note:** ye "custom catalogue" **nahi** hai. Koi title hand-type nahi kiya gaya — sab IMDb ke
> public dataset se aata hai. Hub ab bhi Cinemeta-first hai; snapshot sirf guarantee hai ke
> catalogue kabhi khali na ho.

### 2.3 Kahan use hota hai

| Jagah | Kya hota hai |
| --- | --- |
| `lib/moviesServer#getMoviesHub` | Cinemeta rows + `seedFeatured(140)` merge |
| `lookupOfficialByImdbId` | Cinemeta fail → snapshot ka card (poster, cast, story, rating) |
| `/api/movies/search` | `searchSeed()` — title, cast, director, genre, saal, IMDb id |
| `/movies` shelves | Cinemeta na ho to `seedRows()` (Top Rated / Newest / Series) |
| `/movies/calendar` | `seedNewest(400)` + `seedUpcoming()` |
| `/sitemap*.xml` | `data/imdb-ids.txt` (86,783) — file na ho to crawl |
| Actor pages | snapshot ke cast se actors + filmography |

---

## 3. Fix #2 — Search: "har tarah ki movies series"

### 3.1 Kya search hota hai

| Type | Example | Kahan se |
| --- | --- | --- |
| Film ka naam | `inception` | snapshot + hub + Cinemeta + world |
| Series | `breaking bad` | snapshot (series) + Cinemeta series catalog |
| IMDb ID | `tt1375666` | seedMovie → direct page |
| Actor | `morgan freeman` | snapshot cast + hub actors + Cinemeta |
| Genre / saal | `horror 2019` | snapshot search |
| Song | `tum hi ho` | `/songs?q=` + search page ka Songs block |
| Tool / channel / Quran / blog | `zakat`, `geo news` | purana siteSearch |

### 3.2 Naye API parameters

```
GET /api/movies/search?q=breaking&type=series&limit=24
```

* `type` = `all` (default) · `movie` · `series`
* Response mein `type`, `snapshotCount`, `localCount` aur `sources` (IMDb snapshot / IMDb catalogue /
  world) — UI bata sakta hai ke result kahan se aaya.
* Har result ka `href` `/movies/tt…` hota hai — **jo page maujood hai**, chahe title hub mein ho ya na ho.

### 3.3 Speed

* Snapshot memory mein (ek file read, process lifetime ke liye cache).
* Search pehle snapshot par chalti hai (sync, ~1–3 ms), phir Cinemeta/world parallel.
* API response 5 min CDN cache (`s-maxage=300`).
* `/movies` par sirf featured ~140 cards browser ko jate hain; baqi search API se.

---

## 4. Fix #3 — Release calendar

Problem: `buildReleaseCalendar()` sirf un titles ko leta tha jinke paas **poore `releaseDate`** ho.
IMDb snapshot ke paas aksar sirf **saal** hota hai, is liye calendar khali tha.

Ab:

* `year`-only titles `${year}-00-00` par group hote hain, label: **"2025 — date TBA"**.
* Calendar ke sources: hub upcoming → `seedUpcoming()` (is saal ya aage) → `seedNewest(400)`
  (recent releases).
* Upcoming 0 ho to page imandari se likhta hai ke IMDb se naye releases ka intezaar hai aur neeche
  recent releases ka calendar mojood hai.
* `MoviesCalendarClient` ke filters (region, type, upcoming-only) waise hi chalte hain.

---

## 5. Fix #4 — Songs aur singers

### 5.1 Singer (artist) pages

Naya route: **`/songs/artist/[slug]`** (misal `/songs/artist/atif-aslam`)

* Bara circular cover, naam, "N tracks", play button wala browser.
* Top tracks list (rank, album, duration).
* `MusicGroup` + `ItemList` JSON-LD (Google ke liye).
* "More singers to explore" strip.
* Song pages par har artist ka naam ab **link** hai.
* `/songs` home par **Singers** strip (`getTrendingArtists`).

### 5.2 Browser-side fallback (preview/offline)

Flow:

```
Browser → /api/songs/search → server Promise.any(saavn.dev, jiosavan-api2)
                                   │  fail / upstream:'down'
                                   ▼
                          browser → saavn.dev / jiosavan-api2 (direct)
                                   │  fail
                                   ▼
                     Retry button + "Mirror status" link (/admin/songs)
```

* `lib/songsClient.js` — `searchSongsDirect()`, `songByIdDirect()`.
* `/songs` page: trending khali ho to ek seed query (pehla topic) browser se load hoti hai.
* Song page agar server par load na ho to `SongDirectLoader` browser se try karta hai — **404 nahi**.
* `/search` par naya **Songs block** (client) jo usi fallback ke saath kaam karta hai.

### 5.3 Songs sitemap

`/sitemaps/songs.xml` ab **singers + songs** dono deta hai:

```
/songs/artist/atif-aslam      priority 0.6
/songs/tum-hi-ho-abc123       priority 0.5
```

---

## 6. Fix #5 — Sitemaps: poori list + guide

### 6.1 Website par

Naya page: **`/sitemaps`** — har file ka table (content, URL count, priority), Search Console ka
step-by-step, 500k enable karne ka tareeqa aur indexing checklist.

### 6.2 Har sitemap ka naam

| File | Content | Default size |
| --- | --- | --- |
| `/sitemap-index.xml` | index (sab files) | 11 entries (86,783 ids ke saath) |
| `/sitemap.xml` | core pages + products | ~500–40,000 |
| `/sitemaps/movies-0.xml` … `movies-N.xml` | IMDb films, newest first | 20,000/file |
| `/sitemaps/series-0.xml` … `series-N.xml` | series / dramas | 20,000/file |
| `/sitemaps/actors.xml` | actor profiles | max 40,000 |
| `/sitemaps/live.xml` | Live TV channels | max 40,000 |
| `/sitemaps/blog.xml` | blog guides | max 40,000 |
| `/sitemaps/songs.xml` | songs + singers | 500 + 12 |
| `/api/feed/google` | Merchant feed (sitemap nahi) | products |

Poori tafseel: **[`SITEMAPS.md`](./SITEMAPS.md)**.

### 6.3 500,000 tak

```bash
npm run imdb:ids                    # latest 500,000 (IMDb dataset)
MOVIES_SITEMAP_LIMIT=500000         # deployment env
```

Weekly automation: `.github/workflows/imdb-ids.yml` (Monday 03:17 UTC).

---

## 7. Fix #6 — Player upgrade: fullscreen se le kar har tarah ka experience

v54 ka player kaam karta tha, magar sirf **basic**: play/pause, seek, quality, audio, captions,
fullscreen aur PiP. v55 ne usay poora "theater-grade" banaya — desktop aur mobile dono par.
File: `components/CinemaPlayer.js`.

### 7.1 Kya naya hai

| Feature | Pehle | Ab (v55) |
| --- | --- | --- |
| Shortcuts | Sirf stage par click karne ke baad | `window` par registered — page khulte hi chalte hain |
| Theater mode | Nahi | `T` ya control bar ka **THEATER** button — player poora screen le leta hai (browser ke fullscreen ke baghair) |
| Fullscreen | Container par | Container + **iPhone fallback** (`video.webkitEnterFullscreen`) jab `requestFullscreen` na ho |
| Gestures | Nahi | Double-tap left/right = ±10s, swipe up/down = volume, single tap = play/pause, tap hint overlay |
| Next episode | Nahi | Series mein episode khatam → **"Up next" 8-second countdown** (Play now / Cancel), `N` se turant |
| Help | Nahi | `H` / `?` par poori shortcut list ka panel |
| Embed servers | Sirf "new tab" | Apne controls: **reload**, theater, fullscreen + new tab (jo servers andar ka fullscreen block karein un ka hal) |
| Cursor / UI | Mouse move par | Same auto-hide, ab theater/fullscreen mein bhi |
| Speed | Menu | Menu + `0–9` percent jump, `C` captions toggle, `S` screenshot |

### 7.2 Shortcut list (exactly jo player mein hai)

| Key | Kaam |
| --- | --- |
| `Space` / `K` | Play · Pause |
| `J` / `L` ya `←` / `→` | 10s peeche / aage |
| `↑` / `↓` | Volume |
| `M` | Mute |
| `F` | Fullscreen |
| `T` | Theater mode |
| `0`–`9` | Video ke 0–90% par jump |
| `C` | Captions on/off (captions na hon to screenshot) |
| `S` | Screenshot (canvas se PNG download) |
| `N` / `P` | Next / previous episode (series) |
| `H` / `?` | Shortcut panel |
| `Esc` | Panels/theater band |

### 7.3 Har server type par kya hota hai

* **HLS (`m3u8`)** — hls.js: auto quality, manual level, audio tracks, subtitles, live ke liye bhi.
* **MP4 / WebM** — native `<video>`: seek, speed, PiP, screenshot, fullscreen, iOS fallback.
* **DASH / doosra** — browser native support ke hisaab se; fail ho to agla server khud try hota hai.
* **Embed (iframe)** — hamara overlay: reload, theater, fullscreen, "Open in new tab". Andar ka
  player fullscreen block kare to bhi user phansa nahi rehta.
* **Koi server fail** — `triedServers` failover + "slow hint" + agla server button (v54 se).

### 7.4 Mobile notes

* iOS Safari: `<video>` par `playsInline`; fullscreen sirf `webkitEnterFullscreen` se — ab woh
  fallback maujood hai, is liye iPhone par bhi button kaam karta hai.
* Android Chrome: container fullscreen + PiP normal.
* Touch par synthetic `click` duplicate play/pause na kare — tap ke 600ms tak click ignore hota hai.
* Theater mode `fixed inset-0` hai, is liye address bar ke saath bhi stable rehta hai.

## 8. Speed aur smoothness

* **Skeletons**: `app/movies/loading.js`, `app/songs/loading.js` — page pehle se "bhara" dikhta hai.
* **Caching**: Cinemeta 6h (memory), snapshot process-lifetime, songs 30 min, search API 5 min CDN,
  sitemaps 6h CDN, pages ISR (30 min / 1h).
* **Caps**: hub 140 titles (HTML chhota), calendar 400, search 24, sitemap 20k/file.
* **Timeouts**: Cinemeta 6–8s, world 4.5s, songs 7s, calendar/hub race 8s — koi page latakta nahi.
* **No blocking fonts** aur pehle se maujood image lazy-loading (`MoviePosterCard`).
* API/browse requests debounce (420 ms) + AbortController — type karte waqt purani request cancel.

---

## 9. Env variables (naye/updated)

| Variable | Default | Kaam |
| --- | --- | --- |
| `MOVIES_SITEMAP_LIMIT` | file ho to 500,000, warna 20,000 | sitemap size |
| `SONGS_API_BASE` | khali | apna music mirror pehle try |
| `TMDB_API_KEY` | khali | optional extra art (Cinemeta ke baad) |

---

## 10. Verification

```bash
npm ci
npm run check          # 466 files, 0 problems
npm test               # 575 checks (v55 suite: 123)
npm run build:offline  # green
```

Dev smoke (`next dev`):

| Route | Result |
| --- | --- |
| `/movies` | 200 · snapshot shelves dikhte hain (Cinemeta ke baghair bhi) |
| `/movies/tt1375666` | 200 · poster + story + cast snapshot se |
| `/movies/calendar` | 200 · recent releases "date TBA" groups ke saath |
| `/movies/actors` | 200 · snapshot cast se actors |
| `/search?q=shawshank` | 200 · movie result |
| `/songs`, `/songs/artist/atif-aslam` | 200 · singer page (mirror down par bhi page) |
| `/sitemaps` | 200 · guide table |
| `/sitemap-index.xml` | 200 · 11 files |
| `/sitemaps/movies-0.xml` | 200 · 20,000 `<loc>` |
| `/api/movies/search?q=breaking&type=series` | 200 · series results |

> Sandbox mein Cinemeta/music mirrors reachable nahi hain — is liye live data yahan nahi aata.
> Snapshot ki wajah se movies/series/search/calendar **phir bhi** kaam karte hain. Deployment par
> Cinemeta live data dega (episodes, latest titles) aur songs mirrors se aayenge.

---

## 11. Troubleshooting

**Movies ab bhi khali?**
`data/imdb-seed.json` deploy hui ya nahi check karein (`next.config.js` tracing). Local par
`npm run imdb:seed` chalayein.

**Songs "kuch nahi mila"?**
`/admin/songs` → Test. Sab mirrors down hain to browser fallback bhi fail hoga; thori dair baad
Retry. `SONGS_API_BASE` se apna mirror lagayein.

**Calendar mein 2026/2027 nahi?**
Snapshot 2020 tak ka dataset hai. Upcoming titles Cinemeta/TMDB se aate hain jab internet ho.
Play servers ke saath koi title add karna ho to `/admin/movies` console dekhein.

**Sitemap mein sirf 56 URLs?**
Ab kam az kam 86,783 ids commit hain. `movies-0.xml` khol kar count karein; agar khali ho to
deployment mein `data/imdb-ids.txt` missing hai.

---

## 12. Aagay (v56 ideas)

* TMDB upcoming feed se 2027 calendar (key ke saath).
* `movies-N.xml` ko ISR/static par le jaana (CDN hit).
* Singer pages ko album pages se jodna (`/songs/album/…`).
* Search suggestions (type-ahead) + recent searches (localStorage).
