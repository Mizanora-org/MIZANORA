---
title: "Mizanora v51: Har Movie Search Ho, Apne Play Servers Aur Naya Cinema Player"
slug: mizanora-v51-movies-search-play-servers-player
description: "v51 upgrade: IMDb ka poora catalogue search karein, admin panel se apne play servers add/edit/delete karein, aur naya faster Cinema Player — Mizanora ad ke saath, quality, audio track, subtitles aur resume."
date: 2026-11-06
category: movies-and-series
tags: mizanora v51, movies search, play servers, cinema player, imdb, admin panel
---

Pehle Mizanora ke [Movies & Series Hub](/movies) par ek masla tha: sirf wohi titles nazar aate thay jo pehle se feed mein aa chuke thay. Kisi ne “Inception” likha to mil gaya, magar koi nayi ya purani film dhoondni ho to rasta band tha. **v51** usi masle ko jarh se khatam karta hai.

## 1. Ab har movie search hoti hai — sirf “kuch khaas” nahi

Search box ab teen jagah ek saath dekhta hai:

- Mizanora ki apni library (built-in + auto-synced titles)
- **IMDb ka official public catalogue** (tt… IDs, posters, stars)
- **TMDB** (jab admin apni free API key save kare) aur **TVmaze** (series aur dramas)

Iska matlab: aap kisi bhi film ya drama ka naam likhein, hasil mein woh title aa jaye ga — chahe woh Mizanora ki library mein pehle se na ho. Natija card par tap karein aur uski poori detail page khul jaye gi: poster, cast, story, release date, trailer aur official links.

Aur agar aap ke paas seedha **IMDb ID** hai (jaise `tt22084616`), to usay search box mein paste kar ke “Open IMDb” dabayein — page foran ban jata hai.

> Technical note: nayi `/api/movies/search` route local library aur world catalogue ko mila kar duplicate hata deti hai. Har result ke saath `href` aata hai jo seedha `/movies/tt…` par le jata hai.

## 2. Play Servers: add, edit, delete — sab admin panel se

Yeh sab se bara change hai. **Admin > Movies > Play Servers** mein ab ek poora manager hai:

1. Server ka naam likhein (jaise “Mizanora CDN · HD”).
2. Link template likhein, jaise `https://my-cdn.com/play/{imdbid}`.
3. Type, quality, zubaan aur “movies / series / dono” chunein.
4. Rights ki tasdeeq tick karein, phir **Add server**.

Bas. Us ke baad **har movie page** par “Watch Now” button aa jata hai, aur player khud us title ki IMDb ID daal kar sahi link bana leta hai. Series ke liye `{season}` aur `{episode}` bhi chaltay hain — episode badalte hi naya link ban jata hai.

Har server ke saath yeh bhi milta hai:

- **Edit** — naam, link, quality badlein
- **Delete** — list se hata dein
- **ON / OFF** — band karein bina delete kiye
- **Duplicate** — HD/SD variant banane ke liye
- **Order** — upar/neeche, taake pehla server default rahe

Detail ke liye alag guide: [Play Servers admin guide](/blog/movie-play-servers-admin-guide-mizanora).

## 3. Naya Cinema Player

Player ab ek hi jagah yeh sab karta hai:

- Mizanora ka apna **pre-roll ad** — 10 second (admin se badla ja sakta hai), 5 second baad skip. Ad ke andar koi third-party ad network nahi.
- **Server switcher** — har server apni quality aur type ke badge ke saath.
- **Quality menu** — Auto, 4K, 1080p, 720p… jo stream asal mein deta hai.
- **Audio track** menu aur **subtitles** menu.
- **Playback speed**, picture-in-picture, full screen, screenshot.
- **Resume** — jahan chhorha tha wahin se; progress aap ke browser mein mehfooz rehti hai.
- Keyboard: Space/K, ← →, F, M, C.

## 4. Series ka poora experience

Seasons aur episodes ab player ke andar hi hain. Season chunein, episode tap karein — player usi episode ka link banata hai. Agla/pichla episode ke buttons bhi mojood hain.

## 5. Images aur actors

Posters ke liye `MoviePosterCard` ab gradient fallback ke saath official image dikhata hai. Cast members ke chehre bhi aa gaye hain (TMDB / TVmaze profile images), aur jis actor ki tasveer na ho uske liye official IMDb suggestion se portrait la kar 12 ghante cache kiya jata hai.

## 6. Legal pages

Do naye pages:

- [Licence & streaming rights](/licence) — har cheez kis ijazat se chal rahi hai.
- [Copyright & takedown](/copyright) — 48 ghante mein action ka wada, counter-notice ka tareeqa.

[Privacy policy](/privacy-policy) aur [Terms of use](/terms) bhi update ho gaye — player kya save karta hai aur movies section ke rules saaf likh diye hain.

## Kya karna hai aap ko?

1. Admin > Movies > Play Servers kholein.
2. Apne licensed server ka template add karein.
3. Quality aur ad timing set karein.
4. `/movies` par ja kar koi bhi title search karein aur “Watch Now” dabayein.

Bas — poora cinema system aap ke haath mein hai.
