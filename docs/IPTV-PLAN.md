# MIZANORA IPTV — Tafseeli Plan (v39 se aage tak)

> **Kya hai yeh document:** poora plan — kya ban chuka, kya banana hai, kis tarteeb se, kitne waqt mein, kitna kharcha, kya risk. Har hissa aisa likha gaya hai ke usi ko follow kar ke kaam kiya ja sake.
>
> Aakhri update: 2026-11-02 · Branch `arena/ada20fa1-mizanora` · PR #18 · Code: **v39**

---

## 1. Aik nazar mein: kahan hain, kahan jana hai

| Phase | Naam | Kya nikalta hai | Halat |
|---|---|---|---|
| **v39** | Section + money + SEO | `/iptv` aur uske saare public pages, admin module, plans, trial, reseller, 5 blog guides, sitemap | ✅ **ban chuka** |
| **v40** | Reseller panel + reseller website | `/reseller` dashboard, apply form, admin approvals, credit, 4 naye guides | ✅ **ban chuka** |
| **v40b** | Gateway (Xtream + M3U) | asli streaming endpoints — `player_api.php`, `get.php`, `xmltv.php` | ⏳ agla |
| **v41** | Billing engine (auto 1–10) | 1–10 cycle khud chale: invoice, reminders, suspend, receipt | ⏳ |
| **v42** | Stalker/MAC + catch-up | `portal.php`, MAG box support, 7-din archive | ⏳ |
| **v43** | White-label apps | Android TV / Fire TV app, QR activation | optional |

**Aaj ki haqeeqat (saaf baat):** v39 mein line ka data, paisa, prices, pages aur UI sab mojood hai — magar **asli stream abhi Mizanora ke server se nahi nikalta**. Line banane par customer ko username/password milta hai, lekin usko chalane wala gateway v40 mein banta hai. Isi liye abhi lines **admin panel se manually** banti hain.

---

## 2. Maqsad aur kamyabi ka paimana (KPI)

**Business maqsad:** Pakistan mein IPTV ka kaam reseller ke haath se hota hai. Mizanora ko **wholesale** dena hai — source, servers, EPG, support sab Mizanora ka; bechna reseller ka.

| KPI | 3 mahine | 6 mahine | 12 mahine |
|---|---|---|---|
| Active lines | 100 | 400 | 1,200 |
| Resellers | 5 | 15 | 40 |
| MRR (Rs 100 × lines) | Rs 10,000 | Rs 40,000 | Rs 1,20,000 |
| Churn (mahana) | < 12% | < 8% | < 6% |
| Support reply time (WhatsApp) | < 30 min | < 20 min | < 15 min |
| Trial → paid conversion | 25% | 35% | 40% |

Yeh numbers plan ke liye hain, guarantee nahi. Line 1,200 par bandwidth aur gateway dono dobara naapne parenge (section 19).

---

## 3. Scope: andar kya, bahar kya

### Andar (yeh banega)
- Public section: `/iptv`, `/iptv/channels`, `/iptv/trial`, `/iptv/reseller`
- Customer area: `/account/iptv` — apni line, expiry, devices, invoice
- Admin: `/admin/iptv` — trials, lines, resellers, collection
- Streaming gateway: Xtream + M3U + XMLTV (phase v40)
- Stalker portal (phase v42)
- EPG pipeline + ads insertion
- Billing 1–10 cycle + WhatsApp reminders
- 5+ blog guides, sitemap/robots, schema markup

### Bahar (abhi nahi)
- Apna satellite / DTH license
- Payment gateway (JazzCash API) — filhal manual screenshot verification
- iOS/Android native app (web + TiviMate/Smarters kafi hai)
- Multi-language UI (sirf Roman Urdu + English technical labels)

---

## 4. Roles aur permissions

| Kaam | Client | Reseller | Admin |
|---|---|---|---|
| Plans dekhna, trial maangna | ✅ | ✅ | ✅ |
| Apni line dekhna | ✅ (sirf apni) | ✅ (apne clients ki) | ✅ (sab) |
| Line banana | ❌ | ✅ (apne credit tak) | ✅ |
| Line suspend / extend | ❌ | ✅ (apni) | ✅ |
| Price set karna | ❌ | ✅ (cap Rs 200 tak) | ✅ (wholesale) |
| Clients ki list | ❌ | ✅ | ✅ |
| Payment record karna | ❌ | ✅ (apne) | ✅ (sab) |
| Source / M3U URL dekhna | ❌ **kabhi nahi** | ❌ | ✅ |

**Ahem usool:** channel/movie ke asli source links **kabhi** browser tak nahi jate. Client ko sirf apna username, password aur `http://<server>:8080` milta hai. Tafseel section 15 mein.

---

## 5. Paisa: poora hisaab (yahan koi ambiguity nahi)

### 5.1 Bunyadi numbers

| Cheez | Kitna | Kisko jaata hai |
|---|---|---|
| Connection fee (aik dafa) | **Rs 50** | Rs 20 admin + Rs 30 reseller |
| Pehla mahina | **Rs 50 ke andar** | qayamat tak — alag charge nahi |
| Renewal, doosre mahine se | **Rs 200 cap** | client → reseller |
| Wholesale (per line, per month) | **Rs 100** | reseller → admin |
| Trial | **free 24 ghante** | — |
| Late fee | **nahi** | — |
| Reconnection (suspend ke baad) | Rs 50 (naya connection samjhein) | 20 / 30 |

### 5.2 Reseller ka munafa (per client, per month)

```
Client deta hai        Rs 200
Mizanora leta hai      Rs 100
--------------------------------
Reseller ke paas       Rs 100  (50%)
```

Pehle mahine:
```
Client deta hai        Rs 50  (+Rs 0 mahina)
Mizanora leta hai      Rs 20
Reseller ke paas       Rs 30
```

### 5.3 Kaam ke misalein (edge cases — yahan ghalti nahi honi chahiye)

| Surat | Hisaab | Nateeja |
|---|---|---|
| Client 3 mahine ka plan leta hai, Rs 550 | 3 × Rs 200 = Rs 600 se kam | 550 – 300 (3×100) = **reseller Rs 250** |
| Client 12 mahine, Rs 1,900 | 1,900 – 1,200 | **reseller Rs 700** |
| Reseller Rs 150 charge karta hai (cap ke andar) | 150 – 100 | **Rs 50/mahina** — uski marzi, cap Rs 200 hai |
| Reseller Rs 250 charge karna chahta hai | cap se upar | **mana** — system 200 par cap karega |
| Client 5 tareekh ko join hua | us mahine poora | agla invoice **1st** ko, koi proration nahi |
| Client 20 tareekh ko suspend hua | — | woh mahina **poora** count, koi refund nahi |
| Client ne 2 devices wala plan liya (Family Rs 350) | 350 – (2 × 100) = 150 | **reseller Rs 150** — per **connection**, per device |
| Reseller apna price badalta hai | sirf **naye** clients par | purane clients purane rate par chalte rahenge |
| Trial client paid ban gaya | naya connection fee | Rs 50 + mahina |

**Tijarati usool:** reseller ka purana client hamesha purane rate par. Price change ka matlab naye client. Isi liye har line par `rateLocked` field hai.

---

## 6. Collection cycle: 1 se 12 tareekh (din ba din)

| Din | Kya hota hai | Kaun karta hai | Message |
|---|---|---|---|
| **1** | Har active line + reseller ki invoice banti hai | system | "Mahina shuru — aap ka Rs ___ due, JazzCash **0306-2015326**" |
| **2–3** | Jinho ne pay nahi kiya, unko reminder | system | soft reminder |
| **5** | Doosra reminder, screenshot maanga jata hai | system | "Payment ka screenshot bhej dein" |
| **7** | Aakhri reminder | system | "9 tareekh tak na hua to line band ho jayegi" |
| **9** | Warning | system | "Kal aakhri din hai" |
| **10** | **Aakhri din** (window band) | system | "Aaj raat 12 baje tak" |
| **11** | Admin review — kya kisi ki payment phansi hui? | admin | — |
| **12** | Auto-suspend (line band, data mehfooz) | system | "Line suspend — Rs ___ bhej kar foran chalu" |
| **13–15** | Grace follow-up, reactivation on payment | admin/reseller | "Payment mila, line chalu" |
| **28** | Next cycle ki taiyari, reseller ki collection ka hisaab | admin | — |

**Paisa kis ko:** client apne **reseller** ko deta hai (reseller apna JazzCash/Easypaisa/bank chunta hai). Reseller **Mizanora** ko 1–10 ke darmiyan deta hai — JazzCash **0306-2015326**. Admin `paidThisCycle` update karta hai (phase v41 mein khud).

**Screenshot rule:** client/ reseller screenshot WhatsApp par bhejta hai → admin panel se "paid" mark. Sirf screenshot par bharosa nahi — JazzCash statement se milaya jata hai (section 21, risk R6).

---

## 7. Surfaces: kaun sa page kis kaam ka

| Route | Kaun dekhta hai | Content | Halat |
|---|---|---|---|
| `/iptv` | sab (SEO entry) | hero + stats, plans, features, kaise shuru, channels teaser, calculator, FAQ, guides | ✅ |
| `/iptv/channels` | sab | Live TV config se group-wise channel list, `/live/<slug>` par jaati hai | ✅ |
| `/iptv/trial` | sab | 24h trial form (naam, phone, shehr, device) | ✅ |
| `/iptv/reseller` | resellers | Rs 30/Rs 100 ka hisaab, kamai calculator, rules, apply CTA | ✅ |
| `/account/iptv` | login user | apni line, expiry, devices, renew CTA (noindex) | ✅ |
| `/admin/iptv` | admin | trials (approve), lines (extend/suspend), reseller collection | ✅ |
| `/iptv/setup` | client | device-wise setup guide (TiviMate, Smarters, MAG) | ⏳ v40 |
| `/iptv/status` | sab | gateway uptime / incident page | ⏳ v41 |

**Design rule:** koi naya design language nahi — `card`, `btn-gold`, `btn-ghost`, `section-title`, `font-display`, `border-line`, `bg-raised`, `text-gold/dim/faint` wohi store ke. IPTV section store ka hissa lagta hai, alag product nahi.

---

## 8. Architecture (kya kahan chalega)

```
                 ┌─────────────────────────────┐
   Browser ────► │  mizanora.vercel.app        │
   (client,      │  Next.js 15 (App Router)    │
    reseller,    │  /iptv, /account, /admin    │
    admin)       │  /api/iptv/*, /api/admin/*  │
                 └──────────┬──────────────────┘
                            │ Firestore (lines, trials, invoices)
                            ▼
                 ┌─────────────────────────────┐
   TiviMate  ───►│  GATEWAY (VPS + nginx)      │  ◄── v40
   Smarters      │  api.mizanora.tv            │
   MAG box       │  player_api.php, get.php    │
   VLC           │  xmltv.php, portal.php      │
                 └──────┬───────────┬──────────┘
                        │           │
                   ┌────▼───┐  ┌────▼─────────┐
                   │ Redis  │  │ M3U sources  │
                   │ concur │  │ + EPG feeds  │
                   └────────┘  └──────────────┘
```

**Kyun gateway alag?**
1. Vercel par long-lived streams chalane ka model nahi (aur bandwidth billing tabah kar degi).
2. VPS par nginx `X-Accel-Redirect` / 302 se seedha upstream bhej sakte hain — CPU bachta hai.
3. Concurrency (aik account, kitni screens) Redis se control hoti hai; serverless par rate-limit bikhri hui hoti hai.
4. DDoS/IP block/CDN edge sab VPS par aasan.

**Kyun Firestore?** Store pehle se isi par hai; rules ek hi jagah; admin panel `firebase-admin` se likhta hai. 1,200 lines par koi masla nahi (aik doc = aik line).

---

## 9. v40 — Gateway ki tafseel (sab se bara kaam)

### 9.1 Endpoints

| Endpoint | Protocol | Kaam |
|---|---|---|
| `GET /get.php?username=X&password=Y&type=m3u_plus&output=ts` | M3U | poori playlist (channels + VOD) |
| `GET /player_api.php?username=X&password=Y` | Xtream | account info (status, expiry, max_connections) |
| `GET /player_api.php?...&action=get_live_categories` | Xtream | groups |
| `GET /player_api.php?...&action=get_live_streams&category_id=5` | Xtream | channel list |
| `GET /player_api.php?...&action=get_vod_streams` | Xtream | movies |
| `GET /player_api.php?...&action=get_series` | Xtream | series |
| `GET /player_api.php?...&action=get_short_epg&stream_id=12&limit=10` | Xtream | EPG (app ke andar) |
| `GET /live/<user>/<pass>/<stream_id>.m3u8` | HLS | asli stream (302 → edge) |
| `GET /xmltv.php?username=X&password=Y` | XMLTV | 7-din EPG, gzip |
| `GET /portal.php` + `POST /server/load.php` | Stalker | v42 mein |

### 9.2 Auth flow (har request)

```
1. username/password  → Firestore lookup (line)
2. line.status == 'active'?  warna 403 {"user_info":{"auth":0}}
3. expiresAt > now?          warna 403 (message: renew)
4. Redis: SETNX conc:<user>:<ip> TTL 90s
   agar line.maxDevices se zyada → 403 "too many connections"
5. playlist/stream banao (ya cache se do)
```

Kuch bhi **na** ho to jawab bilkul wohi shape mein ho jo Xtream apps samajhte hain — warna app "invalid login" par atak jati hai aur client support par aa jata hai.

### 9.3 Stream delivery

- **302 redirect** edge/CDN par (default) — VPS par bandwidth nahi lagti
- **Proxy** sirf tab jab upstream signed URL public na ho
- HLS segments 4–6s, `#EXT-X-TARGETDURATION` sahi, audio alag track agar ho
- MPEG-TS option (`output=ts`) purane MAG/VLC ke liye

### 9.4 Concurrency + anti-sharing

| Cheez | Kaise |
|---|---|
| Same account, 2 jagah | Redis key per device-ip, 90s TTL, maxDevices se compare |
| Line share ho rahi hai | 3 alag /24 subnets 10 minute mein → flag + WhatsApp alert |
| ISP block | per-ISP alternate edge domains |
| User-agent ban | playlist sirf Xtream/M3U player UAs ko (browser ko "use the app" page) |

### 9.5 Catalogue

Channels abhi **Live TV config** (v38 shards) mein hain — wohi single source rahega. Gateway usi list ko padhta hai, is liye `/live` aur IPTV mein kabhi farq nahi aayega. Naya collection nahi banana.

---

## 10. Device / protocol matrix

| Device | Best tarika | Protocol | EPG |
|---|---|---|---|
| Android TV / Fire Stick | TiviMate ya Smarters | Xtream | ✅ app ke andar |
| Samsung / LG Smart TV | Smart IPTV / Set IPTV | M3U + XMLTV URL | ✅ |
| iPhone / iPad | GSE Smart IPTV | Xtream | ✅ |
| Windows / Mac | VLC, Kodi (PVR IPTV Simple) | M3U + XMLTV | ✅ |
| MAG 250/254, STB emu | Portal URL + MAC | Stalker | ✅ v42 |
| Purana LED TV (koi app nahi) | Android box | — | — |

**Support rule:** jo device list mein nahi, usko line mat becho — warna support khatam nahi hoga.

---

## 11. EPG pipeline (har channel, 7 din)

```
sources (XMLTV URLs, admin-managed)
   │  har 6 ghante fetch (gzip)
   ▼
parser → { tvg_id, channel_name, programmes[] }
   │  match: 1) tvg-id exact  2) channel name normalised  3) manual map
   ▼
merged DB (per tvg_id, 7 din aage)
   │
   ├── /xmltv.php → gzip, ~2–6 MB
   └── /player_api.php?action=get_short_epg → app ke andar
```

Rules:
- **Koi channel EPG ke baghair nahi** — jis channel ka source na mile, uska `tvg-id` admin panel mein manual map hoga; list mein "EPG missing" badge dikhega.
- Offset support (`+05:00` Pakistan) warna programme 5 ghante shift.
- Merge priority: admin drag order (upstream source jeetta hai).
- Cache: merged XMLTV 15 minute cache, per-user nahi.

---

## 12. Ads (kisi bhi channel par)

| State | Kab | Kaun set karta hai |
|---|---|---|
| Pre-roll | stream shuru hone se pehle | admin settings |
| Mid-roll (interval) | har N minute | admin, per channel group |
| Pause image | jab player buffer kare | automatic |
| Standby / offline | source down | automatic + WhatsApp alert |

- Ads admin > Ads se aate hain (store ke mojood products — naam, photo, price live Firestore se, is liye price kabhi galat nahi).
- **Premium line** par ads band (`ads: false`).
- Frequency cap: aik user ko aik ad 20 minute mein aik dafa.
- Ad click → `/product/<slug>?utm=iptv` — conversion track hota hai.

---

## 13. Data model (Firestore)

### Ab (v39, maujood)
```
iptvTrials/{id}      name, phone, city, device, plan, status, ip, createdAt
iptvLines/{id}       uid, username, password, mac, server, plan, maxDevices,
                     resellerName, resellerPhone, expiresAt, trial, status,
                     rateLocked, ads
iptvResellers/{id}   name, phone, connections, paidThisCycle, priceToClient
```

### Aage (v40–v41)
```
iptvInvoices/{id}    lineId, uid, resellerId, month:"2026-11", amount, due, status,
                     issuedAt, paidAt, method, proofUrl
iptvPayments/{id}    resellerId, amount, method, ref, proofUrl, month, verifiedBy
iptvEpgSources/{id}  url, name, priority, lastFetch, ok, channelCount
iptvStreams/{id}     channelSlug, edge, health, lastCheck
iptvEvents/{id}      type(login|play|suspend|renew), lineId, ip, ua, ts   // abuse + support
```

### Indexes
- `iptvLines`: `uid ASC, expiresAt DESC`
- `iptvInvoices`: `month ASC, status ASC`
- `iptvEvents`: `lineId ASC, ts DESC`

### Rules (maujood)
- `iptvTrials`: browser se read/write **band**, sirf server
- `iptvLines`: owner apni padh sakta hai (`uid == auth.uid`), likhna admin
- `iptvResellers`: sirf admin

---

## 14. API contracts

### Maujood
```
POST /api/iptv/trial
  { name, phone, city, device, plan }
  → 200 { ok:true }
  → 400 { ok:false, error }         // validation (Roman Urdu message)
  → 503 { ok:false, error }         // Firestore off → WhatsApp fallback

POST /api/admin/iptv   (Authorization: Bearer <firebase idToken>)
  { action:'list' }                 → { kpis, trials, lines, collection }
  { action:'approve', id }          → trial → 24h line
  { action:'extend', id, days }     → expiry + N din
  { action:'suspend', id }          → status suspended
```

### Aage
```
POST /api/iptv/renew        { lineId, months }    → invoice + WhatsApp link
POST /api/admin/iptv        { action:'createLine', uid|phone, plan, months }
POST /api/admin/iptv        { action:'markPaid', resellerId, amount, ref }
GET  /api/gw/health                                → edge status (uptime page)
```

Har mutation: audit entry `iptvEvents` mein (kaun, kab, kya) — support ke waqt zindagi bacha ti hai.

---

## 15. Security (ghair-muqarrar rules)

| Cheez | Rule |
|---|---|
| Source M3U / upstream URLs | sirf server env + Firestore admin-only; client bundle mein **kabhi nahi** |
| Stream links | 60s signed token, per IP + UA |
| Passwords | random 10 char, line create par bante hain; admin ko dikhte hain, client ko WhatsApp |
| API keys | `FIREBASE_SERVICE_ACCOUNT`, `GW_SECRET`, `CRON_SECRET` — Vercel env, repo mein nahi |
| Admin API | Firebase ID token + admin email/uid check (`verifyAdmin`) |
| Rate limit | trial form: 3/IP/24h; login: 10/min/IP |
| Ban / abuse | 3 subnets rule, reconnect storm, UA spoof → auto suspend + alert |
| Rules publish | har deploy ke baad `firestore.rules` dobara (warna naye collections band) |

---

## 16. SEO + content

**Ban chuka:** 5 guides (guide, Xtream/TiviMate, Stalker/MAC, reseller hisaab, channels/qanoon) + 4 IPTV URLs sitemap mein + Product/Offer, FAQPage, BreadcrumbList JSON-LD.

**Agla content (10 titles):**
1. TiviMate par playlist kaise add karein (screenshots ke saath)
2. Smart TV (Samsung/LG) par IPTV — 3 tareeqe
3. IPTV buffer ho raha hai? 7 cheezein check karein
4. Fire Stick par Mizanora IPTV — step by step
5. IPTV vs cable: 2026 ka kharcha
6. Family plan: 2 screens ka hisaab
7. Reseller ke liye WhatsApp scripts (copy-paste)
8. Cricket season: kaun sa plan aur kitni speed
9. IPTV ke liye internet speed calculator (tool page)
10. "Mera IPTV band kyun hua" — 5 asli wajuhat

Har post se `/iptv#plans` aur relevant guide par internal link. Target: 1 post / hafta.

---

## 17. Notifications (WhatsApp)

| Trigger | Kis ko | Template (chhota) |
|---|---|---|
| Trial request | client | "Trial request mil gayi — 24 ghante mein line" |
| Trial approved | client | "Aap ki trial line ready: user/pass" |
| Expiry 3 din pehle | client + reseller | "3 din baqi" |
| Invoice (1st) | reseller | "Is mahine Rs ___ due" |
| Day 7 warning | client | "9 tareekh tak payment" |
| Suspended (12th) | client | "Line band — Rs ___ bhejein" |
| Reactivated | client | "Line chalu, shukriya" |
| Source down | admin | "Channel X 5 min se down" |

Number: **0306-2015326** (Mizanora). Reseller apna number khud manage karta hai.

---

## 18. Analytics (kya naapna hai)

- `trial_request`, `trial_approved`, `plan_view`, `plan_click`
- `line_created`, `line_renewed`, `line_suspended`, `line_expired`
- `stream_start`, `stream_error`, `buffer_event` (gateway se)
- `reseller_apply`, `invoice_paid` (amount, method)
- Dashboard: MRR, active lines, churn, collection %, top resellers

Bina in events ke pata nahi chalega ke paisa kahan se aa raha hai aur kahan se ja raha hai.

---

## 19. Infra aur kharcha (kaam ka hisaab)

### Bandwidth (1 client HD ≈ 3 Mbps, peak concurrency 40%)

| Lines | Concurrent | Peak | Mahana data (approx) |
|---|---|---|---|
| 100 | 40 | 120 Mbps | ~19 TB |
| 400 | 160 | 480 Mbps | ~78 TB |
| 1,200 | 480 | 1.4 Gbps | ~235 TB |

### Kharcha (mahnay ka, USD)

| Cheez | 100 lines | 400 lines | 1,200 lines |
|---|---|---|---|
| VPS gateway (4 vCPU/8 GB) | $25 | $60 | $160 |
| CDN/bandwidth | $20 | $60 | $200 |
| Firestore + Vercel | $0–10 | $10–20 | $30–60 |
| EPG + monitoring | $5 | $10 | $25 |
| **Total** | **~$55** | **~$140** | **~$445** |
| Revenue (Rs 100/line) | Rs 10,000 (~$36) | Rs 40,000 (~$143) | Rs 1,20,000 (~$430) |

**Nateeja:** 100 lines par infra revenue ke barabar hai — yani **400 lines se pehle yeh business khud ko sambhalta nahi**. Isi liye reseller-first rollout (section 23) zaroori hai, apna retail push nahi.

> Dollar rate assume ~Rs 278. Numbers planning ke liye hain; har mahine actuals se milaein.

---

## 20. Timeline: hafta ba hafta (aik developer)

| Hafta | Kaam | Deliverable | Exit criteria |
|---|---|---|---|
| **W1** | Gateway skeleton: nginx + VPS + `/get.php` + `/player_api.php` auth | TiviMate par login chal jaye | account info sahi, ghalat password 403 |
| **W2** | Playlist generation (live categories + streams), Redis concurrency | poori channel list app mein | 1 line, 2 device = doosra block |
| **W3** | Stream delivery: HLS/TS, 302 edges, health check | asli channel chalna | 30 min non-stop, < 2s start |
| **W4** | EPG pipeline + `/xmltv.php` + short EPG | guide app mein | 90% channels par 7 din data |
| **W5** | Billing engine: invoices, cycle 1/3/5/7/9/10/12, WhatsApp | auto suspend/renew | test line 12 tareekh par khud band |
| **W6** | Admin v2: create line, mark paid, bulk, export, audit | admin sab kuch kar sake | 20 lines 5 minute mein ban jayein |
| **W7** | Stalker portal (`portal.php`, `server/load.php`) + MAC whitelist | MAG box chal jaye | MAG 254 par channel + EPG |
| **W8** | Hardening: rate limits, abuse flags, monitoring, `/iptv/status`, load test | soft launch ready | 50 concurrent, 0 crash |

**Total: 8 hafte** (agar sirf Xtream+M3U chahiye to **6 hafte** — W7 nikal dein). VOD/series (movies) alag 1–2 hafte.

**Effort split:** gateway 45%, billing 15%, EPG 12%, Stalker 10%, admin 10%, testing/hardening 8%.

---

## 21. Risks aur unka toD

| # | Risk | Asar | Rok-thaam |
|---|---|---|---|
| R1 | **PTA block / source band** | lines ek raat mein band | multiple edges, per-ISP domains, source redundancy, status page |
| R2 | Upstream source mar jaye | channels kam | 2+ source per group, auto health check, admin alert |
| R3 | Sharing (1 line, 10 ghar) | bandwidth + revenue loss | concurrency + subnet detection (9.4) |
| R4 | Vercel/Firestore par stream | budget tabah | streaming kabhi Vercel se nahi (8) |
| R5 | Firestore rules publish nahi hue | account page khali, trial save na ho | deploy checklist, `npm test` v39 check |
| R6 | Fake payment screenshot | revenue loss | JazzCash statement reconciliation, sirf admin mark kare |
| R7 | Reseller cap se zyada charge kare | client shikayat, brand kharab | UI mein cap, public price list, report button |
| R8 | IPTV apps ka protocol badal jaye | clients atak jayein | protocol matrix test har release |
| R9 | Ek banda support sambhal na sake | churn | WhatsApp templates + FAQ + `/iptv/setup` page |
| R10 | Copyright complaint | legal | sirf FTA/authorised feeds, DMCA email ready, source log |
| R11 | Bandwidth spike (cricket final) | buffer | CDN burst capacity, per-line bitrate cap |
| R12 | Admin panel ghalat line delete kare | data loss | soft delete + audit log + daily export |

---

## 22. Test aur acceptance (har phase)

**v39 (ban chuka):** `npm test` → v39 **62/62**, `npm run check` → **424 files, 0 problems**, `npm run build:offline` → build + prerender ok, 8 IPTV routes live par 200.

**v40 acceptance (gateway):**
- [ ] TiviMate, Smarters, VLC, GSE — chaaron par login
- [ ] Ghalat password / expired line / suspended line — sahi error shape
- [ ] 2 device limit actually rokta hai
- [ ] 30 min stream, 0 drop (3 alag ISP)
- [ ] `/xmltv.php` gzip, 7 din, 90%+ channels
- [ ] Playlist 10,000+ entries, 3s se kam generation
- [ ] 50 concurrent load test, CPU < 70%

**v41 acceptance (billing):**
- [ ] 1 tareekh invoice bane, 12 tareekh suspend
- [ ] Payment mark → line foran chalu
- [ ] Reseller ka collection % admin mein sahi
- [ ] Purana rate lock rehta hai jab reseller price badle

---

## 23. Rollout (kis tarteeb se market karna hai)

**Stage 1 — bandh darwaza (hafte 1–2):** 10 lines, sirf 2 trusted resellers, muft. Maqsad: gateway + EPG ki asli testing. Koi paisa nahi.

**Stage 2 — soft launch (hafte 3–4):** 50 lines, 5 resellers. WhatsApp group, `/iptv` live. Trial se paid conversion naapein.

**Stage 3 — public (hafte 5+):** SEO posts, sitemap, reseller page public. 400 lines tak infra sambhal leta hai (19).

**Pricing announcement:** Rs 50 connection (pehla mahina included) + Rs 200/mahina — isi ko har jagah dohrayein. Reseller ke liye: Rs 30 + Rs 100/line.

---

## 24. Faisle jo aap ke hain (jawab chahiye)

1. **Naam:** "Mizanora IPTV" final hai? (domain: `iptv.mizanora.app` ya `api.mizanora.tv`?)
2. **Trial:** request → admin approve (abhi yahi hai) ya auto-line?
3. **Zubaan:** Roman Urdu hi rahe ya English version bhi?
4. **Gateway kahan:** apna VPS (kharcha + control) ya kisi panel reseller se wholesale (tez, magar dependent)?
5. **VOD (movies/series):** v40 mein shamil karein ya alag phase?

In 5 jawabon ke baghair v40 ka scope lock nahi ho sakta.

---

## 25. File map (dev ke liye)

```
lib/iptv.js                     prices, plans, validation — single source
components/IptvPlans.js         plan cards
components/IptvTrialForm.js     trial form
components/IptvResellerCalc.js  kamai calculator
components/AccountIptv.js       customer line view
components/AdminIptv.js         admin module
app/api/iptv/trial/route.js     public trial intake
app/api/admin/iptv/route.js     admin actions
app/iptv/**                     4 public pages
app/account/iptv/page.js        customer page (noindex)
app/admin/iptv/page.js          admin page
content/blog/*iptv*             5 guides
firestore.rules                 iptvTrials / iptvLines / iptvResellers
scripts/test-v39.mjs            62 checks
UPGRADE-v39.md                  v39 release notes
docs/IPTV-PLAN.md               yeh document
```

**Commands:**
```bash
npm ci
npm test               # saare suites + v39 (62)
npm run check          # module graph + typecheck
npm run build:offline  # production build
```

---

## 26. Khulasa (agar sirf 6 line parhein)

1. **v39 ban chuka** — section, paisa, pages, admin, SEO, 5 guides. Live preview ready.
2. **Asli streaming abhi nahi** — woh **v40 gateway** (Xtream + M3U + XMLTV) hai, 6 hafte.
3. **Billing engine v41** — 1–10 cycle khud chalega, 2 hafte.
4. **Stalker/MAC v42** — MAG box wale clients, 1–2 hafte.
5. **400 lines se pehle business khud ko sambhalta nahi** — reseller-first rollout.
6. Aap ke 5 faisle (section 24) — phir v40 shuru.
