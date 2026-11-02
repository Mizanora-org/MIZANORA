---
title: TiviMate mein IPTV playlist kaise add karein (Xtream aur M3U, dono)
slug: tivimate-playlist-setup-guide
description: Android TV ya Fire Stick par TiviMate mein Mizanora IPTV line add karne ka poora tareeqa — Xtream Codes login, M3U URL, EPG, favourites aur backup, sab step by step Roman Urdu mein.
date: 2026-11-02
category: live-and-reels
tags: tivimate, android tv, fire stick, xtream, m3u, iptv setup, mizanora
---

**TiviMate** Pakistan mein sab se zyada chalne wala IPTV player hai — is ki wajah simple hai: tez channel switch, theek EPG aur remote se aasan control. Yeh guide sirf itna batati hai ke aap ki line **5 minute** mein chal jaye.

## Pehle yeh 3 cheezein ready rakhein

1. Aap ka **username aur password** (reseller WhatsApp par bhejta hai)
2. **Server ka pata** — misaal `http://dns.mizanora.tv:8080` (aakhir mein `/` nahi)
3. TV par **internet** — 5 Mbps se kam nahi, HD ke liye 10 Mbps behtar

## Xtream Codes se add karna (recommended)

1. TiviMate kholain → **Settings** → **Playlists** → **Add playlist**
2. **Xtream Codes** chunein
3. Teen khane bharein:
   - **Server**: `http://dns.mizanora.tv` (ya jo aap ko mila ho, bina `/player_api.php`)
   - **Username**: aap ka `mz...` wala username
   - **Password**: wohi password
4. **Next** dabayein — list load hone lagegi (10–60 second, list bari hoti hai)
5. Naam de dein, misaal "Mizanora" → **Done**

Faida: TiviMate khud EPG, categories aur catch-up utha leta hai. Aap ko alag URL nahi dena parta.

## M3U se add karna (jab Xtream kaam na kare)

1. **Add playlist** → **M3U playlist**
2. **Playlist URL** mein wohi link daalein jo reseller ne diya ho (aam tor par `get.php?...&type=m3u_plus&output=ts`)
3. EPG ke liye **EPG URL** wala khana bharein (`xmltv.php?...`), warna guide khali rahegi
4. **Next** → **Done**

Agar link browser mein khulta hai aur file download hoti hai, magar TiviMate mein nahi chalta — URL ke aakhir se extra space hata kar dobara koshish karein. Yehi 80% masla hota hai.

## EPG set karna

- Xtream se add kiya ho to EPG khud lag jata hai.
- M3U wale case mein: **Settings → Playlists → apni playlist → EPG** → source chunein.
- Guide mein programme ka waqt shift lag raha ho to **Time offset** `+05:00` (Pakistan) set karein.

## Favourites aur groups (asli farq yahan parta hai)

400+ channels hote hain, is liye pehle din hi tarteeb bana lein:

- **Groups** mein sirf apne kaam ke groups rakhein (News, Sports, Kids, Islamic)
- **Favourites** mein 15–20 channels daalein — remote se channel badalna aasan ho jata hai
- **Settings → Appearance → Channel info** mein "now/next" on karein

## Backup

**Settings → General → Backup** se playlist ki copy bana lein. TV badalne ya app dobara install karne par yeh file kaam aati hai — dobara 400 channels arrange karne ki zaroorat nahi.

## Aam masle

| Masla | Wajah | Hal |
|---|---|---|
| "Invalid login" | server ya password galat | server se `http://` hata kar dekhein |
| List load hoti hai, channel nahi chalta | internet slow | 10 Mbps check, VPN band karein |
| EPG khali | EPG URL nahi diya | M3U ke saath XMLTV URL daalein |
| 2 minute baad band | device limit | doosra device band karein |
| Channel switch slow | cache | TiviMate settings se "clear cache" |

## Aage

Line chahiye? [Mizanora IPTV plans](/iptv#plans) dekhein ya [free 24 ghante trial](/iptv/trial) lein.
MAG box wale hain? [Stalker portal guide](/blog/stalker-portal-mac-setup-mag-box) parhein.
