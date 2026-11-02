# Mizanora IPTV — control room (prototype)

A **separate** Next.js app that lives inside this repo but has nothing to do with the shop.
`app/`, `lib/`, `components/` of Mizanora are untouched — this is its own package in `iptv/`.

Ye pehla slice hai: poora **admin + reseller panel ka UI**, animations ke saath, mock data par.
Backend (Xtream/Stalker gateway, billing, WhatsApp, streaming) agle phases mein aata hai — details neeche.

## Run

```bash
cd iptv
npm install
npm run dev          # http://localhost:3000
```

Production build:

```bash
npm run build && npm start
```

## Routes

| Route | Kya dikhata hai |
|---|---|
| `/login` | WhatsApp OTP login (admin / reseller), animated brand screen |
| `/dashboard` | Live viewers, revenue, edge nodes, 1–10 collection ring, activity, payment approvals |
| `/channels` | Channel library — grid + table, filters, sorting, health, EPG coverage, **bulk M3U import wizard** |
| `/epg` | Timeline guide with NOW line, genre colours, catch-up, unmatched-channel mapper |
| `/library` | Movies & series posters, transcoding queue, TMDB-style metadata |
| `/resellers` | Partner table, Rs 20/30 fee split banner, collection %, WhatsApp reminders, drill-down drawer with ledger |
| `/users` | Subscriber lines (Xtream + Stalker/MAC), device slots, expiry, per-user drawer with credentials |
| `/billing` | Cycle 1–10 tracker, invoices, payment-proof approvals, automation toggles, money split |
| `/studio` | Intro / premium / offline / recharge video assets + ad campaigns (Mizanora products) |
| `/watch` | **Player preview** — switch between intro, live, premium lock, offline standby and recharge states |
| `/settings` | Fee split slider, wholesale + retail cap, plans, payments, WhatsApp templates, security, branding |

## Design system

- Dark cinematic theme: emerald `#14b87a`, gold `#f5b83d`, deep ink `#04100a` — same family as the shop's TV player.
- Everything is CSS animation (no animation library): reveal-on-scroll, count-up numbers, aurora drift,
  ticker marquee, equaliser bars, shimmer, scan line, ring progress.
- `prefers-reduced-motion` ke liye saari animation band ho jati hai.
- Fonts: system stack (no external font request — offline-safe).

## Data

`lib/data.js` — deterministic mock data: 40 channels, 12 resellers, 28 subscriber lines, EPG grid, edge nodes,
invoices, ad campaigns, video assets. Real API aane par sirf yeh file replace / fetch hooks add honge.

## Kya abhi NAHI bana (agle phases)

1. **Auth + DB** — Postgres (users, plans, bouquets, subs, ledger, invoices) + Redis (tokens, concurrency).
2. **Gateway** — nginx origin + signed 60s URLs + HLS playlist cache (Vercel serverless par video nahi).
3. **Xtream v2.9** — `player_api.php`, `get.php`, `xmltv.php`, `/live|movie|series`.
4. **Stalker / MAG** — `portal.php` handshake, `server/load.php`, MAC whitelist.
5. **Billing engine** — 1–10 cycle, auto-suspend 12th, credits, Rs 20/30 split ledger.
6. **WhatsApp Cloud API** — OTP, invoice, receipt, expiry, suspension.
7. **Video pipeline** — ffmpeg workers: intro/premium/offline/recharge clips (per-reseller), VOD ladder.
8. **Ads** — pre-roll/mid-roll/EPG banner/corner QR injection per channel + per reseller.

## Notes

- Prototype hai: koi real credentials check nahi hoti, import/payment sab simulate hota hai.
- Branding/strings Roman Urdu + English mix mein hain, jaisa Mizanora par hai.
