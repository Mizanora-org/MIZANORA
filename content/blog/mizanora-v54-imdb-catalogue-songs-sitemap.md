---
title: "Mizanora v54: IMDb ki poori catalogue, ek Songs section, aur Google ke liye 500,000-page sitemap"
slug: mizanora-v54-imdb-catalogue-songs-sitemap
description: Mizanora v54 mein movies ab seedha IMDb (Cinemeta) se aati hain — koi API key nahi, koi custom catalogue nahi. Saath mein naya Songs section (search, play, song pages) aur 20,000-URL chunks wala sitemap index jo latest 500,000 titles tak ja sakta hai. Poori tafseel Roman Urdu mein.
date: 2026-11-06
category: movies-and-series
tags: mizanora, v54, imdb, cinemeta, songs, sitemap, seo, movies, music, release
image: https://images.metahub.space/background/medium/tt1375666/img
---

Mizanora par movies ka safar thora lamba raha: pehle ek chhoti hand-picked list, phir trailer-first
pages, phir cast aur release calendar, phir apna player. Har version mein ek hi shikayat baqi rehti
thi — **"custom movie system hatao, MINEXUS ki tarah IMDb se chalao."**

v54 wahi karta hai — aur is dafa sirf "integrate" nahi, **purana custom system hata diya gaya hai**.
`lib/moviesCatalog.js` mein 180 hand-written entries thin; ab wo array khaali hai. Admin ka
"Add custom movie" form bhi gaya — kyunki jab IMDb khud poori catalogue deta hai, usay type karne
ka koi maqsad nahi rehta.

Saath mein do cheezein jo bar bar maangi ja rahi thin: **Songs section** aur **aisa sitemap jo
har tarah ki movie cover kare**.

## 1. IMDb, bina API key — Cinemeta kya hai?

IMDb ka koi sasta public API nahi hai. Lekin Stremio ecosystem (jis mein MINEXUS bhi hai) **Cinemeta**
use karta hai — IMDb ke data ka mirror, bilkul free, bilkul keyless:

```
https://v3-cinemeta.strem.io/meta/movie/tt1375666.json     ← Inception
https://v3-cinemeta.strem.io/catalog/movie/top.json        ← Top movies
https://images.metahub.space/poster/medium/tt1375666/img   ← poster
```

Ismein title, saal, rating, runtime, genres, cast, director, synopsis, trailer, poster, backdrop
aur **series ke liye poora episode list** milta hai. Humne yahi integrate kiya (`lib/cinemeta.js`),
aur usse pehle rakha — TMDB (agar key ho) ab sirf extra art ke liye hai.

### Slug = IMDb id (sab se ahem faisla)

```
/movies/tt1375666        ← Inception, hamesha
/movies/tt0903747        ← Breaking Bad
```

IMDb id kabhi nahi badalta. Title ki spelling badal sakti hai, dubbing ka naam badal sakta hai —
id nahi. Is liye jo link Google par index hota hai wo **kabhi 404 nahi hota**. Purani hand-added
movies ke text slug bhi chalte rehte hain, kuch nahi toota.

### Page par kya naya hai

* **Episode guide** — series par season-wise accordion: episode number, naam, air date, summary.
* **Similar titles** — pehle sirf shop ki list se aata tha (aksar khali). Ab wahi IMDb genre
  se bhar diya jaata hai.
* **Cast photos** — Cinemeta titles ke actors ke liye bhi photos lagti hain, is liye
  `/movies/actor/...` pages khali nahi rehte.

### Search aur browsing

Search ab teen jagah dekhta hai — ek saath: aapki shop, IMDb catalogue, aur world catalogue.
Order bhi wahi hai (local pehle), aur result ke saath likha aata hai ke wo kahan se aaya.
`/movies/world` par type + genre chips aur pagination hai — 48 titles per page, seedha IMDb se.

## 2. Songs — search karein, play karein

Pehle Mizanora par sirf background music tha (shop ke liye). Ab alag **Songs** section hai:
header mein "Songs", footer mein "Songs & music", aur `/songs` par search box.

Song data public JioSaavn-style mirrors se aata hai. Yahan ek technical baat samajhne wali hai:
**wo mirrors CORS header nahi bhejte**, is liye browser se seedha call fail hota hai — MINEXUS ka
music tab isi wajah se khali dikhta tha. Mizanora mein browser sirf apne hi route se baat karta hai:

```
Browser → /api/songs/search?q=atif  →  server: Promise.any(saavn.dev, jiosavan-api2)
```

Jo mirror pehle jawab de, wahi jeet jaata hai. Aap apna mirror bhi laga sakte hain:
`SONGS_API_BASE=https://my-mirror/api`.

### Har song ka apna page

```
/songs/tum-hi-ho-abc123XYZ
```

Us par: artwork, artist, album, saal, duration, **poora player** (seek, volume, next/prev),
"About this song", track details, aur aage sunne ke liye similar queue. Google ke liye
`MusicRecording` structured data bhi hai — naam, artist, album, duration, language, tasveer.

Songs ka apna admin console bhi hai (`/admin/songs`): mirror health check, live search test,
aur sitemap link. Koi API key nahi chahiye.

> Audio third-party catalogue se stream hota hai; Mizanora usay host nahi karta. Personal
> listening ke liye — yehi baat page par bhi likhi hai.

## 3. Sitemap — "har tarah ki movie"

Pehle ek hi `/sitemap.xml` tha aur usmein movies ke liye 8,000 ki limit. v54 mein:

```
/sitemap-index.xml        ← robots.txt isi ko Google ko deta hai
├── /sitemap.xml          (shop ke core pages — waise hi)
├── /sitemaps/movies-0.xml … movies-N.xml   (20,000 URLs per file)
├── /sitemaps/series-0.xml … series-N.xml
├── /sitemaps/actors.xml
├── /sitemaps/live.xml
├── /sitemaps/blog.xml
└── /sitemaps/songs.xml
```

Google ki legal limit 50,000 URLs per file hai — hum 20,000 par rehte hain, taake har file
comfortably valid rahe. 500,000 titles = **25 files**, aur index khud hi ginti kar leta hai.

### Latest 500,000 kahan se?

Cinemeta crawl se 500k nahi nikalte (wo page-by-page chalta hai). Is liye IMDb ka **apna public
dataset** use hota hai:

```bash
npm run imdb:ids            # newest 500,000 films + series → data/imdb-ids.txt
```

Script `datasets.imdbws.com/title.basics.tsv.gz` (~150 MB, free, no login) stream karta hai,
sirf films/series rakhta hai, **naye saal pehle**, aur seedha wahi format likhta hai jo sitemap
padhta hai:

```
tt1234567	movie	2026
tt0903747	series	2008
```

Deployment par `MOVIES_SITEMAP_LIMIT=500000` laga dein — index 25 movie chunks list karne lagega.
Aur **automatic**: `.github/workflows/imdb-ids.yml` har Monday script chalata hai aur badli hui
file commit kar deta hai.

### Upcoming aur naye titles

* Admin jo bhi movie add kare (ya upcoming set kare) wo hub ke through sitemap mein aati hai —
  koi extra step nahi.
* IMDb se aane wale titles ka slug `tt…` hai, is liye unka link stable hai aur crawl safe.
* Har chunk request 6 ghante CDN par cache hoti hai; build machine offline ho to bhi build fail
  nahi hota (index dynamic hai).

### Purana custom system kahan gaya?

| Pehle | Ab |
| --- | --- |
| 180 starter movies + starter actors | khaali arrays (jaan bujh kar) |
| hub = starter + admin custom docs | hub = Cinemeta rows (top movies, top series, 8 genres) |
| admin "Add custom movie" | admin IMDb console (test + play servers) |

Iska matlab: jo movies pehle sirf isliye maujood thin ke kisi ne add ki thin, wo ab nahi dikhengi —
unki jagah IMDb ki asal catalogue hai. Aur jo purane links text slug par thay, unka IMDb id
`/movies/tt...` hamesha kaam karega.

## 4. Kya verify hua

```bash
npm run check          # 458 files, 0 problems
npm test               # 569 checks, EXIT=0 (v54 suite samet)
npm run build:offline  # green
```

Dev par `/songs`, `/songs/<slug>`, `/admin/songs`, `/movies/world`, `/sitemap-index.xml`,
`/sitemaps/movies-0.xml`, `/sitemaps/songs.xml`, `/api/songs/search` — sab 200.

Ek imandaar baat: is sandbox mein sirf GitHub/npm reachable hain, is liye Cinemeta aur music
mirrors ka **live** data yahan test nahi ho saka. Code defensive hai (upstream na ho to page 200
deta hai, khali state ke saath). Production par internet khula hai — wahan 20,000 `<loc>` aur
tracks nazar aayenge.

## 5. Chhoti chhoti baatein (jo waise hi hain)

Player apna hi hai — `domain/play/{imdbid}`, admin se configurable, stream se pehle Mizanora ke
product ads. Live TV v53 wala SIRAVEX-level engine — waisa hi. Shop, checkout, workers, reels,
Quran/Hadith — kuch nahi chhera.

Agar aapke paas koi `tt` id hai, seedha `/movies/tt...` khol kar dekh lein — poster, rating,
cast aur (series ho to) episode list wahi se aayegi. Aur agar koi gaana yaad aa jaye, `/songs`
par likh kar play dabayein.
