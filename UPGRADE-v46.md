# v46 — poora IPTV system (pages, catch-up, guides)

v46 IPTV ko "kuch pages" se **mukammal system** banata hai: library browse, har movie/series
ka apna page, TV guide, apps setup, status, recharge (with premium unlock animation), 7-din
catch-up, aur 5 naye Roman Urdu guides. Sab kuch Mizanora ke theme mein.

---

## 1. Public library — movies aur series

| Page | Kya hai |
|---|---|
| `/iptv/movies` | poster grid, search, group filter, sort (rating / naye / A–Z) |
| `/iptv/series` | wohi grid, series ke liye; season/episode count badge |
| `/iptv/movies/<id>` | poster, plot, cast, director, runtime, IMDb rating + link, related shelf, Movie JSON-LD |
| `/iptv/series/<id>` | seasons → episodes list, TVSeries JSON-LD (numberOfSeasons/Episodes) |

**Sab se aham:** `lib/iptvPublic.js` ek **whitelist** hai — `safeMovie` / `safeSeries` sirf
naam, poster, plot, cast, rating waghera nikalte hain. `url` field kabhi copy nahi hota, is
liye kisi bhi public page ke HTML/JSON mein stream link nahi mil sakta.

Pages `revalidate = 300` par hain, matlab catalogue update ke 5 minute baad dikhti hai.

## 2. TV guide — `/iptv/guide`

- 400 channels tak ki table: logo, group, **abhi kya chal raha hai**, aage ke 4 programmes
- Search + group filter
- Asli XMLTV programmes jahan hain, baqi channels par gateway ke auto slots
- Jin channels par archive hai unke group ke aage **`7d`** badge
- Neeche catch-up ka tareeqa likha hua

`components/IptvGuideGrid.js` client side hai, magar server se sirf text aata hai — koi URL nahi.

## 3. Apps & setup — `/iptv/apps`

TiviMate, IPTV Smarters, XCIPTV, VLC, MAG/STB emulator, Kodi — har app ka card: device,
price, protocol aur 4-step setup. Neeche login ka table (Xtream / browser / Stalker) aur FAQ
(FAQ JSON-LD ke sath).

## 4. Status — `/iptv/status`

Public counters: channels, groups, movies, series, episodes, EPG sources. `revalidate = 120`.
Admin secrets ya upstream URLs nahi dikhte — sirf endpoint ke naam (`/player_api.php`,
`/xmltv.php`, `/c/`).

## 5. Recharge + premium unlock animation — `/iptv/recharge`

`components/IptvRecharge.js`:

- **Line mode:** plan chunein (Starter/Family/Premium), 1 / 3 / 12 mahine, live total aur
  bachat ka hisab — sab `lib/iptv.js` se (price kabhi do jagah nahi likhi).
- **Reseller mode:** credit packs (Rs 500 / 1000 / 2500 / 5000), kitni lines banti hain,
  ledger ka zikr, connection fee ka split (Rs 20 admin / Rs 30 reseller).
- JazzCash number copy button, `wa.me` deep link (message pehle se bhara hua), cycle 1–10
  aur Rs 200 cap ki wazahat.

**Animation:** `.mz-unlock` (pure CSS, koi video asset nahi) — glow, shine sweep, lock pulse,
marquee. `prefers-reduced-motion` par sab band ho jata hai. Isse page ka weight barha nahi.

## 6. 7-din catch-up (timeshift) — asli feature

```
/timeshift/<user>/<pass>/<minutes>/<YYYY-MM-DD:HH-MM>/<channel>[.ts]
/streaming/timeshift.php?u=…&p=…&f=…&start=…&dur=…
```

- `lib/iptvCatchup.js` (pure, tested): `archiveDaysFor`, `parseStart`, `catchupWindow`,
  `timeshiftUrl`, `catchupLabel`
- `app/api/gw/timeshift/route.js`: line verify → device limit → channel → archive check →
  window validate → proxy
- `lib/gateway/handleStream.js` ka naya `proxyMedia()` live/VOD/catch-up teenon ke liye aik hi
  sealed-segment raasta deta hai
- `app/api/gw/player/route.js`: har channel par `tv_archive` + `tv_archive_duration` +
  `epg_channel_id` (ab XMLTV ke saath match karta hai)
- `app/api/gw/portal/route.js`: Stalker par `archive`, `tv_archive_duration`, `allow_timeshift`
- Limits: max **7 din** peeche, **180 minute** per request, future reject, 45 second ki safety

Provider ka archive URL `ch.archiveUrl` se aata hai aur `{utc}`/`{lutc}`/`{start}`/`{end}`/
`{dur}` placeholders support karta hai; warna default `?utc=…&lutc=…` lagta hai.

## 7. Naye blog guides (category `live-and-reels`)

| Slug | Kya sikhata hai |
|---|---|
| `iptv-browser-player-guide` | app install ke baghair player, browser table, data usage, masle |
| `iptv-epg-xmltv-guide-pakistan` | EPG khaali kyun, XMLTV URL, mapping, time offset, cache |
| `iptv-movies-series-library-guide` | library, IMDb, seasons, apps mein VOD, request |
| `iptv-7-din-catchup-timeshift` | catch-up rules, apps mein kahan, limits, masle |
| `iptv-ads-vs-ad-free` | ad kab aati hai, 6-ghante cooldown, pricing, premium |

## 8. Wiring

- `/iptv` landing par **"Poora system"** block — 12 pages ki grid, aur "Aage parhein" mein naye
  5 guides
- `app/sitemap.js`: `/iptv/{guide,movies,series,apps,recharge,status}` + top **120 movies** aur
  **80 series** ke detail URLs
- `scripts/test-v46.mjs`: **135 assertions** (catch-up maths, route wiring, pages, library
  whitelist, animation CSS, blogs, sitemap, version) — `npm test` mein shaamil

## 9. Kaise check karein

```bash
npm test               # v39…v46 sab
npm run check          # 502 files, 0 problems
npm run build:offline  # production build
```

Live:

```
/iptv                     landing + system grid
/iptv/movies              library
/iptv/movies/<id>         movie page
/iptv/guide               guide + 7d badges
/iptv/recharge            unlock animation
/iptv/status              counters
/xmltv.php?username=…     XMLTV (line-protected)
/timeshift/<u>/<p>/60/2026-11-01:20-00/<id>.ts
```

## 10. Baqi (agla)

1. **1M items** — Firestore shards ki hadd hai; object storage + CDN (R2/S3) par catalogue.
2. **Billing engine** — 1–10 cycle par auto invoice, reminder, suspend, receipt (v41b).
3. **Ad analytics** — ad duration, skip rate, channel-wise fill.
4. **Catch-up UI** — browser player mein timeline scrubber (abhi apps par hai).
