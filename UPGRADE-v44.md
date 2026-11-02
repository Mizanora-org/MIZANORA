# v44 — IMDb, bara catalogue, Xtream users ka poora manager, analytics, GitHub archive, ads

v43 mein Mizanora apna panel ban gaya (apna content → Xtream + Stalker). v44 us panel ko
**BarakatWave level** ka bana deta hai.

---

## 1. IMDb metadata (poster, rating, plot, cast) — Cinemeta se, bina API key

- Provider: **Cinemeta** (Stremio ka khula IMDb mirror) — `v3-cinemeta.strem.io`.
  Search: `/catalog/movie|series/top/search=<title>.json`, detail: `/meta/movie|series/<ttID>.json`.
  Poster/backdrop: `images.metahub.space`.
- Naam khud saaf hota hai: `The.Matrix.1999.1080p.WEB-DL.x264-GRP` → **The Matrix (1999)**.
  `S01E02`, `1x05`, `(2024)`, `720p`, `WEBRip`, `x265`, release group — sab hatt jata hai.
  `1917` jaisi numeric title bhi bachi rehti hai.
- Best match: token overlap + saal ka bonus; score `0.55` se kam ho to **kuch change nahi** hota.
- Kya badalta hai: `name, year, rating, plot, poster, backdrop, genres, runtime, cast, director, imdbId`.
  **Kya nahi badalta:** `url, id, ext, group` (stream link aur player ki addressing wohi rehti hai).
- Panel: **Movies & series** card mein do button — `IMDb — movies` / `IMDb — series`.
  Har dabane par 16 items (60s Vercel limit ke andar), `filled / scanned / misses` dikhta hai.
  API: `GET /api/admin/iptv/meta` (kitne adhoore hain), `POST {action:'enrich', kind, limit}`,
  `POST {action:'search', q}` (sirf test).

> Note: Cinemeta "as-is" public service hai. Bohat bara catalogue bharne ke liye button baar baar
> dabayein (har call 16) — 6 ghante ka cache hai, is liye dobara mehnga nahi parta.

---

## 2. Bara catalogue — Firestore shards (1 doc ki 1 MB limit ka hal)

Aik Firestore document 1 MB se bara nahi ho sakta, aur 1 lakh channels usme nahi aate. Is liye:

- `siteMeta/iptvCatalogue` (aur `iptvVod`) sirf **counts + settings** rakhta hai.
- Bari list `…/shards/sXNNN` documents mein 800-800 ke tukron mein jati hai (`lib/shardPlan.js`).
- Padhne par sab shards jod diye jate hain (`readShardedDoc`), likhne par `writeShardedDoc`
  purane shards hata kar naye likhta hai (batch 380 ka, kyunki Firestore ki hadd 500 hai).
- Caps: **4,80,000 channels**, **2,40,000 movies**, **1,20,000 series** (600 shards × 800).
- 10 lakh se zyada chahiye to Firestore theek jagah nahi — us ke liye Cloudflare R2 / GitHub file /
  object storage chahiye (dekhein "Baqi" neeche).

Admin API jawab mein `shards: { sharded, shardCount, totalEntries }` bhi aata hai.

---

## 3. Xtream users / lines — poora manager

`GET /api/admin/iptv/lines?q=` — search (username, client, phone, MAC, email, reseller) aur har line
ke saath: plan, devices, price, expiry, state, **aakhri app / channel / IP / kitne pehle**.

`POST` actions:

| Action | Kya karta hai |
|---|---|
| `save` | har field edit: clientName, phone, email, username, plan, maxDevices, price, mac, device, days/expiresAt, status, reseller, note |
| `renew` | 1/3/6/12 mahine aage (expiry se, aaj se pehle nahi) |
| `suspend` / `resume` | foran band / chalu |
| `resetPassword` | naya 8-char password (admin ko dikhta hai) |
| `delete` | line + us ka session doc |

Price cap (`Rs 200`) aur plan-device niyam server par check hote hain — UI par bharosa nahi.

---

## 4. Analytics

`GET /api/admin/iptv/stats?days=7|14|30`:

- KPI: lines, active, expiring, expired, suspended, resellers, online, devices, plays 24h, logins 24h.
- `daily[]` — din ke hisab se plays/logins (panel mein bars).
- `topChannels[]`, `topApps[]` (TiviMate, Smarters, XCIPTV, VLC, MAG, Kodi…).
- `resellers[]` — lines / active / online / plays per reseller.

Sab `iptvEvents` + `iptvSessions` se; koi alag mahnga analytics service nahi.

---

## 4b. Reseller panel mein search

Reseller apne clients mein naam / username / phone / MAC / plan se search kar sakta hai (client-side
filter — koi extra read nahi). Counter "kitne dikh rahe / total" bata deta hai.

## 5. GitHub archive (aap ke token se, private repo mein)

`POST /api/admin/iptv/archive { action:'push', repo, branch, token? }`

Files (aik hi atomic commit mein, `git/trees` API se):

```
iptv/archive/<stamp>/catalogue.json     channels (asli links)
iptv/archive/<stamp>/vod.json           movies + series
iptv/archive/<stamp>/mizanora-catalogue.m3u
iptv/archive/<stamp>/lines.csv          username, plan, status, devices, masked MAC
iptv/archive/<stamp>/README.md
iptv/latest.json                        aakhri archive ka summary
```

- **Password kabhi archive mein nahi jata**; MAC `00:1A:79:**:**:**` masked hota hai.
- Token: `GITHUB_ARCHIVE_TOKEN` (repo scope) + `GITHUB_ARCHIVE_REPO` env — ya panel mein ek dafa paste
  karein, **Firestore mein save nahi hota**.
- `action:'preview'` se pehle file list + size dekh lein (kuch push nahi hota).
- Aakhri commit ka link panel mein aata hai; metadata `siteMeta/iptvArchive` mein.

---

## 6. Ads — kisi bhi channel par

`siteMeta/iptvAds`: preroll video, banner, click link, title, skip seconds, channel list.

- Khali channel list = **sab channels**; `12,44,90` = sirf wohi; `-12` = us channel par **nahi**.
- Panel card: **Ads (kisi bhi channel par)** — ON/OFF, links, channel ids.
- Public player endpoint: `GET /api/gw/ad?channel=12` → `{ ad: { prerollUrl, imageUrl, clickUrl, skipAfter } }`
  (asli stream URL kabhi nahi). 120s cache, 60/min per IP.
- Ye "config + player-side playback" hai. HLS ke andar ad **stitch** karna (intro → live sequence anchor)
  v45 ka kaam hai — neeche "Baqi".

---

## 7. Naye env (Vercel)

| Env | Kaam |
|---|---|
| `IPTV_GW_SECRET` | sealed stream tokens (v42 se) |
| `FIREBASE_SERVICE_ACCOUNT` | Firestore (lines, catalogue, tracking) |
| `GITHUB_ARCHIVE_TOKEN` | optional — GitHub archive push (repo scope) |
| `GITHUB_ARCHIVE_REPO` | optional — `owner/repo` (private) |
| `NEXT_PUBLIC_IPTV_SERVER` | optional — default `https://mizanora.vercel.app` |

---

## 8. Test

```
node scripts/test-v44.mjs      # 92 checks
```
Poori chain: `npm test` (v39…v44), `npm run check`, `npm run build:offline`.

---

## 9. Baqi (agla kaam — saaf list)

1. **Premium unlock + recharge animation** — abhi sirf plan/price aur JazzCash number mojood hain;
   animated "unlock" screen aur recharge receipts (video/CSS) v45 mein.
2. **HLS ad stitching** — ad ko stream ke andar daalna (abhi player overlay/config).
3. **EPG har channel ke liye** (`xmltv.php` abhi khali guide deta hai).
4. **Public movies/series pages** — poster grid + IMDb detail + "how to watch".
5. **10 lakh+ entries** — Firestore shards ~4.8 lakh tak theek hain; 10 lakh ke liye object storage
   (R2/S3) ya GitHub-hosted JSON + CDN chahiye.
6. **v41b billing engine** — auto 1–10 invoice, reminders, suspend, receipt.
