# Mizanora v39 — IPTV section (plans, trial, reseller, admin)

Ye upgrade **Mizanora ke andar** aik naya section add karta hai: `IPTV`. Store, Live TV aur baaqi sab jaise thay waise hi hain — sirf naye page aur naye API routes jure hain.

> **Zaroori:** Firestore rules dobara publish karein (naye `iptvTrials`, `iptvLines`, `iptvResellers` rules) — warna customer apni line nahi dekh sakega.

## 1. Naye public pages

| Page | Kya |
|---|---|
| `/iptv` | Landing — plans, features, how it works, channels teaser, reseller hisaab, FAQ (JSON-LD ke saath) |
| `/iptv/channels` | Poori channel list, groups ke sath (Live TV config se hi aati hai) |
| `/iptv/trial` | 24-ghante free trial form → admin queue |
| `/iptv/reseller` | Reseller program, packs, calculator, rules, FAQ |
| `/account/iptv` | Customer ki apni line: plan, expiry, devices, server/username/password/MAC |

Sab pages Mizanora theme (emerald + gold, light) mein hain — alag branding nahi.

## 2. Paisa (lib/iptv.js mein aik jagah)

- **Connection fee Rs 50** → Rs 20 Mizanora + Rs 30 reseller. **Pehla month isme shamil.**
- **Monthly Rs 200** → Rs 100 Mizanora (wholesale) + Rs 100 reseller. **Cap Rs 200.**
- 3 mahine aur 12 mahine ke discounted rate bhi (Rs 550 / Rs 1,900 se shuru).
- Plans: Trial (free 24h), Starter (1 device, HD), Family (2, FHD + VOD), Premium (3, 4K).
- Koi bhi number badalna ho to sirf `lib/iptv.js` badlein — page, calculator aur admin sab wahi se padhte hain.

## 3. Admin

`/admin/iptv` (Admin menu → Overview → **IPTV**):

- Trial requests ki list → **Approve** (24h line khud ban jati hai, username/password generate)
- Lines: expiry, state, **+30d extend**, suspend
- Collection 1–10: reseller-wise due vs paid
- KPIs: active lines, trials, monthly wholesale, collected %

Firestore connect na ho to panel **demo data** dikhata hai aur likhta hai ke kya set karna hai — khali screen nahi.

## 4. APIs

- `POST /api/iptv/trial` — public form. Validation (`cleanTrial`), 6-hour per-number limit, 6-per-hour per-IP guard, Firestore `iptvTrials`.
- `POST /api/admin/iptv` — admin only (`verifyAdmin`). Actions: `list`, `approve`, `extend`, `suspend`.

## 5. SEO

- `app/sitemap.js` mein `/iptv`, `/iptv/channels`, `/iptv/reseller`, `/iptv/trial` add.
- `robots.js` mein `/account/iptv` disallow (private page).
- `/iptv` par **Product + Offer**, **FAQPage**, **BreadcrumbList** JSON-LD.
- Header nav, Footer "Company" column aur Admin sidebar mein link.

## 6. Blog (5 guides)

- `mizanora-iptv-guide-roman-urdu` — poora guide, prices, Xtream vs MAC
- `iptv-xtream-codes-setup-tivimate-smarters` — TiviMate / Smarters / Smart TV
- `stalker-portal-mac-setup-mag-box` — MAG box / STB emulator
- `iptv-reseller-pakistan-guide` — reseller hisaab, 1–10 cycle, cap
- `iptv-channels-legal-pakistan` — PEMRA/PTA, authorised vs pirated source, buyer checklist

Sab `live-and-reels` / `earning-and-business` categories mein, sitemap aur RSS mein khud aa jate hain.

## 6b. Purana standalone panel hata diya

Pehle jo alag `iptv/` folder (dark panel prototype) tha, woh is branch se **remove** kar diya gaya — kyunki wohi kaam ab store ke andar `/iptv`, `/admin/iptv` aur APIs ki shakl mein Mizanora theme ke saath maujood hai. Us ki history git mein mehfooz hai (commit `a66b40d`).

## 7. Firestore

Naye collections:

```
iptvTrials/{id}     { name, phone, city, device, plan, status, ip, createdAt }   // server only
iptvLines/{id}      { uid, username, password, mac, plan, maxDevices, expiresAt, status, resellerName, resellerPhone }
iptvResellers/{id}  { name, phone, connections, paidThisCycle }
```

Customer apni line `uid` se padhta hai (rules: owner + admin). Trial requests browser se nahi likhe ja sakte — sirf server.

## 8. Kya abhi NAHI hai (agle phase)

Yeh upgrade **section + plans + trial + reseller + admin view + SEO** hai. Asli **streaming gateway** abhi nahi:

- Xtream `player_api.php` / `get.php` / `xmltv.php`
- Stalker `portal.php` + `server/load.php`
- nginx origin + 60s signed URLs + concurrency (Redis)
- 1–10 ka auto-billing engine, WhatsApp receipts, recharge video

Tab tak lines admin panel se manually banti hain (approve → credentials), aur streaming alag gateway par shift hogi.

## 9. Test

```bash
npm ci
npm test            # naye scripts/test-v39.mjs ke saath
npm run check
npm run build:offline
```

Is branch par teeno chale: `npm test` **62/62 pass** (v39), `npm run check` **424 files, 0 problems**, `npm run build:offline` **compiled + prerender ok** (8 IPTV routes + 5 blog guides).

`scripts/test-v39.mjs` check karta hai: fee split, cap, plan prices, phone/MAC cleaning, line states, trial validation, routes, sitemap, robots, nav links, blog files aur Firestore rules.

## 10. Upgrade steps

1. Files replace karein, `npm ci`.
2. `firestore.rules` publish karein (apna admin UID/email daal kar).
3. Vercel deploy.
4. Admin → IPTV khol kar check karein.
5. WhatsApp number aur prices confirm karein (`lib/iptv.js`).
