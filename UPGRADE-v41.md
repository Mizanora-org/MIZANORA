# v41 — Self-service IPTV: free key, auto-approved resellers, apna catalogue

v39 ne section banaya, v40 ne reseller panel. **v41 usay "khud chalta" banata hai** — user Google se sign in karta hai aur foran key le leta hai, reseller sign in kar ke apply karta hai aur foran approve ho jata hai, aur IPTV ka apna channel catalogue free Live TV se alag ho jata hai.

---

## 1. Te teen nayi cheezein

| # | Kya | Kahan |
|---|---|---|
| 1 | **Xtream user ka apna account** — Google se sign in → 24h free key **foran** | `/iptv/start` + `POST /api/iptv/account` |
| 2 | **Reseller auto-approve** — sign in kar ke apply = panel turant chalu | `/iptv/reseller` + `POST /api/reseller/apply` |
| 3 | **IPTV ka apna channel list** — admin M3U import kare, public page usi se bane | `Admin > IPTV` + `siteMeta/iptvCatalogue` |

---

## 2. Xtream user (barakatwave jaisa)

**Flow:**
```
/iptv/start  →  "Google se sign in"  →  "Free key banayein"  →  screen par:
   Server: http://dns.mizanora.tv:8080
   Username: mz482913
   Password: k7m2qp9x
   (copy buttons + MAC for MAG box)
```
- Trial **24 ghante**, 1 device, Xtream ya MAC.
- **Aik account = aik trial** (zindagi mein). Paid line ho to trial nahi.
- Line `uid` par bandhi hoti hai → `/account/iptv` par bhi wohi dikhti hai.
- **Naya password** button — purana share ho gaya ho to foran badal lein.
- Claim kitna hua: `iptvEvents` mein `trial_claimed` (audit).

**API** `POST /api/iptv/account` (Bearer token zaroori):
```
{ action:'me' }      -> { lines:[...], claim:{ok}, email }
{ action:'claim' }   -> { line:{ username,password,server,mac,expiresAt } }
{ action:'rotate' }  -> { password }
```
Sirf apni line: har query `where('uid','==',token.uid)`.

---

## 3. Reseller auto-approve

Pehle: application → admin queue → 1 din ka intezaar.
Ab: **agar user sign in hai** to application ke foran baad `iptvResellers/{uid}` banta hai — `status: approved`, credit **10** (env se badlein), price Rs 200.

| Surat | Nateeja |
|---|---|
| Signed in + naya | **foran approved**, `{ approved:true, credit:10 }` |
| Signed in + pehle se reseller | `{ approved:true, existing:true }` |
| Sign in nahi | queue (admin approve kare) + "sign in karein to foran" message |
| `IPTV_AUTO_APPROVE=0` | sab queue mein (manual mode wapas) |

Admin bad mein bhi sab kuch kar sakta hai: credit +10, price, suspend, applications list.

**Env (optional):**
```
IPTV_AUTO_APPROVE=1     # 0 = manual approval
IPTV_RESELLER_CREDIT=10 # naye reseller ko kitni lines
```

---

## 4. IPTV ka apna channel catalogue

Free Live TV (`siteMeta/liveTv`) aur IPTV (`siteMeta/iptvCatalogue`) ab **do alag cheezein**:

```
Admin > IPTV > "IPTV channel list"
   ├─ M3U link  → Import   (server fetch, 15s timeout, 8 MB cap)
   ├─ M3U text  → Import
   ├─ Save catalogue        → siteMeta/iptvCatalogue + cache clear
   └─ Clear                 → wapis free Live TV list
```

- Max **5,000** channels (aik Firestore doc), duplicate URL khud nikal jate hain.
- Public `/iptv/channels` pehle IPTV catalogue padhta hai; **jab tak khali hai** free Live TV ki list dikhati hai (page kabhi khali nahi).
- Cache 10 minute, `iptv` tag se clear.

**API** `GET/POST /api/admin/iptv/channels` (admin only) — `import`, `save`, `clear`.

---

## 5. Admin panel (naya)

| Section | Kya |
|---|---|
| **IPTV channel list** | M3U import, preview, save, clear, ON/OFF |
| **IPTV users** | har uid ke neeche: email, lines, active, "free key" badge, last activity |
| Reseller applications | approve / reject (auto-approve ke baad bhi manual queue kaam karta hai) |
| Resellers | credit +10, paid mark |
| Trials / lines | pehle jaisa |

---

## 6. Naye/badle files

```
lib/iptvAccount.js               canClaim, trialLine, publicLine, setup steps (pure)
lib/iptvCatalogue.js             cleanCatalogue, groups, stats, fromM3U (pure)
lib/iptvCatalogueServer.js       cached read (tag: iptv)
app/api/iptv/account/route.js    me / claim / rotate
app/api/admin/iptv/channels/route.js  import / save / clear
app/iptv/start/page.js           "Apni IPTV key" page
components/IptvClaim.js          Google sign in + key card
components/IptvCatalogueAdmin.js admin M3U manager
scripts/test-v41.mjs             64 checks
UPGRADE-v41.md                   yeh file
```
Badle: `app/api/reseller/apply/route.js` (auto-approve), `components/ResellerApply.js`, `components/AdminIptv.js`, `app/api/admin/iptv/route.js` (users), `app/iptv/channels/page.js`, `app/iptv/page.js`, `app/iptv/trial/page.js`, `app/iptv/reseller/page.js`, `app/sitemap.js`, `components/Footer.js`.

---

## 7. Testing

```bash
node scripts/test-v41.mjs     # 64 checks
npm test                      # poori chain
npm run check
npm run build:offline
```

---

## 8. Deploy checklist

1. `firestore.rules` publish (v40 wale blocks — v41 mein rules nahi badle).
2. Vercel env: `NEXT_PUBLIC_IPTV_SERVER` (optional), `IPTV_AUTO_APPROVE`, `IPTV_RESELLER_CREDIT`.
3. `/iptv/start` kholein → Google se sign in → key bane → credentials copy.
4. `/iptv/reseller` par sign in kar ke apply karein → foran approved dikhe → `/reseller` khul jaye.
5. Admin > IPTV → channel list import → Save → `/iptv/channels` par nayi list.

---

## 9. Jo abhi bhi NAHI hai (seedhi baat)

Yeh sab **accounts, keys aur catalogue** hai — **asli stream abhi nahi**. Gateway (Xtream `player_api.php` / `get.php` / `xmltv.php`, Stalker `portal.php`, Redis concurrency, 7-din EPG) `docs/IPTV-PLAN.md` ke v40b mein hai (6 hafte). Jab tak woh nahi banta, key ban jati hai magar app mein channel nahi chalega.
