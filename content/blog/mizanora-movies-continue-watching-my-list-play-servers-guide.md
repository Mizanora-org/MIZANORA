---
title: Mizanora Movies: Continue Watching, My List aur Play Servers — Mukammal Guide
slug: mizanora-movies-continue-watching-my-list-play-servers-guide
description: Mizanora Movies ka naya upgrade — jahan chhorha wahin se play, apni "My List" save karein, admin panel se apne play servers add karein (domain/play/{imdbid}), aur server mar jaye to player khud agla server try karta hai.
date: 2026-11-06
---

Mizanora Movies ab sirf ek catalog nahi — ab yeh aap ka apna player, apni list aur apni raftar wala section hai. Is guide mein teen naye features tafseel se: **Continue Watching**, **My List**, aur **Play Servers** (admin ke liye).

## 1. Continue Watching — jahan chhorha, wahin se

Pehle movie band karte hi position kho jati thi. Ab player har **4 second** baad aap ki position yaad rakhta hai.

- `/movies` par sab se upar **Continue Watching** shelf aa jati hai.
- Card par progress bar aur likha hota hai: `Resume 37%` ya `1:12:30 / 2:04:00`.
- Card par click karein — player usi second se shuru hota hai, aur poochta hai: *"Yahin se shuru karein?"*
- **Clear all** se poori list saaf.
- Yeh list aap ke **browser (localStorage)** mein hai — na account chahiye, na koi server call. Doosre device par apni list alag hogi.

> Note: private/incognito mode mein browser storage band hota hai, is liye list save nahi hogi.

## 2. My List — baad mein dekhne ke liye save karein

Kisi bhi movie page par **My List** button dabayein (bookmark icon). Title `/movies` par **My List** shelf mein aa jata hai.

- Maximum **60 titles** — list bohat lambi ho to purane nikal jate hain.
- Har card par hover karke ✕ se hata sakte hain, ya **Clear list** se sab.
- Server par kuch nahi jata — poori list sirf aap ke device par.

## 3. Play Servers — apna player, apne servers

Mizanora ka player kisi fixed host ka mohtaj nahi. Admin panel se aap apne servers add karte hain, aur player unhi se stream karta hai.

**URL ka pattern:**

```
https://aap-ka-domain.com/play/{imdbid}
```

`{imdbid}` ki jagah movie ka IMDb ID khud bhar jata hai — jaise `tt22084616` ke liye:

```
https://aap-ka-domain.com/play/tt22084616
```

### Server add karna (admin)

1. `/admin/play-servers` kholein (ya `/admin/movies` → *Play Servers ↓*).
2. **Name** likhein (jaise `Mizanora CDN`).
3. **Template** paste karein: `https://aap-ka-domain.com/play/{imdbid}`.
4. **Rights confirmation** tick karein — sirf wohi links add karein jinka aap ko haq hai.
5. **Save**.

### Bulk add — ek saath kai servers

Agar aap ke paas 5–10 links hain, ek ek karke add karne ki zaroorat nahi:

```
Mizanora CDN | https://aap-ka-domain.com/play/{imdbid}
Backup HLS | https://backup.example.com/{imdbid}/master.m3u8
```

Har line par ek link. Duplicate aur ghalat links khud skip ho jate hain aur report milti hai.

### Test button

Har server ke saath **↗** button — sample IMDb ID ke saath wohi URL naye tab mein khul jata hai. Live check karne ka sab se tez tareeqa.

### Auto fallback — server mar jaye to?

- **Direct streams (HLS/MP4):** agar server jawab na de (DNS fail, 403, dead host), player khud **agla ON server** try karta hai — har server sirf ek dafa, taake do kharab hosts ke darmiyan ping-pong na ho.
- **Embed servers:** embed frame apni error report nahi kar sakta, is liye **12 second** baad *"Next server try karein"* ka hint aa jata hai.
- Sab kuch fail ho jaye to message: *"Yeh server jawab nahi de raha — upar se doosra server chunein."*

## 4. Ads — pehle Mizanora, phir movie

Movie shuru hone se pehle **Mizanora ke apne products** ka short ad chalta hai (admin se seconds aur skip time set hota hai). Ek dafa dekhne ke baad usi session mein dobara nahi aata — taake baar baar movie dekhne par ad na rukawat bane.

## 5. Chhoti chhoti tips

- **Better quality:** admin panel mein server ki quality (4K/1080p/720p/Auto) set karein — player list usi tarteeb mein dikhati hai.
- **Series:** `{season}` aur `{episode}` tokens bhi supported hain; episode rail se next episode.
- **Screenshot / PiP:** player ke tools mein maujood — movie ka frame save karein ya picture-in-picture mein kaam karte rahein.
- **Legal:** sirf licensed / public-domain / apne rights wale streams. `/licence` aur `/copyright` par poori tafseel.

## Summary

| Feature | Kahan | Faida |
|---|---|---|
| Continue Watching | `/movies` | Jahan chhorha wahin se |
| My List | Movie page + `/movies` | Baad mein dekhne ke liye save |
| Play Servers | `/admin/play-servers` | Apna player, apne domains |
| Bulk add | Admin panel | Ek saath kai servers |
| Auto fallback | Player | Dead server par movie nahi rukti |
| House ads | Player | Mizanora products ka promo |

Koi server add karne mein masla ho ya player kisi khaas host par kaam na kare — `/contact` se bata dein, hum check karenge.
