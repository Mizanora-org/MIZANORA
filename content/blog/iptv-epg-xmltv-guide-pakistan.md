---
title: EPG aur XMLTV: IPTV guide khaali kyun aati hai aur kaise theek karein
slug: iptv-epg-xmltv-guide-pakistan
description: IPTV apps mein EPG khaali dikh rahi hai? XMLTV URL, channel mapping, time offset aur 7-din guide — sab kuch Roman Urdu mein, Pakistan ke channels ki misalon ke sath.
date: 2026-11-02
category: live-and-reels
tags: iptv, epg, xmltv, tv guide, tivimate, mizanora
---

IPTV par channel chal raha hai magar uske neeche likha hota hai **"No information"** — yeh sab se aam shikayat hai. Masla stream ka nahi, **EPG** ka hota hai.

EPG ka matlab hai Electronic Programme Guide: kaun sa programme kab chal raha hai. Iske baghair aap ko sirf channel ka naam dikhta hai, programme ka nahi.

Mizanora par poora guide yahan hai: **/iptv/guide**

## EPG aati kahan se hai

Teen hisse hote hain:

1. **Channel** — `Geo News`, `PTV Sports`, `Star Plus` waghera
2. **EPG id** — har channel ka ek technical naam, jaise `geo.tv` ya `mz-12.tv`
3. **XMLTV file** — ek badi text file jismein har id ke programmes likhe hote hain, start aur end time ke sath

App sirf tab guide dikha sakti hai jab **channel ka id** aur **XMLTV ka id** bilkul same ho. Ek harf ka farq — guide khaali.

## Mizanora par kya hota hai

Gateway har channel ke liye ek id banata hai:

- Agar admin ne `epg` field bhari hai → wohi id use hoti hai
- Warna → `mz-<channel-id>.tv`

Aur XMLTV endpoint yeh hai:

```
https://mizanora.vercel.app/xmltv.php?username=YOUR_USER&password=YOUR_PASS
```

Yeh link **line-protected** hai. Baghair username/password koi ise nahi khol sakta — is liye app mein wohi credentials daalein jo live stream ke liye hain.

## Step 1: XMLTV URL app mein daalein

**TiviMate:**

1. Settings → EPG → Add source
2. XMLTV link paste karein (username/password ke sath)
3. Save → EPG refresh

**IPTV Smarters:**

1. Settings → EPG → EPG URL
2. Wohi link daalein, save
3. App restart

**VLC / Kodi:**

Kodi mein PVR IPTV Simple Client ke andar alag khanay hote hain — M3U URL aur XMLTV URL, dono daalein.

## Step 2: mapping check karein

App mein channel par long-press ya info kholein. Wahan **EPG channel id** likha hota hai. Agar woh khaali hai ya `mz-12.tv` jaisa hai magar guide nahi aa rahi, to XMLTV mein woh id maujood nahi.

Mizanora gateway har channel ke liye fallback slots bhi banata hai — matlab agar asli guide data kisi channel ke liye nahi mila, to bhi app ko khaali screen nahi milti, 2 ghante ke slots mil jate hain.

## Step 3: time offset

Pakistan **UTC+5**. Kai dafa guide aa jati hai magar 5 ghante aage peeche. App ke EPG settings mein **time offset** ka option hota hai:

- TiviMate: EPG → Time offset → `+5:00` ya `0` (agar source already local time bhej raha hai)
- Smarters: Settings → EPG offset

Mizanora ki guide `+0500` timezone ke sath bheji jati hai, is liye pehle `0` try karein. Agar 5 ghante ka farq dikhe to `-5:00` lagayein.

## Guide khaali hone ki 5 wajhein

1. **XMLTV URL galat** — `http` vs `https`, ya trailing slash ka farq
2. **Username/password galat** — endpoint 401 deta hai, app chup chaap khaali guide dikha deti hai
3. **App ne cache kar li** — EPG refresh karein ya app ka data clear karein
4. **Channel mapped nahi** — app ke andar manual mapping
5. **Internet slow** — badi XMLTV file (10–20 MB) time out ho jati hai; Wi-Fi par refresh karein

## Browser player mein guide

App install nahi karni? `/iptv/player` mein login karte hi now/next khud dikhta hai, aur `/iptv/guide` par 400 channels ka schedule ek table mein hai — search aur group filter ke sath.

## 7 din ka guide

Mizanora guide **−6 ghante se +36 ghante** tak ka data deta hai. Iska matlab aap ko pichhle programmes aur agle dedh din ka schedule dono milte hain.

Jin channels par archive hai, unke liye **7 din** tak ka catch-up chalta hai — guide mein un channels par `7d` badge dikhta hai.

## Aakhir mein

EPG khaali hona stream ka masla nahi hota. 90% cases mein sirf XMLTV URL ya mapping ka masla hota hai. Pehle `/xmltv.php?...` link browser mein kholein — agar XML dikhe to source theek hai, phir app ki settings dekhein.

Madad chahiye? Reseller ko WhatsApp karein aur channel ka naam likhein — woh admin panel se mapping theek kar deta hai.
