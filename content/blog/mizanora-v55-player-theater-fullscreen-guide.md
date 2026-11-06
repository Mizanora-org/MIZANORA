---
title: "Mizanora Player v55: theater mode, iPhone fullscreen aur har device par poora experience"
slug: mizanora-v55-player-theater-fullscreen-guide
description: Mizanora ke apne player (domain/play/{imdbid}) ka v55 upgrade — theater mode, iPhone Safari fullscreen fallback, double-tap seek aur swipe gestures, poora keyboard shortcut set, next-episode countdown, embed servers ke liye apne controls aur shortcut help panel. Roman Urdu guide with the exact key list.
date: 2026-11-06
category: movies-and-series
tags: mizanora, v55, player, fullscreen, theater-mode, mobile, keyboard-shortcuts, streaming, imdb
image: https://images.metahub.space/background/medium/tt0903747/img
---

Player wo jagah hai jahan user sab se zyada waqt guzarta hai — aur phir bhi sab se zyada
shikayatein usi ke bare mein hoti hain: *"fullscreen theek nahi chalta"*, *"iPhone par button kaam
nahi karta"*, *"seek karne ke liye chhota sa slider dhoondna parta hai"*, *"episode khatam hua to
kuch hua hi nahi"*.

v55 mein humne player ko sirf "fix" nahi kiya — usay **theater-grade** bana diya. Har cheez
`components/CinemaPlayer.js` mein hai, koi third-party player nahi, koi watermark nahi, aur
`domain/play/{imdbid}` wala apna pattern barqarar.

---

## 1. Theater mode — browser fullscreen ke baghair poora screen

Browser fullscreen (`F11` / `requestFullscreen`) har jagah kaam karta hai, lekin:

* kuch users ko browser ka fullscreen pasand nahi (address bar, notifications, alt-tab),
* kuch environments (kiosk, embedded browser, iOS par kuch versions) usay block karte hain,
* aur fullscreen se bahar nikalne ke liye `Esc` dhoondna parta hai.

Is liye ek **theater mode**: `T` dabayein ya control bar mein **THEATER** button. Player
`fixed inset-0 z-[70]` ho jata hai — poora viewport, hamare hi controls, aur `Esc` se wapas. Yeh
browser ki permission maange baghair chalta hai, is liye har device par predictable hai.

Do modes ka farq yaad rakhein:

| Mode | Kaise | Faida |
| --- | --- | --- |
| Fullscreen | `F` / fullscreen button | Asli OS-level fullscreen, PiP ke saath behtar |
| Theater | `T` / THEATER button | Baghair permission, instant, `Esc` se exit |

## 2. iPhone Safari: jo bug sab se zyada tang karta tha

iPhone par `<video>` element ka fullscreen alag API se chalta hai:
`video.webkitEnterFullscreen()`. Humara purana code sirf container par
`requestFullscreen()` call karta tha — Safari usay support nahi karta, is liye button **kuch nahi
karta tha** (sab se aam complaint).

Ab order yeh hai:

1. Agar pehle se fullscreen hai → `exitFullscreen()`.
2. Warna container par `requestFullscreen()` (Chrome, Edge, Firefox, Android Chrome).
3. Warna `video.webkitEnterFullscreen()` (iPhone/iPad Safari).

Matlab: button **kabhi dead nahi** hota.

## 3. Touch: double-tap seek aur swipe volume

Mobile par slider pakadna mushkil hota hai. Ab:

* **Double-tap left** → 10 second peeche.
* **Double-tap right** → 10 second aage.
* **Swipe up** → volume +10%.
* **Swipe down** → volume −10%.
* **Single tap** → play/pause.
* Har action par ek chhota hint (`+10s`, `Volume 70%`) screen ke beech mein aata hai.

Ek chhota sa detail: touch ke baad browser ek synthetic `click` bhejta hai. Usay ignore nahi
karte to video ek hi tap mein **do dafa** pause/play ho jata hai. Is liye tap ke 600ms tak click
ignore hota hai — chhota fix, bara farq.

## 4. Keyboard: pehle click karna parta tha, ab nahi

Purana listener stage `<div>` par `onKeyDown` tha. Matlab shortcut tabhi chalta tha jab user ne
player par click kiya ho. Ab listener **`window`** par hai (inputs/selects/textarea aur
`Ctrl`/`Cmd`/`Alt` combinations chhor kar), is liye page khulte hi shortcut kaam karte hain.

| Key | Kaam |
| --- | --- |
| `Space` / `K` | Play · Pause |
| `J` / `L` ya `←` / `→` | 10s peeche / aage |
| `↑` / `↓` | Volume ±10% |
| `M` | Mute |
| `F` | Fullscreen (iPhone fallback ke saath) |
| `T` | Theater mode |
| `0`–`9` | Video ke 0%–90% par jump |
| `C` | Captions on/off (captions na hon to screenshot) |
| `S` | Screenshot (PNG download) |
| `N` / `P` | Next / previous episode (series) |
| `H` / `?` | Shortcut help panel |
| `Esc` | Help / theater / menu band |

Poori list player ke andar bhi maujood hai — control bar ke `?` button se, ya `H` dabayein.
Naye users ko shortcut yaad karne ki zaroorat nahi, list wahin hai.

## 5. Series: episode khatam, agla khud shuru

Pehle episode end hone par player chup ho jata tha. Ab series mein:

1. Video end → **"Up next"** overlay.
2. 8 second ka countdown.
3. **Play now** se foran, **Cancel** se ruk jata hai, `N` se bhi turant.
4. Cancel karne par message: *"Stream khatam. Doosra server ya episode chunein."*

Aur agar user ne pehle se `N` / `P` keys ya control bar ke skip button se navigate kiya ho to
episode change hote hi player naya stream load karta hai (React `key` badalta hai, is liye
hls/iframe dono saaf destroy ho kar dobara bante hain).

## 6. Embed servers: jo iframe fullscreen block karta hai

Har admin-configured server hamara direct player nahi hota. Kuch **embed iframe** hote hain jin ke
andar ka player apna fullscreen button chhupa deta hai, ya `allowfullscreen` ignore karta hai.
Pehle user ke paas sirf "Open in new tab" tha.

Ab embed stage par hamara apna overlay hai:

* **Reload** — stream atak gaya? iframe dobara mount (bina page reload).
* **Theater** — wahi `fixed inset-0` trick, andar ke player se azad.
* **Fullscreen** — container par request (iframe ke andar ki permission ki zaroorat nahi).
* **Open in new tab** — bilkul last resort, hamesha maujood.

## 7. Quality, audio, captions, speed — v54 se barqarar

Upgrade ne purani taqat kharab nahi ki:

* **HLS**: auto + manual quality levels, audio tracks (Hindi/English/Urdu jaise), subtitles,
  live streams, buffer/bitrate/dropped-frames stats.
* **MP4/WebM**: native video, playback speed 0.5×–2×, PiP, screenshot.
* **Failover**: server fail hone par agla server khud try, `triedServers` yaad rehta hai, slow
  stream par hint.
* **Resume**: "Resume from 12:34" — progress local storage se (`movieProgress`).
* **Ads**: stream se pehle Mizanora house ad / seller product ad, skip timer ke saath. Player
  upgrade se yeh flow badla nahi.

## 8. Test kaise karein (2 minute)

1. Koi movie kholein, **Watch** dabayein, ad skip karein.
2. `F` — fullscreen. `Esc`. `T` — theater. `Esc`.
3. `H` — shortcut list. `J`/`L` se seek. `0`–`9` se jump.
4. Mobile par: right side double-tap (+10s), upar swipe (volume).
5. Koi series kholein, episode ke aakhir tak chhorein → "Up next" countdown.
6. Server list se koi **Embed** server chunein → Reload / Theater / Fullscreen test karein.

## 9. Aagay kya aa sakta hai

* Subtitle styling (size, background, position) save karna.
* "Skip intro" markers (chapter data se).
* Cast/crew overlay player ke andar (long-press par).
* Watch party (sync playback) — bara feature, alag version.

Tab tak ke liye: player kholiye, `H` dabaiye, aur jo shortcuts chahiye woh try karein. Koi cheez
tooti ho to server switch karein — failover khud agla rasta dhoond lega.
