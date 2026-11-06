---
title: Mizanora Live TV ka Naya Player — Number Zapping, Sleep Timer, Cast aur 14 Keyboard Shortcuts
slug: mizanora-live-tv-zapping-sleep-timer-shortcuts-guide
description: Mizanora Live TV player ab SIRAVEX se bhi aage hai — remote ki tarah channel number likh kar jump, bada zap banner, sleep timer, mobile gestures, -30s timeshift, Chromecast aur poore keyboard shortcuts. Poori guide Roman Urdu mein.
date: 2026-11-06
category: Live TV
---

Mizanora Live TV ka player v52 mein ek nayi manzil par pohnch gaya hai. Pehle se mojood HLS/DASH, asal resolutions, audio tracks aur captions ke upar ab woh sab kuch hai jo ek achhe IPTV box mein hota hai — aur kuch ziyada.

## 1. Number zapping — remote ki tarah

TV dekhte waqt keyboard par sirf **numbers** likhein:

```
1 2
```

Ek second ke andar player khud **CH 12** khol deta hai. Screen ke upar right corner mein bara number, channel ka logo aur naam aata hai — bilkul SIRAVEX jaisa zap banner.

- Sirf 3 digits tak — `040` bhi `40` hi hai.
- Channel maujood na ho to imandari se likha aata hai: *“Channel 99 maujood nahi (1–40)”*.
- Ruk kar jump khud ho jata hai, Enter dabane ki zaroorat nahi.

## 2. Sleep timer — so jane ke liye

Raat ko channel chalta rehna chahiye? Settings → **More** → `Off / 15m / 30m / 60m / 90m`, ya keyboard par **T** dabayein (cycle chalta rehta hai).

- Top bar mein countdown: **🌙 12:41**
- 1 minute baqi hone par halki si warning.
- Timer poora hote hi playback khud band: *“Sleep timer: playback band. Good night!”*

## 3. Mobile gestures

Phone par player par ungli chala kar:

| Gesture | Kaam |
|---|---|
| Left / right swipe | Pichla / agla channel |
| **Up / down swipe** | Awaaz barhana / kam — bara volume HUD |
| Double tap | Full screen |
| Single tap | Controls dikhana / chhupana |

## 4. Timeshift (−30s)

Jin live streams ke paas DVR window hoti hai, wahan control bar mein **30s** ka button aa jata hai — koi dialogue miss ho jaye to 30 second peechay. `LIVE` button (ya **L**) se wapas live edge par.

Stream buffer na de to player saaf bata deta hai: *“Is channel par itna peechay jaane ka buffer nahi hai”* — spinner mein phansa nahi chhorta.

## 5. Cast / Chromecast

Support karne wale browser (Chrome / Edge) mein **Cast** button dikhta hai — TV ya Chromecast par channel bhej dein. Button sirf tab nazar aata hai jab browser mein Remote Playback API mojood ho, warna faltu button nahi.

## 6. 14 keyboard shortcuts

`?` dabayein to poore player ki list khul jati hai:

| Key | Kaam |
|---|---|
| `←` `→` | Pichla / agla channel |
| `↑` `↓` | Awaaz |
| `0–9` | Channel number |
| `Space` / `K` | Play / pause |
| `M` | Mute |
| `L` | Live edge |
| `C` | Photo capture |
| `P` | Picture in picture |
| `F` | Full screen |
| `R` | Random channel |
| `S` | Settings |
| `T` | Sleep timer |
| `/` ya `G` | Channel search |
| `?` | Shortcuts sheet |

## 7. Do chhoti magar qeemti cheezein

- **Per-host picture memory:** kisi host par 1080p chuna? Agli dafa usi host ke channels 1080p par khulte hain. `Auto` chunne par network ke hawale.
- **Last channel resume:** bina kisi channel link ke `/live` kholein — pichla channel khud khul jata hai.

Sab kuch **aap ke browser** mein rehta hai (localStorage). Na account, na tracking, na server par koi record.

## 8. Naya rang

Screen ka halka glow us channel ke apne rang se banta hai — har channel ka apna mizaj, lekin player ka rang (gold + deep green) wahi Mizanora wala.

---

**Tip:** Agar aap admin hain aur channel add karna hai to `/admin/live-channel` kholein — add / edit / delete, M3U import, Xtream, multiple backup streams, ads aur YouTube cast sab wahan se control hota hai.

Agla round: **EPG guide**, **multiview 2×2** aur **admin stream health probe** — bataiye kaunsa pehle chahiye.
