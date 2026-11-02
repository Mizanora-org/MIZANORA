# IPTV panel audit — Mizanora v46 (Nov 2026)

**Kaam:** Xtream/XUI.one level ke panels se compare kar ke dekha ke admin, reseller, customer aur
security ke hisab se kya missing hai — phir setup guide.

**Compare kis se:** XUI.one feature list, XUI.one vs Xtream UI comparison, reseller-panel feature
guides (restreamiptv, 5k5g, digiarcadia), IPTV panel security write-up (iemlabs), aur BarakatWave
(jo v43–v45 mein clone kar ke dekha gaya).

**Kaise check kiya:** repo ke asli code ko parh kar — har claim ke sath file ka naam.

---

## 1. Scorecard

| # | Cheez | Industry (XUI.one level) | Mizanora v46 | Halat |
|---|---|---|---|---|
| 1 | Xtream API (player_api, get.php, xmltv) | ✅ | ✅ `app/api/gw/player`, `playlist`, `epg` | ✅ |
| 2 | Stalker/MAG portal (MAC bound) | ✅ | ✅ `app/api/gw/portal` | ✅ |
| 3 | HLS/TS stream + sealed segments | ✅ | ✅ `handleStream.js`, `/api/gw/s` | ✅ |
| 4 | Real EPG import + auto slots | ✅ | ✅ `lib/gateway/epg.js` | ✅ |
| 5 | 7-din catch-up (timeshift) | ✅ | ✅ v46 `lib/iptvCatchup.js` | ✅ |
| 6 | Ads (in-stream, per channel) | 🟡 | ✅ v45 (6 h cooldown) | ✅ |
| 7 | Web player | 🟡 | ✅ `/iptv/player` | ✅ |
| 8 | Movies/series + metadata | ✅ | ✅ IMDb + library + detail pages | ✅ |
| 9 | Line create/renew/suspend/reset | ✅ | ✅ `api/admin/iptv/lines` | ✅ |
| 10 | Device limit (anti-share) | ✅ | 🟡 hash + 90 s window | 🟡 |
| 11 | Reseller credit + own price | ✅ | ✅ `lib/iptvReseller.js` | ✅ |
| 12 | Reseller panel (clients, renew, suspend) | ✅ | ✅ `/reseller` | ✅ |
| 13 | Client self-service | ✅ | ✅ `/account/iptv` | ✅ |
| 14 | **Billing engine (invoice 1–10, reminder, auto-suspend)** | ✅ | ❌ koi cron/invoice nahi | ❌ |
| 15 | **Audit log (admin actions)** | ✅ | ❌ sirf stream/ad events | ❌ |
| 16 | **Bouquets / package per client** | ✅ | ❌ sab channels sab ko | ❌ |
| 17 | **Bulk user tools** | ✅ | ❌ sirf channels bulk | ❌ |
| 18 | **Sub-reseller (master/reseller tree)** | ✅ | ❌ | ❌ |
| 19 | **Ticket system** | ✅ | ❌ WhatsApp par | ❌ |
| 20 | **Credit ledger screen** | ✅ | 🟡 `iptvPayments` hai, UI nahi | 🟡 |
| 21 | **Connection/IP history per line** | ✅ | 🟡 `iptvSessions` hai, per-line UI nahi | 🟡 |
| 22 | **Channel health check (dead link auto-off)** | ✅ | ❌ | ❌ |
| 23 | **Trial by reseller** | ✅ | ❌ sirf admin | ❌ |
| 24 | **M3U options / Enigma2 / txt export** | ✅ | 🟡 m3u_plus + MAC CSV | 🟡 |
| 25 | **On-demand mode / transcoding / load balancing** | ✅ | ❌ Vercel par mumkin nahi | ❌ (out of scope) |
| 26 | White-label domain | ✅ | 🟡 apna domain, reseller ka nahi | 🟡 |
| 27 | MFA / IP allowlist for admin | ✅ | ❌ | ❌ |
| 28 | Anti-share alerts / auto-ban | ✅ | ❌ | ❌ |
| 29 | Brute-force lockout per username | ✅ | ❌ (sirf per-IP, in-memory) | ❌ |
| 30 | Backup (catalogue → GitHub) | ✅ | ✅ `lib/iptvArchive.js` | ✅ |
| 31 | Status page (public) | 🟡 | ✅ `/iptv/status` | ✅ |
| 32 | Analytics dashboard | ✅ | ✅ `IptvStatsAdmin` | ✅ |

---

## 2. Admin — kya missing hai

### 2.1 Billing engine (sab se bara gap)
- Aaj: `lineState()` sirf **batata** hai ke line kis halat mein hai; koi khud invoice nahi banata,
  reminder nahi bhejta, suspend nahi karta.
- Chahiye: 1 tareekh ko invoice → 1–10 reminder (WhatsApp + email) → 11 ko warning → 12
  (`IPTV.suspendDay`) par auto-suspend → payment par receipt + line chalu.
- Vercel par cron mumkin hai (`vercel.json` ka `crons`), abhi `crons` nahi hai.

### 2.2 Bouquets / packages
- Aaj: `iptvLines` mein plan hai, magar channel-level control nahi. Client ko sirf Sports ya sirf
  Pakistani channels dena mumkin nahi.
- Chahiye: `channels[].groups` + line par `bouquet: ['sports','news']`, aur gateway catalogue ko
  line ke hisab se filter kare (`/player_api.php` + `/get.php` dono).

### 2.3 Bulk user tools
- Channels ke liye bulk hai (`{action:'bulk', ids, mode}`), lines ke liye nahi. 200 clients ke
  liye bulk extend/suspend/plan-change/password-reset zaroori hai.

### 2.4 Audit log
- `iptvEvents` mein sirf `stream_start`, `ad_start`, `timeshift_start` jate hain.
- Chahiye: `admin_action` (kis admin ne kis line par kya kiya), `reseller_action`, `login_fail`.
  Bina iske "kis ne ye line delete ki" ka jawab nahi milta.

### 2.5 Credit ledger
- `iptvPayments` (renewal, reseller_to_admin) likha jata hai magar koi screen nahi.
  Reseller ke credit add/deduct ka poora ledger + balance-running-total chahiye.

### 2.6 Connection history
- `iptvSessions/{username}` mein device hashes hain (90 s window), `IptvOpsAdmin` sirf live dikhata hai.
  Chahiye: per line "aaj kis IP/device se kitni dafa khula" + sharing alert.

### 2.7 Channel health
- Koi check nahi ke channel ki URL zinda hai ya nahi. 800 channels mein 100 dead hon to pata nahi chalta.
- Chahiye: cron par HEAD/GET (range 0-1) + `off` flag + admin ko report.

### 2.8 Chhoti cheezein
| Cheez | Halat |
|---|---|
| EPG per-channel time offset | ❌ (global mapping hai) |
| Channel drag-order / bouquet order | ❌ |
| Lines ka CSV export | 🟡 sirf MAC CSV |
| Enigma2 / `m3u with options` | ❌ |
| Per-line geo/IP lock | ❌ |
| Ad analytics (impressions, skip) | 🟡 events hain, screen nahi |
| Sub-reseller (master reseller) | ❌ |
| Ticket system | ❌ |

---

## 3. Reseller — kya missing hai

| Cheez | Halat | Note |
|---|---|---|
| Client banana + credentials | ✅ | `api/reseller` `createClient` |
| Renew / suspend / resume / cancel | ✅ | owner check bhi hai (`line.resellerId !== s.uid`) |
| Apni price (cap ke andar, naye clients par) | ✅ | `nextClientPrice` |
| Payment numbers set karna | ✅ | `setPayment` |
| WhatsApp message template | ✅ | `clientMessage()` |
| Trial line dena | ❌ | `plan === 'trial'` par "admin deta hai" |
| Collection board (1–10 kis ne diya) | 🟡 | `cycleState` hai, per-client tick + reminder list nahi |
| Credit low warning / top-up request | 🟡 | page par WhatsApp link, panel ke andar alert nahi |
| Client statement / receipt | ❌ | koi PDF/print nahi |
| Bulk client actions | ❌ | |
| Clients CSV export | ❌ | |
| Sub-reseller | ❌ | |
| Client ka live device count | 🟡 | maxDevices dikhta hai, live count admin-only |
| Apna white-label page | ❌ | Mizanora ka page hi |

---

## 4. Customer — kya missing hai

| Cheez | Halat |
|---|---|
| Login details, expiry, plan | ✅ `/account/iptv` |
| WhatsApp renew | ✅ |
| Device limit ki wazahat | ✅ |
| Library + detail pages | ✅ v46 |
| Guide / now-next / catch-up (apps) | ✅ |
| **Self-serve device logout** | ❌ (reseller se reset karwana parta hai) |
| **Invoice/receipt download** | ❌ |
| **Browser player mein catch-up scrubber** | ❌ (apps par hai) |
| **Email/WhatsApp expiry reminder** | ❌ (cron nahi) |

---

## 5. Security audit — asli findings (code ke sath)

### 🔴 1. Admin check ka pehla raasta `orders` par depend karta hai
`lib/adminAuth.js` pehle user ke token se
`GET /documents/orders?pageSize=1` maarta hai; 200 aaya to `ok: true` (admin).
- Aaj yeh **sirf is liye mehfooz hai** ke `firestore.rules` mein `orders` ka read
  `resource.data.uid == request.auth.uid` hai, is liye bina filter wali list reject ho jati hai.
- Jis din rules mein "signed-in user list kar sakta hai" (admin dashboard ke liye aam change) hoga,
  us din **har signed-in user admin ban jayega**.
- **Fix:** pehle `ADMIN_UID`/email check karo, ya `adminUsers/{uid}` doc par check karo. `orders`
  probe hata do.

### 🔴 2. `firestore.rules` mein placeholders
`PASTE_ADMIN_UID_HERE` / `PASTE_ADMIN_EMAIL_HERE@gmail.com` — agar publish se pehle replace nahi
kiye to `isAdmin()` kabhi true nahi hota; poora admin panel sirf server env (`ADMIN_UID` +
`FIREBASE_SERVICE_ACCOUNT`) par chalega. Dono jagah set karna zaroori hai.

### 🟠 3. `player_api.php` par per-username lockout nahi
`rateLimit()` in-memory hai (`lib/gateway/security.js`) — Vercel ke har instance par alag, aur
username-level counter nahi. 8-character password ke saath distributed brute force mumkin.
- **Fix:** `iptvLines` par `failCount` + `lockedUntil`; 10 fail par 15 min lock, aur `login_fail`
  event.

### 🟠 4. `x-forwarded-for` trust
`clientIp()` pehle `x-vercel-forwarded-for` dekhta hai (theek), magar local/other host par
`x-forwarded-for` spoof ho sakta hai — device limit us par nahi, IP hash par hai.
- **Fix:** sirf `x-vercel-forwarded-for` / `cf-connecting-ip` maano, warna `0.0.0.0`.

### 🟠 5. Admin panel par MFA / IP allowlist nahi
Firebase Auth MFA support karta hai, panel use nahi karta. Admin email ke sath Google account
compromise = poora panel.
- **Fix:** MFA on + (optional) admin routes par `ADMIN_IP_ALLOW` env check.

### 🟠 6. Admin actions ka audit trail nahi
Dekha upar 2.4. Compliance aur dispute dono ke liye zaroori.

### 🟡 7. Line password plaintext mein
Xtream protocol plaintext password maangta hai, is liye storage bhi plaintext hai (Firestore
at-rest encrypted). Owner aur uska reseller rules se parh sakte hain — yeh industry mein normal hai.
- **Mitigation:** panel mein password sirf "reveal" par dikhao, copy par log karo, sharing par
  rotate karo.

### 🟡 8. Trial abuse
`api/iptv/trial` sirf in-memory IP counter rakhta hai (1/hour), koi CAPTCHA nahi. Ek user VPN se
kai trials le sakta hai (cost: 0, magar device slots aur support load).
- **Fix:** phone/uid duplicate check + hCaptcha.

### 🟡 9. Sealed links (achhi cheez)
`/api/gw/s?t=` AES-GCM, 3 ghante TTL, `IPTV_GW_SECRET` ke baghair ephemeral — yeh XUI.one ke
"encrypted content" se behtar hai. Isay barqarar rakho; secret rotate karne par purane links
khud mar jate hain (expected).

### 🟡 10. Headers
`X-Frame-Options`, `nosniff`, `Referrer-Policy` set hain. **CSP nahi** hai — XSS surface kam
karne ke liye add karna behtar.

---

## 5b. v47 mein kya fix ho gaya (Nov 2026)

| Finding | Halat |
|---|---|
| 🔴 adminAuth ka `orders` probe | ✅ `productCosts` (sirf admin) + Admin SDK pehle |
| 🔴 rules ke placeholders | ✅ guide + audit mein warning (user ko publish karna hai) |
| 🟠 per-username lockout | ✅ 8 fail → 15 min (`iptvLockouts`) |
| 🟠 admin audit trail | ✅ `admin_action` events + panel list |
| 🟠 MFA / IP allowlist | 🟡 MFA docs mein, **IP allowlist ab blacklist/whitelist se** (`/admin/iptv → Access rules`) |
| 🟡 trial abuse | 🟡 IP limit hai; CAPTCHA abhi baqi |
| 🟡 CSP | ❌ baqi |
| Billing engine | ✅ cycle 1–10, invoice, reminder text, cron auto-suspend, panel |
| Bulk lines | ✅ suspend/resume/delete/extend/plan |
| Bouquets / health check / sub-reseller / tickets | ❌ v48 |

## 6. Roadmap (tajweez)

| Version | Kaam | Waqt |
|---|---|---|
| **v47** | Billing engine: cron, invoice 1 tareekh, reminder 1–10, auto-suspend 12, receipt, credit ledger UI, collection board | 2 hafte |
| **v47b** | Security: `verifyAdmin` fix, per-username lockout, `admin_action` audit, MFA/IP docs, CSP, trial CAPTCHA | 1 hafta |
| **v48** | Reseller power: trial line, sub-reseller, bulk clients, CSV, statement, low-credit alert, device logout | 2 hafte |
| **v48b** | Catalogue ops: bouquets, bulk lines, channel health cron, EPG offset, ad analytics | 2 hafte |
| **v49** | Scale: object storage/CDN, 1M items, Cloudflare relay (1000+ viewers) | 3–4 hafte |

---

## 7. Setup guide (naye deploy se le kar pehle client tak)

### Step 0 — accounts
Vercel, Firebase (Firestore + Auth), GitHub (archive), domain (optional), JazzCash number.

### Step 1 — Firebase
1. Project banao → **Authentication** → Google + Email/Password on.
2. Admin account banao (Google se sign-in ya email+password), **User UID** copy karo.
3. **Firestore** → production mode.
4. `firestore.rules` kholo → `PASTE_ADMIN_UID_HERE` aur `PASTE_ADMIN_EMAIL_HERE@gmail.com`
   replace karo → Console → Rules → paste → **Publish**. (Yeh step skip kiya to admin panel
   sirf env par chalega aur client pages par "rules" error aayega.)
5. **Project settings → Service accounts → Generate new private key** → JSON download.

### Step 2 — Vercel env
| Key | Value | Zaroori |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://mizanora.vercel.app` | ✅ |
| `NEXT_PUBLIC_FIREBASE_API_KEY` / `_PROJECT_ID` | Firebase console se | ✅ |
| `FIREBASE_SERVICE_ACCOUNT` | poora JSON (single line) | ✅ |
| `ADMIN_UID` | Step 1.2 ka UID | ✅ |
| `NEXT_PUBLIC_ADMIN_EMAIL` | admin email(s), comma se | ✅ |
| `IPTV_GW_SECRET` | 32+ random chars (`openssl rand -hex 32`) | ✅ |
| `NEXT_PUBLIC_IPTV_SERVER` | `https://mizanora.vercel.app` | ✅ |
| `GITHUB_ARCHIVE_TOKEN` + `GITHUB_ARCHIVE_REPO` | backup ke liye | 🟡 |
| `NEXT_IMAGE_OPTIMIZE` | `0` (default) | 🟡 |

Deploy → domain → `/admin` par sign in (agar "not_admin" aaye to UID/email check karo).

### Step 3 — pehla content
1. `/admin/iptv` → **Source** tab: agar upstream Xtream panel hai to host/user/pass daalein (optional).
2. **Channels** tab: M3U URL ya paste → import. Bade lists shards mein jate hain (800/shard).
3. **EPG** tab: XMLTV URL add → test → channels map. Asli guide na ho to gateway auto slots deta hai.
4. **Movies** tab: M3U (VOD) ya manual rows; IMDb metadata khud bharta hai.
5. **Ads** tab: channel par ad URL (HLS/MP4) ya banner.
6. **Tools** tab → archive/export: catalogue GitHub par backup.

### Step 4 — pehli line aur test
1. `/admin/iptv` → line banao (plan starter/family/premium, months).
2. Credentials TiviMate/Smarters mein: server `https://mizanora.vercel.app`, username, password.
3. Check: live chalta hai → EPG aati hai → `/iptv/player` par wohi login → `/iptv/movies` detail page.
4. Catch-up: archive wale channel par `tv_archive` dikhna chahiye; `/iptv/guide` par `7d` badge.

### Step 5 — reseller onboarding
1. Reseller `/iptv/reseller` par apply karta hai → `/admin/iptv` se approve (uid bind hota hai).
2. Credit do: Rs 100/line wholesale → reseller panel mein `credit`.
3. Reseller apni price set kare (Rs 100–200), payment numbers (JazzCash/Easypaisa/bank).
4. Client banao → credentials + WhatsApp message khud ban jata hai.
5. Client `/account/iptv` par apni line, expiry aur devices dekh sakta hai.

### Step 6 — paisa aur cycle
- Connection fee Rs 50 (Rs 20 admin + Rs 30 reseller), pehla mahina included.
- Monthly cap Rs 200, wholesale Rs 100, cycle **1–10**, `suspendDay 12`.
- JazzCash **0306-2015326** (`IPTV.support`).
- **Abhi automatic nahi**: reminder, invoice, auto-suspend — v47 mein cron ke sath aayega.
  Tab tak har 1 tareekh ko admin `iptvLines` ki expiry list dekhe aur reseller ko WhatsApp kare.

### Step 7 — rozana routine (15 minute)
1. `/admin/iptv` → trials approve, reseller apps approve.
2. Expiry list (7 din andar) → reminder WhatsApp.
3. `/api/admin/iptv/stats` / Overview → online users, plays, top channels.
4. `/admin/errors` → 5xx dekho.
5. Hafte mein ek dafa: archive backup + dead channel check (abhi manual, v48b mein auto).

### Step 8 — security checklist (deploy ke roz)
- [ ] `firestore.rules` publish, placeholders replace
- [ ] `ADMIN_UID` + `NEXT_PUBLIC_ADMIN_EMAIL` set
- [ ] Admin Google account par **2FA/MFA**
- [ ] Koi secret `NEXT_PUBLIC_*` mein nahi (sirf public keys)
- [ ] `IPTV_GW_SECRET` 32+ chars, kabhi kabhar rotate
- [ ] Panel login kisi ke sath share nahi
- [ ] Reseller ko sirf reseller panel, admin kabhi nahi
- [ ] Line sharing par: password reset + device limit check
- [ ] `x-vercel-forwarded-for` Vercel par hi deploy (self-host par proxy lagao)

### Step 9 — scale
- Aaj Vercel functions: ~100–300 concurrent viewers.
- 1000+ chahiye to Cloudflare relay / R2 + custom domain, aur `IPTV_GW_SECRET` ke sath
  signed URLs (v49).

---

## 8. Khulasa (6 line)

1. Streaming side (Xtream + Stalker + EPG + catch-up + ads + player) **industry level** hai.
2. Sab se bara gap **billing engine** hai — cron, invoice, reminder, auto-suspend.
3. Doosra gap **admin power tools**: bouquets, bulk lines, audit log, health check, ledger UI.
4. Reseller panel kaam karta hai magar **trial, sub-reseller, bulk, statement** missing hain.
5. Security: sealed links strong hain, magar **admin check ka `orders` probe**, per-username
   lockout, MFA aur audit log zaroori hain.
6. Agla logical kaam: **v47 billing + v47b security** (3 hafte), phir v48 reseller tools.
