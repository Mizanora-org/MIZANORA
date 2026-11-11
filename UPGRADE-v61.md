# Mizanora v61 — ISR writes: 620K / 200K se wapas limit ke andar

> **Kya hua:** 9 Nov 2026 ko naye Vercel account par deploy ke kuch hi ghanton me limit phir full ho gayi.
> Is dafa sirf bandwidth nahi thi:
>
> | Resource | Used / Limit |
> |---|---|
> | **ISR Writes** | **620K / 200K** ❌ (3×) |
> | Fast Origin Transfer | 23.92 GB / 10 GB ❌ |
> | Fluid Active CPU | 3h 23m / 4h ⚠️ |
> | Fast Data Transfer | 19.68 GB / 100 GB (theek) |
> | Function Invocations | 200K / 1M (theek) |
>
> Ye **ek hi deployment** me hua — is liye ye "traffic" nahi thi, **build + revalidation** thi.

## 1. Asli hisaab (diagnosis)

`next build` ke output se: **534 pages prerender** ho rahe the, aur unme se ~500 par
`export const revalidate = 1800` (ya 600/3600) laga hua tha.

```
har prerendered page  = 1 ISR write (build ke waqt)
                      + 1 write har expiry par (pehla visitor)
534 pages × 48 writes/day × 30 din  ≈  770,000 writes        (limit 200,000)
```

Do aur cheezain isi ke sath:

* **Har regenerate = poora HTML Function se** → Fast Origin Transfer 23.92 GB.
* **Weekly workflow** (`imdb-ids.yml`) har hafte `data/imdb-ids.txt` commit karta tha → push →
  **poora rebuild → 534 ISR writes** sirf ek text file ke liye.

### 1b. Doosri (chhupi hui) wajah: inner cache TTL bhi ISR ko neeche kheenchta hai

Sirf page par `revalidate = 86400` likhna kaafi **nahi** tha. Next.js har page ka ISR us sab se
**chhote** `unstable_cache` / `fetch(..., { next: { revalidate } })` tak floor kar deta hai jo us page
ke render tree me aata hai. Aur `app/layout.js` puri site ka layout hai — us me `getProducts`,
`getTheme`, `getSiteStatus`, `getInject`, `getQuranConfig`, `getAppMusic` sab chalte hain.

Is liye jab tak `lib/` me 6-12 ghante wale helpers thay, **saare 325 "daily" pages** asal me
6-12 ghante par regenerate ho rahe thay. Build manifest ne ye pakra:

```
pehle : { "1800": 1, "21600": 2, "43200": 322 }   <- pages 86400 likhe thay
baad  : { "86400": 325 }                          <- ab waqai 1 din
```

Sab se zyada nuqsan do jagah se tha:

| Helper | Pehle | Ab |
|---|---|---|
| `lib/products.js` `CATALOG_TTL` (har page layout se) | 12h | **24h** |
| `lib/products.js` catalogue count | 6h | **24h** |
| `lib/reviews.js` reviews list | 6h | **24h** |
| `lib/githubLive.js` GitHub card | 30 min (`GITHUB_CACHE_SECONDS`, env se!) | **24h, fixed** |

**Sabak:** koi bhi naya `unstable_cache`/`fetch` cache `revalidate` **86400 se kam** na rakhein, aur
env var se na chalayein (ek env var poori site ka budget kharab kar deta hai). `npm run test:v61`
ab `lib/` ke har `revalidate:` ko scan karta hai aur fail ho jata hai agar koi 86400 se kam ho ya
`process.env` padhe.

## 2. Fix (v61)

### a) `revalidate` ab sirf un pages par jahan zaroorat hai
* **Repo-only pages (bilkul static, 0 writes):** blog (post/category/author), tools (+index), quran
  (+index), hadith, islamic, news, muaaz-iqbal, reviews, sitemaps directory, live-channel shell,
  winter, team, movies/world, stats.
* **Live-data pages (1 din):** home, product, products, category, deals, reels, wishlist, live TV
  (index + channels), movies (+actors + calendar), songs.
  Admin jab kuch save karta hai to `/api/revalidate` foran refresh kar deta hai — is liye 1 din bhi
  purana nahi lagta.

### b) Prerender caps (build halka, writes kam)

| Route | Pehle | Ab |
|---|---|---|
| `/product/[slug]` | 60 | **12** |
| `/category/[slug]` | 60 | **12** |
| `/live/[slug]` | 200 | **24** |
| `/movies/actor/[slug]` | saare | **200** |

Baqi sab pehli request par banta hai (`dynamicParams = true`) aur phir cached rehta hai. Sitemap
poora catalogue list karta hai, is liye SEO par koi asar nahi.

### c) Weekly data commit deploy nahi karayega
`imdb-ids.yml` ab `[skip vercel]` ke sath commit karta hai — Vercel us commit ko ignore karta hai.
Sitemaps file ko request time par padhte hain, is liye list foran taza hai.

### d) Natija (estimated)

| | Pehle | Ab |
|---|---|---|
| Build par prerendered pages | 534 | **329** |
| Live-data pages with ISR | ~500 | 325 (sab 86400) |
| Manifest ka sab se chhota revalidate | 600 s | **86400 s** |
| ISR writes / 30 din (estimate) | ~770K | **~10K** (325 × 1/day) |
| Origin transfer per regenerate | poora HTML | sirf jab koi page expire ho |

## 3. Agar aap ko zyada taza chahiye

Har live-data page par literal `86400` likha hai. Kam karna ho (e.g. 6 ghante = 21600) to:

```bash
grep -rln "export const revalidate = 86400" app | xargs sed -i 's/export const revalidate = 86400.*/export const revalidate = 21600;/'
npm run test:v61   # check karega ke koi page 86400 se chhota na ho jaye ghalti se
```

**Warning:** 1800 (30 min) par wapas na jayein — wohi 620K writes ki wajah thi. 6 ghante tak theek hai
(~325 pages × 4 writes/day × 30 ≈ 39K writes). Aur `lib/` ke inner TTL bhi usi ke sath kam karne
parenge, warna wo phir floor ban jayenge (`npm run test:v61` batata hai).

## 4. Vercel par kya karna hai

1. Ye branch merge → deploy (bas ek deploy — build writes bhi ab kam hain).
2. Vercel → Usage: **ISR Writes** ab ~5K/200K par ruk jayega. Purane 620K ka counter rolling
   30-day window me slowly neeche aayega.
3. Naye account par **Pro plan** nahi chahiye — Hobby is fix ke sath kaafi hai, bashart ke Live TV
   relay zyada use na ho (`NEXT_PUBLIC_TV_RELAY=off` emergency switch maujood hai).
4. `ISR_REVALIDATE_SECONDS`, `CATALOG_CACHE_SECONDS` aur `GITHUB_CACHE_SECONDS` **na** set karein.
   Revalidate ki value ab code me literal hai, aur env se chalne wale cache TTL hata diye gaye hain —
   warna ek env var poori site ka ISR budget phir kharab kar deta hai.

## 5. Yaad rakhne wale teen sawal (naya page banate waqt)

1. Ye page **repo** se banta hai? → koi `revalidate` na likhein.
2. Ye page **live data** dikhata hai? → `revalidate = 86400` (ya 21600) + admin save par
   `/api/revalidate`.
3. Kya ye page **build par** banna zaroori hai? → sirf top N (`generateStaticParams` me cap).

`npm run test:v61` in teeno niyamon ko check karta hai.
