# v42 — Streaming gateway, VPS ke baghair (Vercel par)

Sawal yeh tha: *"VPS nahi lena, channels M3U se set karne hain, backend link secure rahe, hack na ho sake."*
Jawab: **VPS ki zaroorat nahi** — BarakatWave jaisa model, magar Mizanora ke andar. Sab kuch Vercel ke serverless
functions par: Xtream panel ya M3U source **sirf server** ke paas, client ko **sealed (encrypted) links**.

---

## 1. Kaam kaise karta hai

```
TiviMate / Smarters / MAG
        │  server: mizanora.vercel.app   username/password: line ka
        ▼
/player_api.php ──► /api/gw/player     (login, categories, streams)
/get.php        ──► /api/gw/playlist   (poori M3U)
/xmltv.php      ──► /api/gw/epg        (EPG)
/live/u/p/12.m3u8 ► /api/gw/stream     (asli channel)
        │                                   │
        │                                   ▼
        │                        upstream panel / M3U  (SIRF server)
        ▼
playlist ke andar har piece: /api/gw/s?t=v1.xxxx   ← AES-256-GCM sealed, 3 ghante
```

Client kabhi yeh nahi dekhta: upstream host, upstream username, upstream password, asli stream URL.
Network tab mein sirf `mizanora.vercel.app/api/gw/s?t=v1.…` hota hai.

---

## 2. Source set karna (admin)

**Admin → IPTV → Channel source**

| Mode | Kya bharna hai |
|---|---|
| **Xtream panel** | host (`http://panel:8080`), username, password |
| **M3U link** | seedha playlist URL |

- **Test connection** → channels ki ginti, account ka status, 3 misaal
- **Save** → `siteMeta/iptvSource` (server-only, rules mein browser ke liye read band)
- **Clear** → gateway band

Pathar par likh lein: **source ki detail kabhi client ko nahi jati** — masla ho to admin panel hi jagah hai.

---

## 3. Security (hack-proof ka matlab)

| Cheez | Kaise |
|---|---|
| Upstream URL | AES-256-GCM sealed token; token ke baghair `/api/gw/s` 403 |
| Token ki miyaad | 3 ghante (playlist khud refresh hoti hai) |
| Tampering | GCM auth tag — aik bit badla to token mar jata hai |
| Line password | constant-time compare, 10s cache, suspend foran asar |
| Device limit | `iptvSessions/{username}` — 90s window, maxDevices se zyada = 403 |
| SSRF | har upstream fetch `fetchPublic()` se — private IP / localhost / metadata block |
| Rate limit | player 180/min, playlist 30/min, pieces 900/min, EPG 12/min (per IP) |
| Source doc | `siteMeta` public tha — ab `iptvSource` doc browser ke liye band |
| Sessions doc | `iptvSessions` browser ke liye band |
| Secrets | `IPTV_GW_SECRET` (Vercel env) — is ke baghair ephemeral key (deploy badalne par tokens mar jate hain) |

**Vercel env (zaroori):**
```
IPTV_GW_SECRET=<lamba random string>
```

---

## 4. Naye files

```
lib/gateway/security.js     seal/open (AES-GCM), device hash, rate limit, client ip
lib/gateway/sourceConfig.js cleanSource, sourceReady, apiBase, upstreamStreamUrl  (pure)
lib/gateway/source.js       cached source read (tag: iptv-source)
lib/gateway/catalogue.js    live channels (Xtream ya M3U), groups, 5-min cache
lib/gateway/lines.js        verifyLine + checkDevice (Firestore + memory fallback)
app/api/gw/player/route.js      player_api.php
app/api/gw/playlist/route.js    get.php
app/api/gw/stream/route.js      /live, /movie, /series
app/api/gw/s/route.js           sealed piece proxy
app/api/gw/epg/route.js         xmltv.php
app/api/gw/icon/route.js        channel logos (host bhi chhupa)
app/api/admin/iptv/source/route.js  save / test / clear
components/IptvSourceAdmin.js   admin card
scripts/test-v42.mjs            56 checks
```
Badle: `next.config.js` (7 rewrites), `components/AdminIptv.js`, `firestore.rules`.

---

## 5. Client ko kya dena hai

| App | Server | Login |
|---|---|---|
| TiviMate / Smarters / XCIPTV | `http://mizanora.vercel.app` ya `https://mizanora.vercel.app` | line ka username/password |
| M3U player | `https://mizanora.vercel.app/get.php?username=…&password=…&type=m3u_plus&output=ts` | — |
| EPG | `https://mizanora.vercel.app/xmltv.php?username=…&password=…` | — |

---

## 6. VPS ke baghair kya limits hain (seedhi baat)

| Cheez | Vercel par |
|---|---|
| 100–300 viewers | theek chalta hai (proxy bandwidth) |
| 1000+ viewers | mehnga — Vercel bandwidth bill barhta hai |
| HLS segments | function se guzarte hain (secure, magar bandwidth) |
| Long TS streams | `maxDuration = 60` — lambi connection kat sakti hai |
| Solution (baad mein) | Cloudflare Worker / R2 ya chhota relay VPS — code wohi rahega, sirf `/api/gw/s` ka base badlega |

Yani aaj **VPS ke baghair shuru** ho sakta hai; 300+ lines par bandwidth ka hisaab dobara dekhna hoga.

---

## 7. Jo abhi bhi baqi hai

- **Stalker portal** (`portal.php`, `server/load.php`) — MAG box wale clients (v43)
- **7-din catch-up** (tv_archive)
- **Auto billing** (1–10 cron, auto-suspend, receipts) — v41b
- **Movies/series ke apne pages** (poster, seasons) — catalogue pass-through hai, UI nahi

---

## 8. Test

```bash
node scripts/test-v42.mjs    # 56 checks: sealed tokens, tampering, expiry, source validation, routes, rewrites, rules
npm test
npm run check
npm run build:offline
```

Deploy ke baad:
1. `IPTV_GW_SECRET` set karein
2. `firestore.rules` publish karein
3. Admin → IPTV → source save + test
4. `/iptv/start` se key lein, TiviMate mein server `https://mizanora.vercel.app` daalein
