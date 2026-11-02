# v45 — EPG guide, bulk channels, ads jo stream ki jagah chalti hain, browser player, tabbed panel

Logon ne kaha tha ke panel "asli IPTV panel jaisa" nahi lag raha. Is version mein wohi cheezein
BarakatWave jaisi bana di gayi hain, magar Mizanora ke apne content aur apne gateway par.

---

## 1. EPG guide (XMLTV) — asli programmes, warna generated slots

- Admin > IPTV > **EPG guide** tab mein apna **XMLTV link** daalein (`guide.xml`, `.xml.gz` — jo bhi host de).
  "Test" pehle batata hai kitne channels/programmes mile.
- Source add karte hi **naam se auto-map** hota hai (Geo News → `geo.pk`); jo reh jaye woh table mein
  manually likh dein aur **Save mapping** dabayein.
- `xmltv.php?username=…&password=…` ab asli guide deta hai (line ke baghair khulta nahi).
- **Jis channel ka programme na mile**, us ke liye generated 2-ghante slots bharte hain — app ki guide
  kabhi khali nahi dikhti (BarakatWave bhi yahi karta hai).
- Player ke liye: `GET /api/gw/guide?username=…&password=…` → har channel ka **abhi / agla** programme.
- Cache: 10 minute (`tags: iptv, iptv-epg`), jab bhi admin kuch badle tag clear ho jata hai.

## 2. Ads — ab **stream ki jagah** chalti hain (player mein overlay nahi)

Pehle ad sirf config tha. Ab gateway khud ad deta hai:

1. Customer channel kholta hai → gateway dekhta hai us channel par admin ka ad ON hai aur is line ne
   **6 ghante** mein yeh ad na dekha ho.
2. Tab **channel ki jagah ad** jati hai: HLS ad ho to playlist (segments bhi sealed) + `#EXT-X-ENDLIST`,
   MP4 ad ho to seedha proxy. Header `X-Mizanora-Ad: 1` bhi lagta hai.
3. Ad khatam → IPTV app channel dobara maangta hai → ab **asli stream** milti hai. 6 ghante tak dobara ad nahi.
4. `iptvEvents` mein `ad_start` log hota hai (kaun, kaunsa channel, kab).

Yeh wohi "intro → live" tareeqa hai jo BarakatWave karta hai, magar hamare gateway mein.
Banner (image) ho to stream rukti nahi — sirf hamare player mein banner dikhta hai.

## 3. Browser player — `/iptv/player`

- Login: apni line ka **username/password** (wahi jo Xtream app mein chalta hai).
- Live TV / Movies / Series, group filter, search, logo/poster, rating.
- Video `hls.js` se chalta hai; **ad pehle isi video mein** chalti hai, "Skip 5s → Skip ad" button,
  offer link, phir channel.
- Live par **Abhi / Agla** programme (guide se), mute, fullscreen, logout.
- API: `POST /api/gw/me` (line verify + listing, koi asli URL nahi) aur `GET /api/gw/guide`.
- `/iptv` page par "Browser player" button, sitemap mein bhi shamil.

## 4. Channels — bulk management

Admin > IPTV > **Channels** tab:

- Search + group filter + **pagination** (40 per page).
- Har row par checkbox; **select page** ya alag alag select.
- Bulk bar: **Move group**, **Turn OFF**, **Turn ON**, **Delete**, **Bulk save to server**.
- **Manual channel add** (naam + link + group) — M3U ke baghair bhi.
- Import (link/paste), Save catalogue, Clear, ON/OFF switch — sab pehle jaisa, magar ab bara catalogue
  shards mein jata hai (v44) aur table hazaron channels sambhal leti hai.
- API: `POST { action:'bulk', ids:[…], mode:'patch'|'delete', group?, off? }`, `POST { action:'add', rows:[…] }`.

## 5. Panel — professional tabs

`/admin/iptv` ab ek hi lambi list nahi:

| Tab | Kya |
|---|---|
| **Overview** | KPI, trial requests, lines, accounts, reseller applications, resellers, collection |
| **Analytics** | din ke hisab se plays/logins, top channels, top apps, reseller-wise |
| **Live now** | kaun online, app, channel, IP, devices, event log |
| **Xtream users** | search, har field edit, renew, suspend, reset password, delete |
| **Channels** | bulk management (upar) |
| **Movies & series** | import, IMDb enrich, manual movie, toggles |
| **EPG guide** | XMLTV sources + mapping |
| **Ads & archive** | ads config + GitHub archive push |
| **Backup source** | optional upstream backup (purana Xtream/M3U, sirf import/test) |

---

## 6. Naye endpoints

| Endpoint | Kaam |
|---|---|
| `POST /api/gw/me` | line login + catalogue listing (player) |
| `GET /api/gw/guide` | channel-wise now/next EPG |
| `GET/POST /api/admin/iptv/epg` | guide sources, test, auto-map, manual mapping |
| `POST /api/admin/iptv/channels {action:'bulk'|'add'}` | bulk edit / manual add |
| `GET /xmltv.php?username&password` | apps ke liye guide (ab bhara hua) |
| `/live/<u>/<p>/<id>.m3u8` | ad due ho to ad, warna channel |

---

## 7. Test

```
node scripts/test-v45.mjs      # 81 checks
```
Poori chain: `npm test` (v39…v45), `npm run check`, `npm run build:offline`.

---

## 8. Baqi (agla)

1. **Premium unlock + recharge animation** (video/CSS) — plans aur JazzCash number mojood hain, screen baqi.
2. **7-din catch-up / archive** — EPG poora hai, catch-up abhi nahi.
3. **Public movies/series pages** (poster grid + IMDb detail) — player ke andar browse hai, public pages baqi.
4. **10 lakh+ entries** — shards ~4.8 lakh tak; 10 lakh ke liye object storage/CDN.
5. **v41b billing engine** — auto 1–10 invoice, reminders, suspend, receipt.
6. Ad **duration-wise** hisab (kitne logon ne ad dekha/kitne skip) — abhi `ad_start` event log hota hai.
