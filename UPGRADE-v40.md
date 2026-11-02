# v40 — Reseller panel + reseller website

v39 ne IPTV section banaya tha. **v40 us section ko reseller ke qabil banata hai** — reseller apni website par apply karta hai, approve hone ke baad apna panel kholta hai, clients banata hai, credentials WhatsApp par bhejta hai, aur apni kamai dekhta hai.

---

## 1. Naya kya hai

| Hissa | Route / file | Kya karta hai |
|---|---|---|
| **Reseller apply** | `/iptv/reseller` → `#apply` | naam, phone, shehr, CNIC (optional), experience → `iptvResellerApps` |
| **Reseller panel** | `/reseller` *(noindex)* | clients, lines, kamai, credit, price, payment numbers |
| Reseller API | `POST /api/reseller` | `me`, `createClient`, `renew`, `suspend`, `resume`, `cancel`, `setPrice`, `setPayment`, `setMac` |
| Apply API | `POST /api/reseller/apply` | validation + 3/IP/24h rate limit + WhatsApp fallback |
| Admin approvals | `/admin/iptv` | applications (approve/reject), resellers table (`+10 credit`, `Paid`) |
| Admin actions | `POST /api/admin/iptv` | `approveReseller`, `rejectReseller`, `addCredit`, `markPaid`, `createLine` |
| 4 naye guides | `content/blog/` | TiviMate setup, Smart TV setup, buffering fix, reseller panel guide |

Ab **total 9 IPTV blog guides** hain (v39 ke 5 + 4 naye).

---

## 2. Reseller ka workflow (jaisa asal mein chalta hai)

```
1. /iptv/reseller par form bharta hai          → iptvResellerApps (status: new)
2. admin approve karta hai (default 10 credit) → iptvResellers/{uid} (status: approved)
3. /reseller par sign in                       → dashboard
4. "Naya client" form                          → iptvLines (resellerId = uid, price locked)
5. Credentials screen                          → message copy / WhatsApp send
6. Har mahine: +1m (renew), Ban (suspend), Play (resume)
7. Mizanora ko 1–10 tak Rs 100/line            → admin "Paid" dabata hai
```

---

## 3. Naye files

```
lib/iptvReseller.js            price cap, credit, month maths, credentials, stats, cycle (pure)
lib/resellerAuth.js            verifyReseller — uid + status approved
app/api/reseller/route.js      panel API (har action owner check karta hai)
app/api/reseller/apply/route.js  public application
app/reseller/page.js           panel page (noindex)
components/ResellerPanel.js    dashboard: KPIs, new client, clients table, settings
components/ResellerApply.js    public apply form
scripts/test-v40.mjs           90 checks
UPGRADE-v40.md                 yeh file
```

Badle hue files: `app/api/admin/iptv/route.js`, `components/AdminIptv.js`, `app/iptv/reseller/page.js`, `components/Footer.js`, `app/robots.js`, `firestore.rules`.

---

## 4. Paisa (badla nahi — bas ab system lagata hai)

| Cheez | Kitna | Split |
|---|---|---|
| Connection fee | Rs 50 | Rs 30 reseller / Rs 20 admin |
| Client ka monthly | Rs 100 – **Rs 200 cap** | Rs 100 wholesale / Rs 100 margin |
| 3 mahine (Rs 350 package) | client se Rs 200 × 3 = 600 | reseller margin Rs 300 |
| Trial | free 24h | — |

**Cap ka enforcement:** form mein `max={200}` + `clientPrice()` server par bhi clamp karta hai. Browser se 500 bhejne par bhi line 200 par banti hai (test: `client: plan price is capped at 200`).

**Rate lock:** line par `price` aur `locked: true` likha jata hai. Reseller apni default price badle to **naye** clients par lagti hai — purani lines apne rate par chalti hain (client ko overcharge nahi hota).

---

## 5. Firestore

Naye/saaf collections:

```
iptvResellerApps/{id}  { name, phone, whatsapp, city, cnic, experience, note, uid, ip, status, createdAt }
iptvPayments/{id}      { resellerId, lineId?, months?, amount, wholesale?, kind, at }
iptvEvents/{id}        { type:'line_created', lineId, resellerId, at }
```

`iptvLines` mein naye fields: `resellerId`, `clientName`, `price`, `locked`, `months`, `paidThisCycle`, `lastPaymentAt`.

Rules:
- `iptvLines` — client apni (`uid`), reseller apni (`resellerId`), likhna sirf admin/server
- `iptvResellerApps` — browser se kuch nahi (`allow read, write: if false`)

> **Deploy ke baad `firestore.rules` dobara publish karein**, warna reseller apni lines browser se nahi padh sakega (panel phir bhi API se chalta hai, magar rules sahi hone chahiye).

---

## 6. Panel ke features (exact behaviour)

| Button / field | Kya hota hai |
|---|---|
| **Line banayein** | credit check → credentials (`mz######` + 8 char) → `iptvLines` doc → signature card |
| **Poora message copy** | server + username + password + plan + recharge — tayyar WhatsApp text |
| **WhatsApp par bhejein** | `wa.me/92<client number>?text=...` |
| **+1m** | expiry + 1 calendar month (31 Jan → 28 Feb, 3 March nahi) |
| **Ban** | `status: suspended` — data mitta nahi |
| **Play** | `status: active` (expiry guzri ho to pehle renew ka error) |
| **Price save** | `iptvResellers.price` update — sirf naye clients |
| **Payment save** | JazzCash / Easypaisa / Bank / account name |
| Credit **+10** (admin) | `credit` barhta hai |
| **Paid** (admin) | `paidThisCycle += Rs 100 × active lines` |

---

## 7. Security

- Panel ka har action `verifyReseller` se guzarta hai (Firebase ID token → `iptvResellers/{uid}` → `status === 'approved'`).
- Har line action par `line.resellerId !== s.uid` → 403. Reseller doosre ki line nahi chhoo sakta.
- Apply route: 3 applications / IP / 24h.
- Browser ko **kabhi** source/M3U upstream link nahi jata — sirf apna username/password/server.
- Admin actions `verifyAdmin` ke peeche (pehle se).

---

## 8. Jo abhi bhi nahi hai (phase 2 — gateway + billing engine)

Yeh release **panel aur paisa** hai. Asli streaming aur apne-aap billing abhi nahi:

- Xtream `player_api.php` / `get.php` / `xmltv.php`, Stalker `portal.php`
- Redis concurrency (device limit server par)
- 12 tareekh ka **auto**-suspend cron, WhatsApp auto messages
- JazzCash statement se auto-reconciliation

Tab tak: lines panel se banti hain, suspend/resume manual hai, aur payment admin "Paid" se record hoti hai. Tafseel: `docs/IPTV-PLAN.md` (v40 = weeks 1–6 of gateway).

---

## 9. Test

```bash
npm ci
npm run check          # module graph + typecheck
node scripts/test-v40.mjs
npm run build:offline
```

`scripts/test-v40.mjs` = **90 checks**: price cap/floor, margin, month maths, credentials, apply + client validation, credit, stats, cycle days, message safety, API owner checks, routes, robots/sitemap, rules, blog files.

---

## 10. Deploy checklist

1. `firestore.rules` publish karein (v40 ke blocks ke saath).
2. Vercel deploy.
3. `/iptv/reseller` par khud aik application bhej kar dekhein.
4. Admin → IPTV → **Approve** (credit 10) → `/reseller` par sign in.
5. Aik test client banayein, credentials copy karein, phir suspend/resume check karein.
6. `NEXT_PUBLIC_IPTV_SERVER` env set karein (warna default `http://dns.mizanora.tv:8080` use hoga).
