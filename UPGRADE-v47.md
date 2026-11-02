# v47 — billing, blacklist/whitelist, audit log, bulk editing

v47 admin panel ko "dekhne ki jagah" se **chalane ki jagah** banata hai: paisa (billing + cron),
security (blacklist/whitelist + lockout + audit), aur bulk editing.

---

## 1. Blacklist / whitelist — `/admin/iptv → Access rules`

- Teen tarah ki entry: **IP** (exact `1.2.3.4`, wildcard `10.0.*`, CIDR `10.0.0.0/24`),
  **username** aur **MAC** (MAG box).
- **Blocklist mode** (default) — sab chalta hai siwaye block list ke.
- **Allowlist mode** — sirf allow list wale. Allow list khali ho to sab chalta hai (UI warning
  dikhata hai — ghalti se poora gateway band na ho).
- Block hamesha allow se pehle lagta hai. Aik value dono lists mein nahi reh sakti.
- UI mein: add form, chips (X se remove), clear, **tester** ("yeh IP/username/MAC chalega ya nahi"),
  aur aakhri admin actions ki list.
- Rules `siteMeta/iptvAccess` mein hain — **browser read nahi kar sakta** (firestore.rules).
- Gateway 20 second cache rakhta hai, is liye stream par Firestore ka bojh nahi parta.

Kahan lagta hai:

| Entry point | Check |
|---|---|
| `/player_api.php`, `/get.php`, stream, timeshift | `verifyLine` (username) + `checkDevice` (IP, MAC) |
| `/xmltv.php`, `/get.php` | IP guard route mein |
| `/portal.php`, `/c/` (MAG) | `checkDevice` (MAC + IP) |

## 2. Brute-force lockout

- `lib/gateway/lines.js`: **8 ghalat password → 15 minute lock** (per username).
- Counter memory + Firestore `iptvLockouts/{username}` dono mein (serverless instances share karte hain).
- Sahi login par lock khud clear ho jata hai. Jawab: `429 Bohat dafa ghalat password — N minute baad`.

## 3. Admin audit log

- `lib/gateway/audit.js` → `iptvEvents` mein `type: 'admin_action'` (wohi collection, koi naya index nahi).
- Kya log hota hai: line edit/delete/renew/suspend/reset-password/note, **bulk** operations,
  access rule changes (add/remove/mode/clear), billing mark-paid/suspend/extend, cron auto-suspend.
- Panel mein "Access rules" tab ke neeche aakhri 40 actions (kaun, kya, kab).

## 4. Bulk line editing

- Table mein checkbox (select all bhi), phir toolbar: **+30 din, +7 din, Suspend, Resume, Delete**.
- API: `POST /api/admin/iptv/lines { action:'bulk', ids:[], mode:'suspend'|'resume'|'delete'|'extend'|'plan', days?, plan? }`
  — max 200 ids per call, har line ka result count hota hai (`done`, `failed`).

## 5. Billing engine — `/admin/iptv → Billing`

**Rules** (`lib/iptvBilling.js`, pure + tested):
- Cycle **1–10**, payment due 10 tareekh 23:59 PKT, `suspendDay` 12, grace 3 din.
- `billingState`: `none / ok / due / overdue / suspend / off`.
- `invoiceFor()`: per-line invoice id (`mz1-2026-11`), amount × months, wholesale × months.
- `reminderText()`: WhatsApp-ready Roman Urdu (naam, amount, expiry, JazzCash 0306-2015326).
- `billingSummary()`: counts + **amount at risk**.

**Panel:** counts (theek / 3 din andar / expired / band honi chahiye), amount at risk, due lines ki
table — har line par **+1 month (payment mil gayi)**, **WhatsApp remind**, **suspend**.

**Cron:** `GET /api/cron/iptv` (roz 03:00 UTC = 08:00 PKT, `vercel.json > crons`)
- `Authorization: Bearer $CRON_SECRET` (Vercel khud bhejta hai), local ke liye `?key=`
- expiry ke **3 din baad** line suspend + payment record + audit log
- `?dry=1` = sirf report, kuch change nahi
- jawab: counts, suspended list, aur reminders (text ke sath)

⚠️ `CRON_SECRET` set na ho to cron 401 deta hai aur panel warning dikhata hai.

## 6. Security fixes

| Fix | Pehle | Ab |
|---|---|---|
| Admin probe | `orders` collection (customer ko bhi accessible) | `productCosts` — **sirf admin** list kar sakta hai |
| Admin SDK order | Firestore probe pehle | **ID token verify pehle**, phir rules probe |
| Lockout | koi nahi | 8 fail → 15 min, per username |
| Audit | koi nahi | `admin_action` events |
| Rules | `iptvAccess` public | private (`id != 'iptvAccess'`), `iptvLockouts` + `iptvPayments` server-only |

## 7. Env (naya)

| Key | Value | Kyun |
|---|---|---|
| `CRON_SECRET` | 32+ random chars | cron ko sirf Vercel chala sake |

## 8. Test / check

```bash
npm test               # v39…v47
npm run check          # 513 files, 0 problems
npm run build:offline
```

`scripts/test-v47.mjs` — **130 assertions**: IP/CIDR/wildcard maths, allow/block verdicts,
lockout wiring, audit calls, bulk modes, billing states/invoice/reminder, cron guards, rules.

## 9. Baqi (agla)

1. **Reseller**: trial line banana, sub-reseller, bulk clients, CSV, statement PDF, low-credit alert.
2. **Catalogue ops**: bouquets (client ko sirf chune hue groups), channel health check (dead link auto-off), EPG per-channel offset, ad analytics.
3. **Customer**: self-serve device logout, receipt download, browser player mein catch-up scrubber.
4. **Scale**: object storage/CDN (1M items), Cloudflare relay (1000+ viewers).
