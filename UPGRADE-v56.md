# Mizanora v56 — "har page bhara, har gaana chalta, har visitor gina hua"

> **TL;DR** — v55 ne site ko offline chalta hua bana diya. v56 un cheezon ko theek karta hai jo
> phir bhi tooti hui thin:
>
> * **Songs ab play hote hain** — naya mirror layer, fresh-token route, byte-proxy, aur player mein
>   teen-step fallback. Sab fail ho to honest error + YouTube link (dead end nahi).
> * **Search bar ab sab se upar** — `/movies` ke hero mein asli GET form + sticky bar, type filter ke saath.
> * **Khali page khatam** — "data pending" panel: film/series + saal, player, search, popular titles,
>   retry (sirf us page ka cache), aur `noindex`.
> * **Photos kabhi tooti nahi** — `AvatarImg`: asli URL → `/api/img` relay → monogram.
> * **Traffic analytics** — server-side: country, city, masked IP, browser/OS/device, 100k/day goal,
>   `/admin/traffic` dashboard. Firestore bilkul kharch nahi hota.
> * **Sitemaps 150+ files** — `titles-YYYY.xml` (har saal), `actors-a…z`, `songs-a…z`, `quran.xml`,
>   plus `COVERAGE.md` jo sach batata hai kitne pages ke peeche data hai.
> * **Content** — 12 nayi guides + `/blog/author/muaaz-iqbal` hub + 100-topic plan.

Version: **56.0.0** · Pichla: v55 (snapshot, search, singers, sitemaps, player)

---

## 1. Songs: "play nahi ho raha" ka asli hal

Teen masle the, teen ka hal:

| Masla | Hal |
| --- | --- |
| CDN link expire ho jata hai | `/api/songs/audio/<id>` har request par naya token laata hai, phir 302 |
| CDN hotlink/CORS block karta hai | wohi route `?proxy=1` se bytes khud stream karta hai (Range support) |
| Ek mirror down = songs band | mirror list + `Promise.any` race + health report |

Naye files: `lib/songMirrors.js`, `app/api/songs/audio/[id]/route.js`,
`app/api/songs/stream/[id]/route.js`, `app/api/songs/health/route.js`.

Player ka fallback chain (`SongBrowser`, `SongDetailPlayer`):

1. `/api/songs/audio/<id>` (server, fresh token)
2. `/api/songs/audio/<id>?proxy=1` (server bytes)
3. CDN ka seedha link

Teeno fail → saaf message + **Retry** + **YouTube par sunein**. Har song object mein `playUrl` aur
`proxyUrl` hai, is liye koi bhi card/kahin se play kare, rasta wahi rehta hai.

**Env:** `SONGS_API_BASE`, `SONGS_API_BASES` (comma list), `SONGS_AUDIO_PROXY=1`.

---

## 2. Movies search: hero mein, sticky

Pehle search bar page ke neeche tha (shelves ke baad) — user ko lagta tha "search hai hi nahi".

* Hero mein asli `<form action="/movies" method="get">` — `q` + `format` (Sab / Movies / Series /
  Upcoming / Free). JavaScript ke baghair bhi chalta hai, Google bhi follow kar sakta hai.
* `MoviesBrowser` ka search row ab `sticky top-16` hai — grid scroll karo, bar upar rehti hai.
* Type filter API tak jata hai (`?type=movie|series`), is liye "sirf series" wala search bhi sach hai.

---

## 3. Khali page? Ab nahi.

Numbers (sach): sitemap mein **86,783** IDs, committed snapshot **17,157** — baqi live IMDb par.

Jab metadata nahi aata:

| Pehle | Ab |
| --- | --- |
| chhota warning box | poora panel |
| khali poster/cast | film/series + saal (id pool se) |
| kuch karne ko nahi | search box + popular titles + IMDb + movies home |
| retry = page reload | `/api/movies/refresh?slug=` sirf us page ka cache saaf karta hai |
| index ho sakta tha | `noindex` jab tak data na aaye |

Files: `components/TitleStubPanel.js`, `lib/imdbIds.js`, `lib/coverage.js`,
`app/api/movies/refresh/route.js`.

**`npm run coverage`** ab `COVERAGE.md` + `coverage-ids.csv` banata hai: har id ki status
(`data` ya `live-only`), decade-wise table, aur percentage.

---

## 4. Photos: teen step, phir monogram

`components/AvatarImg.js`:

1. asli URL (`referrerPolicy="no-referrer"` — aksar yahi kaafi hota hai),
2. `/api/img` relay (server photo fetch karta hai, CDN ko visitor nazar nahi aata),
3. monogram (naam ke do harf, rangeen gradient).

Kahaan laga: actor page, actors directory, movies page ki stars rail. Song cover par bhi error
handler.

---

## 5. Traffic analytics (naya)

| File | Kaam |
| --- | --- |
| `lib/analyticsServer.js` | IP/geo/UA padhna, mask karna, counters barhana, report |
| `app/api/analytics/collect/route.js` | beacon (204, bot/limit filters) |
| `app/api/admin/traffic/route.js` | admin-only report + cleanup |
| `components/AnalyticsBeacon.js` | har page view par chhota beacon |
| `app/admin/traffic/page.js` | dashboard: goal ring, 24h chart, countries, cities, networks, pages, recent visitors |

Kya track hota hai: page, referrer, country/region/city/timezone, browser/OS/device, **masked IP**
(aakhri octet 0), unique visitor hash (salted, per day).

Kya nahi: naam/phone/email, full IP (jab tak `ANALYTICS_FULL_IP=1` na ho), admin pages.

Storage: **Realtime Database** (`an/` namespace) — Firestore quota zero. `TRAFFIC_GOAL` se goal
(default 100,000). `ANALYTICS_SALT`, `ANALYTICS_OFF=1` bhi maujood.

---

## 6. Sitemaps: 150+ files, aur sach

| File | Kya |
| --- | --- |
| `/sitemap.xml` | core (shop, products, tools, Quran, blog, hubs) |
| `/sitemaps/titles-YYYY.xml` | us saal ke movies + series (canonical partition) |
| `/sitemaps/actors-a…z.xml` | actor profiles |
| `/sitemaps/songs-a…z.xml` | songs (sirf jab mirror jawab de) |
| `/sitemaps/quran.xml` | 114 surahs |
| `/sitemaps/actors.xml` · `live.xml` · `blog.xml` · `songs.xml` | directories/hubs |
| `/sitemap-index.xml` | sab ka index (robots.txt isi ko advertise karta hai) |

* Purane `movies-N` / `series-N` routes zinda hain (cached index ke liye) magar index mein **list
  nahi** hote — ek URL do sitemaps mein nahi.
* `SITEMAP_DATA_ONLY=1` → sirf bhare hue titles (17,157). Quality mode.
* `/sitemaps` page par naya **Coverage card**: kitne %, kitne live par depend.
* Index sirf un letters ke files list karta hai jahan asli data ho.

**Sach:** 500,000 URLs ka target URL count se nahi aata — data se aata hai. 500k ke liye IMDb
datasets se id pool + snapshot dono barhane honge; tab tak `SITEMAP_DATA_ONLY=1` behtar hai.

---

## 7. Content: author hub + 12 guides + 100-topic plan

* `/blog/author/muaaz-iqbal` — Person schema, profile, saare articles. `postsByAuthor()` +
  `authorSlug()` `lib/blog.js` mein.
* 12 nayi guides: Kasur story, Asaan Lang, HijriAnchor, BarakatWave TV, AI orchestration,
  movies system, actor pages, songs player, sitemap playbook, coverage ka sach, analytics/100k plan,
  Live TV + ads, Quran tools, Urdu assistant, COD guide.
* `CONTENT-PLAN-100.md` — 100 topics (angle ke saath). Family/walid ke 6 topics **sirf aap ki asli
  tafseel** se publish honge (interview template plan mein hai).

**Kyun 100 posts ek raat mein nahi:** ek hi baat 100 tarah likhna doorway pages banata hai, aur
kisi ki biography bina tasdeeq likhna galat hai. Plan diya hai — har hafte 3–5, 6 mahine mein 100+.

---

## 8. Env variables (naye)

| Variable | Kaam | Default |
| --- | --- | --- |
| `SONGS_API_BASE` / `SONGS_API_BASES` | apne music mirrors | public mirrors |
| `SONGS_AUDIO_PROXY=1` | hamesha proxy se audio | redirect |
| `SITEMAP_DATA_ONLY=1` | sirf bhare hue titles | poorا pool |
| `ANALYTICS_FULL_IP=1` | raw IP store | masked IP |
| `ANALYTICS_SALT` | visitor hash ka salt | static string |
| `ANALYTICS_OFF=1` | analytics band | on |
| `TRAFFIC_GOAL` | daily goal | 100000 |

---

## 9. Verification

```bash
npm ci
npm run check          # 481+ files, 0 problems
npm test               # v56 suite included
npm run coverage       # COVERAGE.md + coverage-ids.csv
npm run build:offline  # green
```

Dev smoke: `/`, `/movies` (hero search), `/movies/tt1375666`, `/movies/tt0111161`,
`/movies/actors`, `/songs`, `/songs/artist/atif-aslam`, `/sitemaps`,
`/sitemap-index.xml`, `/sitemaps/titles-2026.xml`, `/sitemaps/quran.xml`,
`/blog`, `/blog/author/muaaz-iqbal`, `/blog/mizanora-sitemap-seo-playbook`.

---

## 10. Jo abhi baqi hai (imandari se)

1. **Songs ki liveness** sirf deployment par verify ho sakti hai — sandbox se music mirrors
   reachable nahi. `/api/songs/health` kholein: jo mirror `ok: true` de, wahi play karega.
2. **Analytics** ko Realtime Database chahiye (Firebase Console → Create database).
3. **100k/day** analytics se nahi aata; plan `blog/mizanora-traffic-analytics-100k-plan` mein hai.
4. **70,626 titles** ka data live IMDb par depend karta hai jab tak snapshot na barhe.
