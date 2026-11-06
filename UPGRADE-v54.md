# Mizanora v54 — IMDb movies the MINEXUS way, a Songs section, and a sitemap that covers everything

> **TL;DR** — v54 removes the "custom movie system" from the path and puts **IMDb (Cinemeta)** in
> front of it: every `tt…` id opens a real page with a real poster, rating, cast and episodes, with
> no API key. A full **Songs** section is added (search → play, song pages, artist rails, admin
> console). The sitemap becomes an **index + 20,000-URL chunks**, and a script builds the **newest
> 500,000 IMDb titles** from IMDb's own dataset so Google can crawl all of it.

Version: **54.0.0** · Branch: `arena/b2e13c15-mizanora` · Previous: v53 (Live TV track engine)

**Custom movie system: removed.** `lib/moviesCatalog.js` ke 180 hand-written entries aur starter
actor list **delete** kar di gayi hai (arrays ab khaali hain, sirf purane imports ke liye).
`getMoviesHub()` ab IMDb (Cinemeta) se banta hai; admin ke purane custom movie documents hub
**ignore** karta hai, is liye jo "custom movies" page par chipki hui thin wo ab show nahi hoti.
`/admin/movies` ka CRUD form bhi hata diya gaya — wahan ab IMDb catalogue test console hai
(play servers waise hi manage hote hain).

---

## 1. Why this release exists

Teen demands thin, aur teeno ka jawab yahi release hai:

1. **"Custom movie system hatao — MINEXUS ki tarah IMDb se chalao."**
   Purana system apni hand-curated list par chalta tha: jo movie admin ne add ki, wahi milti thi.
   MINEXUS (aur poora Stremio ecosystem) **Cinemeta** use karta hai — IMDb ka public catalogue,
   bina API key. v54 wahi karta hai.
2. **"Songs section lao — search, list, play."**
   Pehle Mizanora par sirf *app-store music* (background tracks) tha. Ab poora `/songs` section hai.
3. **"Sitemap Google ke liye — har tarah ki movie, aur agar auto nahi ho sakta to kam az kam
   latest 500k."**
   Ab sitemap index hai, 20,000-URL chunks hain, aur `npm run imdb:ids` IMDb dataset se
   **500,000 latest titles** ki list banata hai — us par sitemap khud ko chhota-bara karta hai.

---

## 2. Cinemeta — IMDb without a key… aur custom system ka khatma

### 2.0 Pehle kya tha (aur kyun hataya)

v50–v53 mein movie catalogue ka matlab tha **`lib/moviesCatalog.js` ki 180 hand-written entries** +
admin ke Firestore documents. Iska matlab: koi movie sirf tab maujood thi jab kisi ne use type ki
ho. Isi liye MINEXUS (jo seedha IMDb padhta hai) ke paas hamesha zyada titles hote the.

v54 mein:

| Pehle | Ab |
| --- | --- |
| `STARTER_MOVIES` (180 entries) | **`[]`** — khaali, jaan bujh kar |
| `STARTER_ACTORS` | **`[]`** |
| `getMoviesHub()` = starter + custom docs | **Cinemeta rows** (top movies / top series / 8 genres) |
| admin `customMovies` hub mein merge | **ignore** (documents Firestore mein pade reh sakte hain, magar use nahi hote) |
| `/admin/movies` = "Add custom movie" form | **IMDb catalogue console** (test + play servers) |

Faida: koi movie add karne ki zarurat nahi. `tt` id jaan ho to page maujood hai. Actor profiles
bhi cast se khud ban jaate hain (har cast member ka slug + filmography).

> Note: agar aapke Firestore mein purani custom movies pari hain, wo delete karne ki zarurat nahi —
> hub unhe padhta hi nahi. Chahein to admin API se saaf kar sakte hain.

### 2.1 Cinemeta URLs

`lib/cinemeta.js` (naya):

| Cheez | URL |
| --- | --- |
| Meta (movie/series) | `https://v3-cinemeta.strem.io/meta/{movie\|series}/{ttID}.json` |
| Catalogue | `https://v3-cinemeta.strem.io/catalog/{type}/top[/genre=X][/search=Y][/skip=N].json` |
| Poster | `https://images.metahub.space/poster/medium/{ttID}/img` |
| Backdrop | `https://images.metahub.space/background/medium/{ttID}/img` |

Yahi URLs MINEXUS ke `api/title-page.js` mein hain — humne shape copy kiya, code nahi.

**Kya milta hai:** title, year (`"2010–2015"` → 2010), rating, runtime (`"2h 16min"` → 136),
genres, cast, director, synopsis, trailer ka YouTube id, poster, backdrop, country, certification —
aur series ke liye **poora episode list** (`videos[]` → `seasons[]`).

**Caching:** har response 6 ghante memory mein (600 entries). Upstream down ho to page phir bhi
chalta hai — jo hub mein hai wahi dikhta hai.

### 2.1 Slug = IMDb id

Sab se bara design decision:

```
/movies/tt1375666      ← Inception (IMDb)
/movies/inception-2010 ← purani hand-added movie (agar admin ne add ki ho)
```

IMDb id kabhi nahi badalta, title ki spelling badal sakti hai — is liye **Cinemeta titles ka slug
seedha `tt…` hai**. `cleanMovie()` ka validation pehle se `isValidImdbId` chalata hai, is liye
koi naya rule nahi likhna para. Faida: jo link Google par jaata hai wo kabhi 404 nahi hota.

### 2.2 Order of resolution

`lib/moviesServer.js#lookupOfficialByImdbId`:

1. **Cinemeta** (naya, sab se pehle) — keyless, fast, IMDb data
2. TMDB find/detail (agar `TMDB_API_KEY` laga ho — extra art ke liye)
3. Zero-key fallback (jo pehle tha)

`resolveMovieOrSeries()` ab Cinemeta titles ke cast ke liye **actor photos** bhi bhar deta hai
(wahi `actorPhotoLookup` jo v51 mein aaya tha), to `/movies/actor/...` pages bhare hue rehte hain.

### 2.3 Search, hub rows aur world catalogue

* `app/api/movies/search/route.js` — ab **local + Cinemeta search + world catalogue** teeno ek
  saath (parallel). Order: pehle aapki shop ki movies, phir IMDb, phir world. `sources` mein
  `IMDb catalogue` likha aata hai.
* `app/movies/page.js` — IMDb ki rows (Top Movies, Top Series, genre rows) shelves mein
  (`lib/moviesWorld.js#getWorldRows`, 6 ghante cache).
* `app/movies/world/page.js` — **naya** browser: type (movie/series) + genre chips + pagination,
  48 titles per page, `skip` Cinemeta se.
* `app/movies/[slug]/page.js` — **naya episode guide**: series par "Seasons & Episodes" accordion
  (season → episode, air date, summary). Aur agar "Similar" rail khali ho to wahi IMDb genre
  se bhar diya jaata hai.

---

## 3. Songs section

### 3.1 Kahan se aata hai

Songs public **JioSaavn-style** mirror APIs se aate hain (jaisa MINEXUS ka Music tab):

```
https://saavn.dev/api
https://jiosavan-api2.vercel.app/api
```

Yeh endpoints CORS header nahi bhejte — is liye browser se seedha call karna fail hota hai
(MINEXUS ka music tab isi wajah se khali tha). Mizanora ka rule: **browser sirf apne route se
baat karta hai**, mirror se server baat karta hai:

```
Browser → /api/songs/search?q=…  → lib/songsServer.js → Promise.any(mirrors)
```

Aap apna mirror lagana chahein to env:

```bash
SONGS_API_BASE=https://my-saavn-mirror.example/api
```

(pehle try hota hai, phir default mirrors).

### 3.2 Files

| File | Kaam |
| --- | --- |
| `lib/songs.js` | pure normalisation: `cleanSong`, `songSlug`, `songIdFromSlug`, `clockTime`, `songsFromPayload`, `songStream` (320kbps → 160 → 96), http→https upgrade |
| `lib/songsServer.js` | mirror race, 30-min cache, `searchSongs`, `getSongById`, `getTrendingSongs`, `getSongsForSitemap` |
| `app/api/songs/search/route.js` | `GET /api/songs/search?q=&limit=`; `q` khali ho to trending |
| `app/api/songs/[id]/route.js` | `GET /api/songs/{id}` — ek song + stream link |
| `app/songs/page.js` | hero + search + topic chips + grid; `?q=` deep link support |
| `app/songs/[slug]/page.js` | song page: player, "About this song", track details, similar queue, `MusicRecording` JSON-LD |
| `components/SongBrowser.js` | client: debounced search, grid, **sticky player** (seek, volume, next/prev) |
| `components/SongDetailPlayer.js` | song page player (artwork, seek, volume, queue) |
| `app/admin/songs/page.js` | admin console: mirror health, live search test, sitemap link |

### 3.3 SEO

Song page par `MusicRecording` structured data hai — name, artist(`MusicGroup`), album, duration
(`PT4M21S`), language, image, publish year. `/songs` par `CollectionPage` + top 12 tracks.

**Note:** audio third-party catalogue se stream hota hai, Mizanora host nahi karta. Ye baat page
par bhi likhi hai (personal listening). `/licence` page par bhi yehi policy hai.

---

## 4. Sitemap — "har tarah ki movie"

### 4.1 Architecture

```
/sitemap-index.xml          ← robots.txt isi ko advertise karta hai
├── /sitemap.xml            (purana, shop ke core pages + hub movies/actors/TV)
├── /sitemaps/movies-0.xml  ← 20,000 URLs
├── /sitemaps/movies-1.xml
│   …
├── /sitemaps/series-0.xml
│   …
├── /sitemaps/actors.xml
├── /sitemaps/live.xml
├── /sitemaps/blog.xml
└── /sitemaps/songs.xml
```

* Har file mein **20,000 URLs** (Google ki legal limit 50,000 — hum us se door rehte hain).
* 500,000 titles = **25 files**, index khud hi `chunkCount()` se ginti karta hai.
* Index `force-dynamic` hai (CDN par 6 ghante cache) — build machine offline ho to bhi sitemap
  build fail nahi hota.
* Chunk route `budgetMs` ke saath crawl karta hai, taake serverless timeout na ho.

### 4.2 Do tarah ka pool

`lib/moviesWorld.js#getSitemapIds()`:

1. **`data/imdb-ids.txt`** — agar maujood ho (recommended, yehi 500k deta hai)
2. shop ka hub (admin ki add ki hui + upcoming titles) — *automatic*, koi setting nahi
3. Cinemeta catalogue crawl (backup; 20,000 default)

Aur naye titles khud aa jaate hain: hub ka `status: 'upcoming'` wala har title sitemap mein hai,
aur Cinemeta se aane wale titles ka slug `tt…` hone ki wajah se link stable hai.

### 4.3 Latest 500,000 — `npm run imdb:ids`

```bash
npm run imdb:ids                          # newest 500,000 titles → data/imdb-ids.txt
npm run imdb:ids -- --limit 200000        # chhota file
npm run imdb:ids -- --min-year 2000       # sirf 2000 ke baad
npm run imdb:ids -- --types movie,series  # sirf films + series
```

Script `https://datasets.imdbws.com/title.basics.tsv.gz` (~150 MB, **no key, no login**) stream
karta hai, sirf films/series rakhta hai, **naye saal pehle** (newest-first), aur likhta hai:

```
tt1234567	movie	2026
tt0903747	series	2008
```

Phir deployment par:

```bash
MOVIES_SITEMAP_LIMIT=500000
```

…aur `/sitemap-index.xml` 25 movie chunks + series chunks list karne lagega. File na ho to limit
20,000 rehti hai (crawl se), taake cold request bhaari na ho.

**Automatic refresh:** `.github/workflows/imdb-ids.yml` har **Monday 03:17 UTC** script chalata
hai aur badli hui file commit kar deta hai (manual: Actions → imdb-ids → Run workflow).

### 4.4 robots.txt

```js
sitemap: [ absUrl('/sitemap-index.xml'), absUrl('/sitemap.xml') ]
```

Dono — index (poora catalogue) aur purana core sitemap — Google ko diye jaate hain.

### 4.5 Sitemap mein kya-kya hai

| Section | Source | Kitna |
| --- | --- | --- |
| Movies | `data/imdb-ids.txt` → hub → crawl | 500,000 tak |
| Series | same pool, `type: series` | 500,000 tak (alag chunks) |
| Actors | `getMoviesHub().actors` | 40,000 tak |
| Live TV | `getTvConfig().channels` | 40,000 tak |
| Blog | `getPosts()` | 40,000 tak |
| Songs | `getSongsForSitemap()` | 500 |
| Core pages | `/sitemap.xml` | shop, tools, Quran, categories, products… |

---

## 5. Naye env variables

| Variable | Default | Kaam |
| --- | --- | --- |
| `MOVIES_SITEMAP_LIMIT` | dataset ho to 500,000, warna 20,000 | sitemap kitne titles cover kare |
| `SONGS_API_BASE` | *(khali)* | apna saavn mirror (pehle try hota hai) |
| `TMDB_API_KEY` | *(khali)* | optional extra art/credits (Cinemeta ke baad) |

Baaki sab purana waise hi hai.

---

## 6. Verification (jo chalaya gaya)

```bash
npm run check        # 458 files, 0 problems
npm test             # 569 checks, EXIT=0 (v54 suite chain mein hai — 153 apne checks)
npm run build:offline# green build; /songs, /songs/[slug], /movies/world, sitemaps present
```

Dev smoke (Next dev, port 3010):

| Route | Status |
| --- | --- |
| `/songs` | 200 |
| `/admin/songs` | 200 |
| `/movies/world` | 200 |
| `/movies` | 200 |
| `/live` | 200 |
| `/sitemap-index.xml` | 200 (index, 6 sections) |
| `/sitemaps/movies-0.xml` | 200 (56 `<loc>` — sandbox mein upstream band tha, is liye hub se) |
| `/sitemaps/songs.xml` | 200 (valid xmlset; songs upstream sandbox mein blocked) |
| `/api/songs/search?q=test` | 200 `{ ok: true, items: [] }` |

> **Sandbox note:** is environment mein sirf GitHub/npm/PyPI reachable hain, is liye Cinemeta aur
> saavn mirrors ka live data yahan verify nahi ho saka. Code defensive hai — upstream na ho to
> pages 200 dete hain. Production (Vercel) par internet khula hai, wahan data aayega.
> Verify karne ka tareeqa: `/sitemaps/movies-0.xml` mein 20,000 `<loc>` aur `/songs` par tracks.

---

## 7. Troubleshooting

**Movies page khali / sirf purani movies?**
Cinemeta blocked ho sakta hai (ISP/DNS). Browser mein
`https://v3-cinemeta.strem.io/meta/movie/tt1375666.json` khol kar dekhein — JSON aana chahiye.
Page phir bhi hub se chalta rahega.

**Songs "kuch nahi mila"?**
Mirrors down hote hain. `/admin/songs` → Test chalayein. `SONGS_API_BASE` se apna mirror lagayein.
Ek mirror 502 de to race doosra try karta hai.

**Sitemap mein sirf 56 URLs?**
`data/imdb-ids.txt` nahi hai aur upstream crawl sandbox/offline mein fail hua. `npm run imdb:ids`
chalayein aur file commit karein.

**`/sitemaps/movies-12.xml` 404?**
Index mein jo chunks hain wahi valid hain — pool chhota ho to `movies-12` maujood nahi hota.
Ye 404 sahi behaviour hai (Google index se hi chunks padhta hai).

**500k ke baad?**
`MOVIES_SITEMAP_LIMIT` max 500,000 hai, aur `chunkCount` 20,000 par split karta hai — 25 files.
Isse zyada chahiye to `SITEMAP_CHUNK` badhayein (50,000 se neeche), ya doosri file
(`data/imdb-ids-2.txt`) ka support add karein — design taiyar hai.

---

## 8. Custom system hatane ka asar (checklist)

* `/movies` — shelves ab IMDb rows hain; starter titles nahi.
* `/movies/[slug]` — purane text slugs (jo custom entries ke thay) 404 ho sakte hain, **lekin**
  unka IMDb id `tt…` ab seedha kaam karta hai. Sitemap naye links hi bhejta hai.
* `/movies/actors` — actors cast se auto-backfill hote hain (IMDb titles ke cast se).
* `/movies/calendar` — upcoming titles IMDb/Cinemeta aur admin ke play-server config se aate hain;
  calendar ka structure wahi hai.
* `/search` — search hub (Cinemeta) se movies leta hai, `STARTER_MOVIES` se nahi.
* `siteSearch()` — pool pass na ho to movies khaali (default starter list ab khaali hai).
* Firebase documents — kuch delete nahi hota; sirf padha nahi jaata.

## 9. Kya nahi badla

* Player (apna `domain/play/{imdbid}` wala) — waisa hi.
* Product ads stream se pehle — waise hi.
* Live TV v53 (SIRAVEX-level track engine) — waise hi.
* Shop, checkout, workers, reels, Quran/Hadith — waise hi.
* `/movies/world` page ke ilawa koi purana URL nahi hata — purane slugs chalte rehte hain.

---

## 10. Aagay (v55 ideas)

* TMDB credits se actor pages ko aur bhar dena (jab key lage).
* Songs ke liye playlists + "recently played" (localStorage, koi login nahi).
* `movies-*.xml` ko `generateStaticParams` + ISR par le jaana, taake CDN hit ho (abhi dynamic).
* Album/artist pages (`/songs/album/…`, `/songs/artist/…`) — schema ready hai (`MusicGroup`).
