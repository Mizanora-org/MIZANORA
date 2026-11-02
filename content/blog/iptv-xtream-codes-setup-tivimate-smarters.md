---
title: Xtream Codes setup: TiviMate, IPTV Smarters aur Smart TV par Mizanora IPTV
slug: iptv-xtream-codes-setup-tivimate-smarters
description: Mizanora IPTV line ko TiviMate, IPTV Smarters Pro, Android TV, Fire Stick, iPhone aur Samsung/LG Smart TV par kaise daalein — step by step, screenshots ki tarah saaf instructions.
date: 2026-11-02
category: live-and-reels
tags: xtream codes, tivimate, iptv smarters, smart tv, fire stick, setup, guide
---

Mizanora IPTV line milne ke baad kaam sirf 3 cheezon ka hai: **server address**, **username**, **password**. Yehi "Xtream Codes" kehlata hai, aur har achi IPTV app isay samajhti hai.

Neeche har device ka tareeqa hai.

## Pehle: apni details lein

Reseller aap ko aisa message bhejta hai:

```
Server:   https://mizanora.vercel.app
Username: mz123456
Password: 8f2k1q
```

Agar `http://` hai to bilkul theek — Xtream `http` par chalta hai. Copy kar ke rakh lein.

## Android TV / Fire TV Stick — TiviMate

1. Play Store (ya Fire TV par Downloader se) **TiviMate** install karein.
2. **Add playlist** → **Xtream Codes** chunein.
3. Teen boxes bharein: server, username, password.
4. **Next** → playlist ka naam (Mizanora) → **Done**.
5. EPG khud aa jayegi. Guide kholne ke liye remote par **OK** dabayein.

> TiviMate ka free version kaafi hai. Premium (recording, multiple playlists) ki zaroorat nahi.

## Android / iPhone — IPTV Smarters Pro

1. App kholein → **Login with Xtream Codes API**.
2. Naam: `Mizanora` (kuch bhi).
3. Username, password, server URL.
4. **Add user** → list load ho jayegi.

Smarters par **Live / Movies / Series** ke teen tabs hote hain — VOD wahan milta hai.

## Samsung Tizen / LG webOS

In TV par Play Store nahi hota, is liye do raaste hain:

**A) App se (aasan):** Smart IPTV, IBO Player ya OTT Navigator — TV ke store se install karein. Ye apps MAC address mangte hain; app jo MAC dikhaye wohi reseller ko bhejein, aur woh portal URL + MAC aap ke liye whitelist karega.

**B) Browser se (bilkul free):** TV ka browser kholein → `mizanora.vercel.app/live`. Ye free Live TV hai, login ke baghair. IPTV line ka poora experience (EPG, VOD, multiple devices) app se behtar chalta hai.

## MAG / Stalker box

MAG box par Xtream nahi chalta — **portal + MAC** chahiye:

1. Box ki setting → **Portals**.
2. Portal naam 1: `Mizanora`.
3. Portal URL: `https://mizanora.vercel.app/c/` (reseller se confirm karein).
4. Box ka MAC address (00:1A:79:xx:xx:xx) reseller ko bhejein.
5. Box restart — channels aa jayengi.

Tafseel: [MAC / Stalker setup guide](/blog/stalker-portal-mac-setup-mag-box).

## Kuch cheezein jo phansi hui lagti hain

| Masla | Wajah | Hal |
|---|---|---|
| "Invalid username" | extra space ya galat capital | copy-paste karein, spaces hataayein |
| Channels hain magar khulte nahi | internet slow ya app purani | app update, phir Retry |
| EPG khali | guide abhi load nahi hui | app mein EPG refresh |
| Aik device chal raha, doosra nahi | plan ka device limit | Family/Premium plan ya purana device band |
| Screen par "Recharge" | line expire ya payment pending | reseller ko WhatsApp, payment ke baad foran chalu |

## Free trial se shuru karein

`/iptv/trial` par 24 ghante ka trial maangein — 1 device, koi card nahi. Trial par hi TiviMate aur Smarters dono test kar lein, phir plan chunein.

Plan aur prices: [Mizanora IPTV](/iptv).
