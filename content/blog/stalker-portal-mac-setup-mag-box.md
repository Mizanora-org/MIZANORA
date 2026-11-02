---
title: Stalker portal aur MAC setup: MAG box par Mizanora IPTV
slug: stalker-portal-mac-setup-mag-box
description: MAG 250/254 ya STB emulator par Mizanora IPTV kaise chalayein — MAC address, portal URL, whitelist aur troubleshooting, sab step by step Roman Urdu mein.
date: 2026-11-02
category: live-and-reels
tags: stalker portal, mac address, mag box, stb emulator, iptv, setup
---

Jo log purane **MAG box** (ya TV par STB Emulator) use karte hain, unke liye Xtream Codes nahi chalta — unka system **Stalker portal** kehta hai, aur pehchaan **MAC address** se hoti hai.

Yeh guide usi ke liye hai.

## MAC address kya hota hai

Har MAG box ka aik hardware address hota hai, aisa dikhta hai:

```
00:1A:79:4B:22:9F
```

Ye box ke **Settings → Network** ya box ke sticker par milta hai. `00:1A:79` har MAG box ka starting code hota hai — is liye agar aap ke box ka MAC kisi aur se start hota hai to woh MAG nahi, koi aur device hai.

## Setup (MAG box)

1. Box on karein → **Settings** → **System Settings** → **Servers** → **Portals**.
2. **Portal 1** kholein:
   - **Name:** `Mizanora`
   - **URL:** `http://dns.mizanora.tv/c/` *(reseller se exact URL lein — trailing slash zaroori hai)*
3. **Save** karein, box restart karein.
4. Pehli dafa boot par box MAC bhejta hai. Agar line whitelist nahi hui to screen khali rahegi.
5. Apna MAC reseller ko WhatsApp karein → woh 2 minute mein whitelist kar deta hai.
6. Box dobara restart → channels, guide aur VOD aa jayenge.

## Setup (STB Emulator — Android)

1. Play Store se **STB Emulator** install karein.
2. Profile → **Add** → naam `Mizanora`.
3. **Portal URL** wohi jo reseller ne diya.
4. **MAC address** box mein apna MAC likhein (ya naya generate karein aur reseller ko bhejein).
5. Profile save → start.

> STB Emulator par MAC generate hota hai, is liye jo MAC app dikhaye **wohi** reseller ko bhejein — apne phone ka koi MAC nahi.

## Portal URL aur "database" wala masla

MAG boxes purane protocol par chalte hain, is liye:

- URL ka **http** hona zaroori hai (https par kuch purane boxes atak jate hain).
- Aakhir mein `/c/` hona chahiye.
- Agar screen par "Loading portal" par atak jaye — internet check karein, phir portal URL dobara save karein.

## Kya milta hai MAC line par

- Live channels (wahi list jo Xtream par hai)
- Embedded EPG (portal hi guide deta hai — alag XMLTV ki zaroorat nahi)
- VOD (Family/Premium plan mein)
- Aik MAC = aik device

## MAC aur sharing

MAC lock ka faida yahi hai ke line share nahi hoti: koi doosre box par wohi MAC daale to portal dono ko nahi chalata. Agar box badalna ho (purana kharab ho gaya), reseller se MAC update karwayein — purana hata kar naya lag jayega.

## Troubleshooting

| Screen par kya likha hai | Matlab | Kya karein |
|---|---|---|
| "Your STB is not authorized" | MAC whitelist nahi | reseller ko MAC bhejein |
| "Portal unavailable" | URL galat ya internet nahi | URL dobara check karein |
| Channels load, play nahi | source busy | 10 second baad dobara, ya doosra channel |
| "Recharge" screen | line expire | reseller ko payment |

MAC ki line chahiye? [Free trial](/iptv/trial) maangein aur device mein "MAG / Stalker box" chunein — team MAC ke saath line bana degi.
