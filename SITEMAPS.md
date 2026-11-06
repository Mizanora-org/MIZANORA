# MIZANORA sitemaps — har file ki poori list, tafseel aur guide

Ye document batata hai ke Mizanora **kaun kaun se sitemap** publish karta hai, har file ke andar
kya hota hai, kitne URLs hote hain, aur Google Search Console mein kya submit karna hai.

> Live, human-readable version: **https://mizanora.vercel.app/sitemaps**

---

## 1. Ek nazar mein

| Sitemap file | Kya hai andar | Kitne URLs (default) | Priority | Change freq |
| --- | --- | --- | --- | --- |
| `/sitemap-index.xml` | **Sitemap index** — baqi sab files ki list | 8+ files | — | 6h cache |
| `/sitemap.xml` | Core pages: home, shop, categories, products, tools, Quran (114), Hadith, blog, Live TV, movies hub | ~500 – 40,000 | 1.0 – 0.5 | hourly |
| `/sitemaps/movies-0.xml` … `movies-N.xml` | Har IMDb film, **naye saal pehle** | 20,000 per file | 0.7 | 6h |
| `/sitemaps/series-0.xml` … `series-N.xml` | IMDb series / dramas | 20,000 per file | 0.7 | 6h |
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

`ceil(movies / 20000)` + `ceil(series / 20000)` + 4 (actors, live, blog, songs) + `/sitemap.xml`.

| Titles | Movie chunks | Series chunks | Total files in index |
| --- | --- | --- | --- |
| 20,000 | 1 | 1 | 7 |
| 86,783 (current snapshot) | 5 | 1 | 11 |
| 200,000 | 10 | 1 | 16 |
| 500,000 | 25 | 1 | 31 |

(Agar series 100k+ ho jayein to series chunks bhi barh jaate hain.)

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
