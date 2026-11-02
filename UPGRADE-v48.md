# v48 — IPTV poora khatam, sirf Live TV

Aap ka hukm tha: **"IPTV wala all system khatam kerdo, sirf Live TV chalta rahe."**
v48 exactly wahi karta hai. IPTV ka koi page, koi API, koi gateway, koi rule, koi cron
aur koi link baqi nahi — aur Live TV (jo pehle se alag system tha) bilkul jaisa tha waisa
chal raha hai.

Version **48.0.0**. Branch `arena/0e3fa5e0-mizanora`.

---

## 1. Kya hataya gaya (publish par ye sab 404 nahi, redirect hain)

| Hataya gaya | Kya tha |
|---|---|
| `app/iptv/*` (15 pages) | IPTV home, channels, guide, player, apps, movies, series, recharge, reseller, trial, start, status |
| `app/account/iptv` | Customer ka apna line / usage / renewal |
| `app/admin/iptv` + `app/api/admin/iptv/*` (16 routes) | Lines, trials, billing, EPG, VOD, meta, source, stats, export, access, ads |
| `app/reseller`, `app/api/reseller/*` | Reseller panel + apply |
| `app/api/iptv/*` | Trial form aur account lookup |
| `app/api/cron/iptv` | Rozana billing / auto-suspend job |
| `app/api/gw/*` (12 routes) + `next.config.js` rewrites | **Xtream / Stalker gateway**: `player_api.php`, `get.php`, `xmltv.php`, `portal.php`, `server/load.php`, `/live|movie|series/<u>/<p>/<id>`, `timeshift.php` |
| `app/timeshift/[...parts]` | 7-din catch-up |
| `lib/iptv*.js` (15 files) | Catalogue, lines, billing, EPG, VOD, catch-up, reseller, stats, ads, access, archive, meta, public |
| `lib/gateway/*` (16 files) | Sealed stream handler, shards, security, upstream, IMDb, timeshift |
| `lib/resellerAuth.js` | Reseller login |
| `components/Iptv*.js` (20) + `AccountIptv`, `AdminIptv`, `ResellerApply`, `ResellerPanel` | Poora IPTV UI |
| `docs/IPTV-PLAN.md`, `docs/IPTV-AUDIT-2026-11.md`, `UPGRADE-v39…v47.md` | IPTV ka plan, audit aur changelog |
| `vercel.json` → `crons` | `/api/cron/iptv` ka daily job |
| `firestore.rules` → `iptvTrials`, `iptvLines`, `iptvResellers`, `iptvResellerApps`, `iptvSessions`, `iptvLockouts`, `iptvPayments`, `iptvEvents` | IPTV ka database surface |
| 16 blog guides | xtream codes, TiviMate, Stalker/MAG, Smart TV, SIRAVEX, reseller guides, EPG, catch-up, buffering, movies library, ads-vs-ad-free, legal |
| `scripts/test-v39…v47.mjs` | Un tests ka koi matlab nahi raha |

## 2. Purane link zinda hain (SEO + WhatsApp + printed cards)

`next.config.js` mein permanent (308) redirects — 404 ki jagah sahi page:

| Purana address | Ab kahan |
|---|---|
| `/iptv` | `/live` |
| `/iptv/<kuch bhi>` | `/live` |
| `/reseller` | `/live` |
| `/account/iptv` | `/account` |

## 3. Live TV — chhooa tak nahi gaya

Ye sab **pehle din se alag system** tha aur waisa hi hai:

- `/live`, `/live/<channel>` — channel switch, search, favourites, quality, guide
- `/live-channel` — Quran & Hadith 24/7 channel + us ka HLS m3u8 + YouTube cast
- Admin → **Live TV** (100,000 channels, M3U file/link, bulk tools, product ads)
- Admin → **Live Channel** (schedule, themes, voice, ads)
- `lib/liveTv*.js`, `lib/liveChannel*.js`, `lib/liveBadges.js`, `lib/tvProxy.js`
- `/api/live/*`, `/api/admin/tv/*`, `/api/tv/p` (stream relay), `/api/admin/tv-check`, `/api/admin/tv-import`

**Ek cheez aap ne rakhne ko kahi:** Admin → Live TV ka **"Connect an Xtream Codes panel"**
importer (`app/api/admin/tv/xtream`, `lib/xtream*.js`, `components/XtreamImport.js`). Ye IPTV
line nahi banata — sirf apne provider ka channel list Live TV mein le aata hai. Ye admin-only
hai, password store nahi karta, aur private/loopback addresses refuse karta hai.

## 4. Shop par koi IPTV nishan nahi

- Header ka **IPTV** tab hata diya (Live TV wahi hai)
- Footer se `Mizanora IPTV`, `Free IPTV key`, `IPTV reseller`, `Reseller panel` nikal diye
- Admin sidebar se **IPTV** entry hata di
- `sitemap.xml` se 11 IPTV URLs + movies/series pages nikle, `/live` barqarar
- `robots.txt` se `/account/iptv` aur `/reseller` nikle
- Blog taxonomy se `iptv` / `xtream` keywords nikle
- 16 IPTV guides delete; bachi hui guides mein jo link IPTV par jata tha wo theek kiya
  (`scripts/check.js` ab bhi har broken `/blog/<slug>` link par fail hota hai)

## 5. "Bug-free" ka saboot — naya test

`scripts/test-v48.mjs` (npm test chain mein) 65 checks chalata hai:

- koi IPTV route / lib / component / link / API reference baqi na ho
- gateway rewrites, cron aur Firestore rules waqai khatam hon
- purane addresses redirect karte hon
- Live TV ki har file maujood ho, M3U parse ho, 100,000 channels ki limit ho
- Xtream importer admin-gated ho
- sitemap par `/live` ho aur IPTV na ho, blog/docs mein IPTV na ho

## 6. Aap ke liye 3 kaam (ek dafa)

1. **Vercel → Environment Variables:** `IPTV_GW_SECRET` aur `CRON_SECRET` delete kar dein
   (ab koi use nahi karta). `TV_PROXY_SECRET` rakhein — Live TV ka relay usi par chalta hai.
2. **Firebase Console → Firestore:** purane collections `iptvLines`, `iptvTrials`,
   `iptvResellers`, `iptvResellerApps`, `iptvSessions`, `iptvLockouts`, `iptvPayments`,
   `iptvEvents`, `siteMeta/iptvSource`, `siteMeta/iptvCatalogue`, `siteMeta/iptvVod`,
   `siteMeta/iptvAccess` delete kar dein. **Rules already hata diye hain**, is liye ab inhe
   koi browser se padh bhi nahi sakta — magar data para rahega. (Customer lines ka backup
   chahiye to pehle export kar lein, phir delete karein.)
3. **Google Search Console:** `sitemap.xml` dobara submit karein. `/iptv/*` ab 308 se `/live`
   par ja raha hai, is liye purane ranking pages khud settle ho jayenge.

## 7. Verification (isi branch par chalaya gaya)

```bash
npm ci
npm run check          # 411 files checked, problems: 0
npm test               # 22 test files, sab pass (v48: 65 checks)
npm run build          # production build pass
```

Live server par bhi check kiya: `/` `/live` `/live-channel` `/admin/tv` `/blog` `/sitemap.xml`
`/robots.txt` → **200**; `/iptv`, `/iptv/channels`, `/reseller` → **308 → /live**;
`/account/iptv` → **308 → /account**.
