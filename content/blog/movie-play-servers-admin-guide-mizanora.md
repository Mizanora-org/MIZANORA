---
title: "Play Servers Admin Guide — Apne Movie Server Add, Edit aur Delete Karein"
slug: movie-play-servers-admin-guide-mizanora
description: "Step-by-step guide: Mizanora ke admin panel se movie play servers add karein, {imdbid} template samjhein, series ke {season}/{episode} tokens istemal karein, quality set karein aur masle hal karein."
date: 2026-11-06
category: movies-and-series
tags: mizanora admin, play servers, movie player, imdb template, streaming setup
---

Mizanora ka Cinema Player khud koi movie host nahi karta — woh aap ke diye hue **servers** se stream karta hai. Yeh guide batati hai ke woh servers kaise add hote hain aur har cheez ka matlab kya hai.

Jagah: **Admin > Movies** page ke neeche **Play Servers** section.

## Sab se pehle: template kya hota hai?

Template ek link hai jis mein **placeholders** hote hain. Player un placeholders ki jagah har title ki asal value daal deta hai.

```
https://my-cdn.com/play/{imdbid}
```

Jab visitor `The Legend of Maula Jatt` kholega (IMDb `tt12425792`), player yeh bana dega:

```
https://my-cdn.com/play/tt12425792
```

Isi liye aap ko har movie ke liye alag link likhne ki zaroorat nahi — **ek dafa server add karein, sab titles chal partay hain**.

## Tamam tokens

| Token | Kya daalta hai | Misaal |
|---|---|---|
| `{imdbid}` | IMDb title ID | `tt12425792` |
| `{imdb}` / `{tt}` | wohi cheez | `tt12425792` |
| `{slug}` | Mizanora slug | `the-legend-of-maula-jatt-2022` |
| `{title}` | title (URL-encoded) | `The%20Legend...` |
| `{year}` | release year | `2022` |
| `{type}` | movie ya series | `movie` |
| `{season}` / `{s}` | season number | `2` |
| `{episode}` / `{e}` | episode number | `7` |

Koi doosra `{...}` likhne par panel saaf mana kar dega — is liye typo ki wajah se toota hua link save nahi hota.

## Add karne ka tareeqa (2 minute)

1. **Server ka naam**: “Mizanora CDN · HD”. Yeh naam viewer ko player ke server list mein dikhta hai.
2. **Play link template**: apna asal link, tokens ke saath.
3. **Type**:
   - `Auto` — link dekh kar khud pata lagata hai (`.m3u8` = HLS, `.mp4` = MP4, warna embed).
   - `Embed page` — kisi doosre player ka page jo `<iframe>` mein chalta hai.
   - `HLS` / `MP4` / `DASH` — seedha video.
4. **Kis ke liye**: movies only, series only, ya dono.
5. **Quality** aur **Zubaan**: viewer ko dikhne wale labels.
6. **Rights confirmation** tick karein.
7. **Add server**.

Add hone ke baad neeche list mein server aa jata hai, aur `/movies` ke kisi bhi title par “Watch Now” nazar aata hai.

## Series ke liye

Series template mein `{season}` aur `{episode}` shamil karein:

```
https://my-cdn.com/series/{imdbid}/{season}/{episode}.m3u8
```

Kis server par `{season}` mojood hai, uski list mein `S/E` ka chhota badge dikhta hai. Player mein season/episode badalne par link khud dobara banta hai.

## Edit, Delete, ON/OFF, Duplicate, Order

- **Pencil** — form mein server load ho jata hai; tabdeeli karke “Save changes”.
- **Trash** — server hamesha ke liye delete (confirm ke baad).
- **ON/OFF** — server ko list mein rakh kar chhupa dein.
- **Copy** — same template ki dusri entry (“HD” aur “SD” variants ke liye).
- **↑ ↓** — pehla server player mein sab se pehle dikhta hai.

## Pre-roll ad settings

Usi section mein:

- **Ad ON/OFF**
- **Ad ki lambai** (0–30 second; 0 = ad nahi)
- **Skip kab se** (0–20 second)
- **Heading** aur **note**

Ad Mizanora ka apna hai — products shop se aate hain, koi third-party ad script load nahi hoti.

## Aam masle aur unka hal

**“Server add hua magar player khali hai.”**
Link `https://` se shuru hona chahiye. `http://` mixed content ki wajah se browser block kar deta hai. Panel ne bhi `http` mana kar diya hota hai.

**“Kuch titles par server nahi dikh raha.”**
Agar template mein `{imdbid}` hai aur us title ki IMDb ID nahi hai, to player us server ko skip karta hai (khaali `/play/` par bhejne se behtar hai). Jin titles ko aap lazmi chalana chahte hain, unhein IMDb ID ke saath add karein.

**“Embed page white screen dikha raha hai.”**
Bohat se host `X-Frame-Options` ya CSP laga kar iframe band kar dete hain. “Open in new tab” link hamesha mojood hota hai. Behtar hal: unka **HLS/MP4** direct link istemal karein.

**“Series par episode change nahi hota.”**
Template mein `{season}`/`{episode}` hone chahiye. Sirf `{imdbid}` wala server har episode par wohi link dega.

**“Player ON hai par sab titles par trailer hi aa raha hai.”**
Server list khaali hai, ya sab servers OFF hain. **Player ON/Load** dobara check karein.

## Rights — yeh sab se zaroori hissa hai

Sirf woh server add karein jo **aap ka apna** ho, jis ka **aap ke paas licence** ho, ya jis ka content **public domain / Creative Commons** ho. Unauthorized movie hosting copyright qanoon ke khilaf hai aur aap ke domain par ban lag sakta hai. Mizanora ke [Licence & streaming rights](/licence) page par poora record hai, aur [Copyright & takedown](/copyright) par report ka tareeqa.

---

Aage parhein: [Naya Cinema Player guide](/blog/watch-movies-on-mizanora-player-guide) aur [v51 announcement](/blog/mizanora-v51-movies-search-play-servers-player).
