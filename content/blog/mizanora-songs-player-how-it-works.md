---
title: "Songs jo chalte hain: mirror, proxy aur fallback ka poora system"
slug: mizanora-songs-player-how-it-works
description: Mizanora par gaane kaise play hote hain — music mirrors, /api/songs/audio proxy, fresh token, teen-step fallback aur honest error screen. Isi liye "song play nahi ho raha" ka masla jarr se theek hota hai.
date: 2026-11-06
category: movies-and-series
tags: mizanora, songs, music, jiosaavn, api, proxy, player
image: /img/muaaz/muaaz-iqbal-04.jpg
---

Gaana chalana sunne mein aasan hai: ek `<audio>` tag, ek URL. Magar public music APIs ke saath
teen masle aate hain, aur teeno ka hal alag hai.

## Masla 1: link expire ho jata hai

JioSaavn jaise sources ka audio link **token** ke saath aata hai. Page 10 minute purana ho, to link
mar chuka hota hai — user "play" dabata hai aur kuch nahi hota.

**Hal:** Mizanora browser ko CDN ka link nahi deta; woh apna URL deta hai:

```
/api/songs/audio/<song-id>
```

Yeh route har request par mirror se **naya token** leta hai aur phir 302 ke saath asli link par
bhej deta hai. Purane link ka masla khatam.

## Masla 2: CORS aur hotlink

Kuch CDN sirf apni site se aane wali request qabool karte hain, ya browser ko CORS header nahi
dete. Seedha link browser mein fail ho jata hai.

**Hal:** wohi route `?proxy=1` ke saath bytes khud stream kar deta hai (Range requests ke saath,
taake seek kaam kare). Browser ko lagta hai audio Mizanora se aa raha hai — aur aata bhi wahi se hai.

## Masla 3: mirror down

Public mirrors kabhi kabhi band hote hain. Ek mirror par depend karna matlab: us din songs section
band.

**Hal:** mirror list + race:

1. Aap ka apna mirror (`SONGS_API_BASE`, ya `SONGS_API_BASES` mein comma-separated list) sab se pehle.
2. Doosre public mirrors.
3. Sab se tez jawab jeet jata hai (Promise.any), baqi background mein reh jate hain.

Aur `/api/songs/health` batata hai kaun sa mirror abhi zinda hai, kitne millisecond mein jawab diya.

## Browser ka aakhri haath: fallback chain

Player `<audio>` ke `onError` par teen steps try karta hai:

| Step | Source |
| --- | --- |
| 1 | `/api/songs/audio/<id>` (server, fresh token) |
| 2 | `/api/songs/audio/<id>?proxy=1` (server bytes) |
| 3 | CDN ka seedha link (jo mirror ne diya) |

Teeno fail ho jayein to player jhoot nahi bolta — saaf likhta hai: *"music mirror jawab nahi de
raha"*, sath **Retry** aur **YouTube par sunein** ka button. User phansata nahi.

## Search kaise kaam karti hai

1. `/api/songs/search?q=…` server par mirrors ko race karta hai (30 min cache).
2. Agar server ko jawab na mile (preview/offline), **browser khud** mirrors ko call karta hai
   (`lib/songsClient.js`) — kai baar user ka network server se behtar jawab deta hai.
3. Result cards par `playUrl` hota hai, is liye play hamesha hamare route se hota hai.

## Artist pages

Har gaane ke artist ka apna page: `/songs/artist/atif-aslam`. Wahan us ke gaane, artwork aur
"similar artists" ka rasta. Singer pages sitemap mein bhi jate hain (`songs-a.xml` … `songs-z.xml`).

## Admin ke liye

- `/admin/songs` → mirror test, featured songs, sitemap entry.
- Env: `SONGS_API_BASE` (apna mirror), `SONGS_API_BASES` (kai mirrors),
  `SONGS_AUDIO_PROXY=1` (hamesha proxy se stream — bandwidth zyada, compatibility bhi zyada).
- `/api/songs/health` browser mein khol kar dekhein kaun sa mirror zinda hai.

## Sach

Music third-party catalogue se aata hai, is liye 100% uptime ki guarantee koi nahi de sakta —
na Spotify de sakta hai. Farq yeh hai ke fail hone par system **kya** karta hai. Mizanora mein
woh rasta hai: naya token, proxy, mirror race, aur honest error.

Aage padhein: [Mizanora movies system](/blog/mizanora-movies-imdb-player-explained) · [Songs section](/songs) · [sab articles](/blog/author/muaaz-iqbal).
