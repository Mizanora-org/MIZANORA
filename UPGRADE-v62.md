# Mizanora v62 — "Zero Origin": public traffic ab CDN se, Function se nahi

> **User ki problem:** *"Vercel free limits ik din me kha jati hai; lakho / croron visitors aayen to
> bhi koi limit cross na ho; deploy Vercel par hi rahe; website ka koi hissa zaya ya damage na ho."*
>
> **Short answer:** v60 (bandwidth) aur v61 (ISR writes) theek thay, lekin dono ne **O(pages)** cost
> theek ki thi. Baqi bacha tha **O(visitors)** cost — har page view par ek Function. Ye release usay
> **zero** karta hai. Jo bachi hui cheez hai wo Vercel ka CDN data-transfer hai (100 GB / month),
> jo kisi bhi host par crore visits ke sath zero nahi ho sakti — wo neeche section 6 me saaf likha hai.

---

## 1. Diagnosis — limit "ek din me" kyun khatam ho rahi thi

v61 ke baad ISR writes ~10K / 30 din (limit 200K) thay. Is liye **naya nuksaan pages se nahi,
visitors se aa raha tha**. Har public page view par ye sab chalte thay:

| # | Har view par kya hota tha | Cost |
|---|---|---|
| 1 | `middleware.js` ka matcher = "sab kuch except static" | **1 Function invocation + poora HTML origin se** (middleware ke sath CDN HIT bypass) |
| 2 | `/api/telemetry` — `trackPage()` | 1 POST / page, aur `heartbeat()` **har 60 s har open tab** = 1 Function / minute / visitor |
| 3 | `/api/analytics/collect` | 1 POST / page **aur har SPA route change** par |
| 4 | `/api/ads/embed.js` | 1 Function / page — halanki **wahi file `public/ads/embed.js` me static maujood thi** |
| 5 | `/api/ads/serve` (`Cache-Control: no-store`) | 1 Function **har ad slot har page** par, ads OFF hone par bhi |
| 6 | `/fonts/*`, `/brand/*`, `/ads/*` | koi `s-maxage` hi nahi tha → CDN baar baar origin se maangta tha |
| 7 | `/icons/*`, `/img/*` | sirf browser `max-age`, koi `s-maxage` nahi |
| 8 | Sitemaps: `lastmod = new Date()` | har regeneration 40,000 URLs ko "aaj badla" bolti thi → rozana pointless re-crawl + body kabhi cache-share na hoti |
| 9 | Docs / data-only commit | poora rebuild + nayi prerender wave (`[skip vercel]` sirf ek workflow me tha) |

**Hisab:** 100k visits/day × (1 middleware + ~1 page beacon + 1 geo beacon + 1 ads embed + 1 ads serve)
≈ **500k Function invocations / din** → Hobby 1M/month **do din me** khatam. Aur middleware ke sath
har page ka ~150–250 KB HTML origin se jata tha → **~20 GB / din** "Fast Origin Transfer" (limit 10 GB).
Isi liye "billing cycle ek din me kha jata hai".

---

## 2. Fix — har public request ka jawab CDN de, Function na

### a) `middleware.js` = ALLOWLIST (sabse bara fix)
Pehle matcher "sab kuch minus static" tha. Ab **sirf woh routes** jahan koi blocked IP kuch *kar*
sakta hai: `/admin/*`, `/api/admin/*`, `/api/account/*`, aur state-change karne wale endpoints
(orders, coupon, upload, telemetry, ads click, worker, cron, …). Probe paths ka security log bhi
ek chhoti regex matcher se zinda hai.

Public HTML, sitemaps, images, JS/CSS, fonts, audio, TV segments aur read-only APIs ab **kabhi
Function me enter hi nahi hote** → 0 invocations / view aur CDN seedha HTML deta hai.

> IP blocklist, probe log aur `/admin/security` recovery screen sab waisay ke waisay hain — bas ab
> unhe sirf *actions* par chalaya jata hai. Public (read-only) page CDN par hota hai; wahan IP check
> lgana har request par Function lagane ke barabar hai aur bypass bhi ho jata hai.

### b) Analytics = deterministic sample (`lib/beaconBudget.js` — naya)
Analytics **delete nahi** hua: Admin > Traffic, `/stats`, live users, countries, browsers — sab hain.
Bas ab har visitor beacon nahi bhejta:

* `NEXT_PUBLIC_TRACK_SAMPLE` default `0.01` → visitor id ke hash se **~1%** visitors chune jate hain
  (stable: ek visitor hamesha in ya hamesha out, koi flicker nahi).
* Server **apne** env se weight nikalta hai (`1/0.01 = 100`) aur har counter ko 100× karta hai —
  client payload ka weight **kabhi trust nahi** kiya jata, to koi counter inflate nahi kar sakta.
* `an/uv/<day>/<vid>` marker ab weight store karta hai; `readTraffic()` values ko sum karta hai
  (purane `true` markers 1 count hote hain — backward compatible).
* `presence` rows me `w` likha jata hai, aur `/api/stats` + `/api/admin/analytics` live-user count
  ko weight se scale karte hain. Heartbeat 60 s → **120 s**, live-user window 90/120 s → **180 s**.
* Har tab ka hard cap: page 4, event 8, heartbeat 6, geo 1. Ek SPA navigation loop ya ghanton ka
  khula tab budget nahi kha sakta.
* `mz_notrack`, `navigator.doNotTrack`, bots aur private-mode sab waise hi respect hote hain.
* Switches: `=1` exact counts (chhoti site / debug), `=0.01` default, **`=0` = bilkul zero
  Function calls from tracking**.

### c) Static assets → `s-maxage=31536000` (`next.config.js`)
`/icons/*`, `/img/*`, `/fonts/*`, `/brand/*`, `/ads/*`, `favicon/icon/apple-icon` ab ek saal edge par,
ek ghanta browser me. Naye deploy par Vercel CDN purge ho jata hai, is liye `immutable` browser cache
se hone wali "purana script atak gaya" wali problem nahi. Pehle `/fonts/*` aur `/brand/*` par koi
header hi nahi tha.

### d) Ads: do Function calls / page → zero
* `components/AdsInject.js` ab `/ads/embed.js?key=self` (pehle se maujood **static** file) load karta
  hai, `/api/ads/embed.js` nahi. Script ka `key` parsing / `HOST` logic waise hi kaam karta hai.
* Third-party sites ke liye `/api/ads/embed.js` zinda hai, ab `s-maxage` ke sath.
* `/api/ads/serve` ab `key=self` ke liye `s-maxage=300` cacheable 200 deta hai (pehle `no-store`,
  aur ads OFF hone par bhi 503 + Function). `Vary: Origin` aur self-origin check brqarar; third-party
  keys ka CORS behaviour bilkul nahi badla.
* `lib/refClient.js`: `RefCapture` aur `WorkerPrices` dono `captureRef()` call karte thay → ab
  in-flight de-dupe, ek hi request.

### e) Sitemaps: stable `lastmod`, 7 din ka CDN cache
* `lib/sitemapVersion.js` (naya) `data/sitemap-version.txt` se stable date padhta hai; weekly
  `imdb-ids.yml` workflow usay tabhi bump karta hai jab catalogue sach me badle.
* Dono sitemap routes: `new Date()` → `sitemapLastmod()`, `s-maxage` 6 ghante → **7 din**
  (weekly data refresh ke barabar), `max-age=0` → 1 din. Origin generation ~**28×** kam, aur Google
  ko har roz "40,000 pages aaj badlay" nahi bola jata.
* `outputFileTracingIncludes` me `/sitemap-index.xml` aur `/sitemap.xml` add kiye — **bug**: ye
  `data/` files request time par padhte thay lekin unke Function bundle me tracing list me nahi thay,
  to Vercel par index kabhi empty catalogue ke sath aa sakta tha.

### f) Kam deployments (`vercel.json` → `ignoreCommand`)
`scripts/vercel-ignore.mjs` docs / `.github` / weekly data-only commits ka deployment skip karta hai
(koi rendered byte nahi badalta, lekin poora rebuild + origin wave hota tha). **Conservative:** koi
bhi code file badle → build; git na mile ya koi error → build; `[deploy]` commit message ya
`VERCEL_FORCE_BUILD=1` se force kar sakte hain. `crons` sirf 1 (Hobby: 2/day) waisa hi.

### g) Jo **badla nahi** (jaan boojh kar)
* `revalidate = 86400` live-data pages, static repo-only pages, prerender caps (12/12/24/200) —
  v61 ka ISR budget theek hai aur ye traffic ke sath nahi badhta. Badalne se admin ke on-demand
  `revalidatePath` freshness ka risk hota. `npm run test:v61` sab pin karta hai.
* `/api/img`, `/api/tv/p`, `/api/songs/cdn`, photo relay fallback, TV relay budget, songs direct-CDN —
  v60 ke tamam switches. `npm run test:v60` sab pin karta hai.
* Koi bhi page, component, API ya feature delete nahi hua. `/search` (`force-dynamic`, `noindex`) ab
  bhi ek hi dynamic page hai aur wo **user ke search karne par** chalta hai, automatic view par nahi;
  uska product-search API pehle se `s-maxage=600` se edge-cached hai.

---

## 3. Bugs jo is release me mile aur theek kiye (detail ke sath)

| # | Bug | Asar | Fix |
|---|---|---|---|
| 1 | Middleware matcher sab requests par | har view = Function + CDN bypass | allowlist (`middleware.js`) |
| 2 | `staticPath` check Function ke **andar** tha | static file par bhi invocation (skip karne se pehle Function chal chuka tha) | ab matcher hi unhe rokta hai; `ALWAYS_SKIP` defense-in-depth |
| 3 | `AnalyticsBeacon` har `usePathname()` change par POST | SPA navigation par duplicate beacons | `takeBeacon('geo')` — 1 / session |
| 4 | Heartbeat 60 s, koi cap nahi | 1 Function / minute / open tab, hamesha | 120 s + 6/tab cap + sampled |
| 5 | `/api/ads/embed.js` Function, jabke `public/ads/embed.js` maujood | 1 Function / page with ads | static `/ads/embed.js` |
| 6 | `/api/ads/embed.js` me `max-age` tha, `s-maxage` nahi | Vercel CDN Function ka jawab cache hi nahi karta (v60 ka apna niyam yahan bhool gaya tha) | `s-maxage=31536000` |
| 7 | `/api/ads/serve` `no-store` + 503 jab ads OFF | har slot har view par Function, "off" jawab bhi cache na ho | `key=self` → cacheable 200, `s-maxage=300` |
| 8 | Sitemap `lastmod = new Date()` | rozana 40k URLs ka jhootha "changed" signal, cache reuse na hona | stable data date |
| 9 | `sitemap-index.xml/route.js` comment "STATIC" tha, code `force-dynamic` | galat documentation, galat assumptions | comment theek + edge cache + stable lastmod |
| 10 | `outputFileTracingIncludes` me sitemap routes missing | Vercel par data files bundle se gayab → empty index | dono routes add |
| 11 | `RefCapture` + `WorkerPrices` dono `captureRef()` | ref visitors ko 2 identical API calls / page | in-flight de-dupe |
| 12 | `/api/indexnow-key` par koi cache header nahi | crawler har check par Function | `s-maxage=31536000` |
| 13 | `/fonts/*`, `/brand/*`, `/ads/*` par `Cache-Control` hi nahi | baar baar origin transfer | `EDGE_YEAR` headers |
| 14 | `uv` marker sirf `true`, presence sirf count | sampling ke sath numbers 100× chhote ho jate | weight store + sum (backward compatible) |
| 15 | `/api/analytics/collect` GET 204 par koi header | stray GET bhi Function | cached 204 |
| 16 | Docs/data-only push poora deploy | bekaar ISR writes + origin wave | `ignoreCommand` |

---

## 4. Vercel par kya karna hai

1. Is branch ka PR merge karein → **ek** deploy. Naya `ignoreCommand` bhi isi deploy se active hoga.
2. Env var (optional, default already safe):
   * `NEXT_PUBLIC_TRACK_SAMPLE=0.01` — default. Exact chahiye to `1`, bilkul band chahiye to `0`.
   * `VERCEL_FORCE_BUILD=1` ya commit message me `[deploy]` — force redeploy ke liye.
   * Purane v60/v61 switches (`NEXT_PUBLIC_IMAGE_RELAY`, `NEXT_PUBLIC_TV_RELAY`,
     `NEXT_IMAGE_OPTIMIZE`) jaise hain. **Naya env set karna zaroori nahi** — defaults hi Hobby-safe
     hain.
3. Vercel → Usage me dekhein (deploy ke agle din):
   * **Function Invocations** flat (sirf admin/search/checkout jaise user actions).
   * **Fast Origin Transfer** flat (sirf API jawab, HTML nahi).
   * **ISR Writes** ~10K/month par waisa hi (v61).
   * **Fast Data Transfer** traffic ke sath badhega — ye CDN ka normal egress hai, neeche dekhein.
4. Admin > Traffic aur `/stats` ke numbers ab **estimated** hain (1% sample × 100). Agar aap chahein
   to `NEXT_PUBLIC_TRACK_SAMPLE=1` se exact kar sakte hain — lekin traffic zyada ho to ye wahi purana
   O(visitors) cost wapas layega.

---

## 5. Verification (sab offline, is sandbox me chalaya gaya)

```bash
npm run check                 # syntax + imports
npm run test:v60              # bandwidth rules (v60 intact)
npm run test:v61              # ISR rules (v61 intact)
npm run test:v62              # NAYA: 60+ zero-origin checks
npm test                      # poora suite (v62 bhi shamil)
npm run build:offline         # asli production build, bina network ke
```

`scripts/test-v62.mjs` runtime me bhi prove karta hai: 1% sample, weight 100, per-tab caps,
bots/opt-out, `SAMPLE=0` par **zero** beacons, aur server/client ke weight ka aapas me match.

---

## 6. Iman-dari ki baat (jo code se theek nahi hoti)

Vercel Hobby par **Fast Data Transfer** (~100 GB / 30 din) bhi hai: ye wo bytes hain jo CDN
visitors tak bhejta hai. Koi bhi code — kisi bhi host par — **crore page views ko zero bytes** nahi
bana sakta; har visitor ko HTML to milna hai. Is release ne guarantee ki hai ke **Function
invocations, ISR writes aur Fast Origin Transfer ab visitors ke sath nahi badhte** — yani traffic
spike se project pause nahi hoga. Lekin agar waqai crore monthly visitors hain to 100 GB egress ke
liye **Pro plan ya dedicated CDN** chahiye; ye billing ka faisla hai, code ka nahi.

Jo abhi bhi Function use karte hain (sab **user-initiated**, kisi page view par automatic nahi):
admin panel, checkout/orders, search API, song/TV playback, uploads. In sab par pehle se
`s-maxage` / rate limits hain.

---

## 7. Naye file / badlav ka khulasa

```
lib/beaconBudget.js            naya   — sample + weight + per-tab caps
lib/sitemapVersion.js          naya   — stable lastmod
data/sitemap-version.txt       naya   — weekly workflow isay bump karta hai
scripts/vercel-ignore.mjs      naya   — docs/data-only pushes skip
scripts/test-v62.mjs           naya   — 60+ offline checks
middleware.js                  badla  — allowlist
next.config.js                 badla  — EDGE_YEAR headers + tracing
vercel.json                    badla  — ignoreCommand
components/{AdsInject,Tracker,AnalyticsBeacon}.js  badla
lib/{track,analyticsServer,refClient,cachePolicy}.js  badla
app/api/{telemetry,analytics/collect,ads/serve,ads/embed.js,indexnow-key,stats,admin/analytics}/route.js  badla
app/sitemaps/[file]/route.js, app/sitemap-index.xml/route.js  badla
.github/workflows/imdb-ids.yml, .env.example, package.json (v62.0.0), UPGRADE-v62.md  badla
```
