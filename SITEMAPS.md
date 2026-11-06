# MIZANORA sitemaps — har file ki poori list, tafseel aur guide

Ye document batata hai ke Mizanora **kaun kaun se sitemap** publish karta hai, har file ke andar
kya hota hai, kitne URLs hote hain, aur Google Search Console mein kya submit karna hai.

> Live, human-readable version: **https://mizanora.vercel.app/sitemaps**

---

## 1. Ek nazar mein

| Sitemap file | Kya hai andar | Kitne URLs (default) | Priority | Change freq |
| --- | --- | --- | --- | --- |
| `/sitemap-index.xml` | **Sitemap index** — baqi sab files ki list | 150+ files (v56) | — | 6h cache |
| `/sitemap.xml` | Core pages: home, shop, categories, products, tools, Quran (114), Hadith, blog, Live TV, movies hub | ~500 – 40,000 | 1.0 – 0.5 | hourly |
| `/sitemaps/titles-YYYY.xml` | **v56:** ek release saal ki saari movies + series (`titles-1999.xml`, `titles-2026.xml` …) | 0 – 45,000 per file | 0.7 – 0.8 | 6h |
| `/sitemaps/actors-a.xml` … `actors-z.xml` | **v56:** actor profiles, shuru ke harf se | hub ke actors | 0.5 | 6h |
| `/sitemaps/songs-a.xml` … `songs-z.xml` | **v56:** songs, harf se (sirf jab mirror jawab de) | songs | 0.5 | 6h |
| `/sitemaps/quran.xml` | **v56:** 114 surahs | 114 | 0.5 | 6h |
| _(`/sitemaps/movies-N.xml`, `series-N.xml`)_ | Purane chunk routes — **zinda hain** magar index mein list nahi (duplicate na ho) | 20,000 per file | 0.7 | 6h |
| `/sitemaps/actors.xml` | Actor profiles (cast se bane hue) | hub ke actors (max 40,000) | 0.5 | 6h |
| `/sitemaps/live.xml` | Live TV channels ke watch pages | enabled channels (max 40,000) | 0.5 | 6h |
| `/sitemaps/blog.xml` | Blog guides + cover images | saare posts (max 40,000) | 0.6 | 6h |
| `/sitemaps/songs.xml` | **Songs + singers** (v55) | 500 songs + 12 singers tak | 0.5 – 0.6 | 6h |
| `/api/feed/google` | Google Merchant product feed (XML, sitemap nahi) | products | — | 1h |

**Chunk rule:** ek sitemap file mein Google ki legal limit 50,000 URLs hai. Mizanora 20,000 par
rehta hai (`SITEMAP_CHUNK`), is liye 500,000 titles = **25 files** — har file comfortably valid.

---

## 2. Submit kaise karein (Google Search Console)

1. **Property add karein** → `https://mizanora.vercel.app` (ya aapka domain) — DNS ya HTML tag se verify.
2. Left menu → **Sitemaps**.
3. Sirf ye URL likhein aur Submit dabayein:

   ```
   https://mizanora.vercel.app/sitemap-index.xml
   ```

   Index khud baqi chunks (movies-0…N, series-0…N, actors, live, blog, songs) Google ko de deta hai.
4. Chahein to `/sitemap.xml` bhi alag submit kar dein (core pages, products).
5. **URL Inspection** se 2–3 movie pages manually submit karein (`/movies/tt1375666` jaisa). Ye
   Google ko signal deta hai ke naye pages aa rahe hain.
6. 24–72 ghante baad **Pages → Indexed** dekh kar confirm karein.

### Bing / Yandex / IndexNow

Bing Webmaster Tools aur Yandex bhi wahi `/sitemap-index.xml` accept karte hain. Mizanora mein
IndexNow ping utility (`lib/indexnow.js`) maujood hai — naya content publish karne par use
`pingIndexNow()` se notify kar sakte hain.

---

## 3. 500,000 titles kaise enable karein

Default roop mein sitemap ke paas **do** source hote hain:

1. `data/imdb-ids.txt` — agar maujood ho (recommended)
2. shop ka hub + Cinemeta crawl (backup)

Steps:

```bash
# 1) IMDb ke public dataset se latest 500,000 titles (films + series) ki list
npm run imdb:ids                 # data/imdb-ids.txt (~9-12 MB)

# ya sirf latest 200,000
npm run imdb:ids -- --limit 200000

# 2) commit + deploy
git add data/imdb-ids.txt && git commit -m "chore: refresh imdb ids" && git push

# 3) deployment env
MOVIES_SITEMAP_LIMIT=500000
```

Weekly automation already included: `.github/workflows/imdb-ids.yml` har Monday 03:17 UTC par
script chalata hai aur badli hui file commit karta hai (manual: Actions → imdb-ids → Run workflow).

### Sitemap kitne files banayega?

v56 se files ka hisaab **saal + harf** se banta hai, chunk se nahi:

```
/sitemap-index.xml = 1 (core)
                   + (jitne saal data mein hain)      ≈ 98
                   + (jitne actor letters bhare hain)  ≤ 26
                   + (jitne song letters bhare hain)   ≤ 26
                   + quran.xml + actors.xml + live.xml + blog.xml + songs.xml
```

| Data | Year files | Actor files | Song files | Total files |
| --- | --- | --- | --- | --- |
| 86,783 ids (current) | ~98 | ≤ 26 | 0–26 | **~150** |
| 200,000 ids | ~100 | ≤ 26 | ≤ 26 | ~155 |
| 500,000 ids | ~110 | ≤ 26 | ≤ 26 | ~165 |

Har file 45,000 URLs se kam rehti hai (Google ki limit 50,000). Isi liye **100+ sitemaps** ka
matlab yahan "bara number" nahi — chhote, dated, themed files jo crawl hoti hain.

**Quality mode:** `SITEMAP_DATA_ONLY=1` set karne par index sirf un titles ko list karta hai jinka
data repo mein commit hai (`npm run coverage` se numbers dekhein). Abhi: 17,157 bhare hue, 69,626
live-IMDb par depend.

---

## 4. Offline / preview mode

`data/imdb-seed.json` (v55) mein **16,229 films + 928 series** ka snapshot hai — title, saal,
rating, genres, cast, director, country, language aur synopsis ke saath. Poster IMDb id se banta
hai (`images.metahub.space`), is liye browser mein load hota hai.

Iska matlab:

* Cinemeta reachable ho → **live IMDb data** (poora, episodes ke saath).
* Cinemeta na ho (preview sandbox / build / outage) → **snapshot** se pages, search, calendar,
  actors aur sitemap kaam karte rahenge.

Rebuild:

```bash
npm run imdb:seed -- --csv /path/to/IMDb\ movies.csv --series-dir /path/to/series-jsons
```

---

## 5. Troubleshooting

**Sitemap mein 0 URLs?**
Chunk file tabhi khali hoti hai jab na `data/imdb-ids.txt` ho na hub. `npm run imdb:seed` ya
`npm run imdb:ids` chalayein.

**`/sitemaps/movies-12.xml` 404?**
Sirf wahi chunks valid hain jo index mein hain. Pool chhota ho to `movies-12` nahi hota — ye
sahi behaviour hai (Google index se hi chunks padhta hai).

**Songs sitemap khali?**
Songs live music catalogue se aate hain. Mirror down ho to file khali rehti hai; agle refresh par
khud bhar jati hai.

**Sitemap purana lag raha hai?**
CDN 6 ghante cache karta hai. Deploy ke baad `?v=2` laga kar ya 6 ghante baad check karein.

**Search Console "Couldn't fetch"?**
URL browser mein kholein. 200 + valid XML aana chahiye. 404 ho to deployment par route missing hai.

---

## 6. Files jo is feature ko banati hain

| File | Kaam |
| --- | --- |
| `app/sitemap-index.xml/route.js` | index (chunks ki list) |
| `app/sitemaps/[file]/route.js` | movies/series/actors/live/blog/songs chunks |
| `app/sitemap.js` | core pages sitemap (`/sitemap.xml`) |
| `app/sitemaps/page.js` | human-readable guide (yehi page website par) |
| `app/robots.js` | index + core sitemap advertise karta hai |
| `lib/moviesWorld.js` | id pool, `SITEMAP_CHUNK`, `chunkCount`, `sitemapMovieLimit`, crawl budget |
| `lib/imdbSeed.js` | offline snapshot (cards, search, rows, ids) |
| `scripts/build-imdb-ids.mjs` | 500k id list (IMDb dataset) |
| `scripts/build-imdb-seed.mjs` | snapshot (films + series) |
| `.github/workflows/imdb-ids.yml` | weekly refresh |
