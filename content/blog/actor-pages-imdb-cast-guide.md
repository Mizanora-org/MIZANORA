---
title: "Actor pages jo khali nahi lagte: IMDb cast se star profile tak"
slug: actor-pages-imdb-cast-guide
description: Mizanora par actor pages kaise bante hain, photos kahan se aati hain, jab photo load na ho to kya hota hai, aur kis actor ki filmography kaise dekhein. Actors directory, alphabets aur sitemap — sab tafseel se.
date: 2026-11-06
category: movies-and-series
tags: mizanora, actors, imdb, cast, photos, filmography, seo
image: https://images.metahub.space/background/medium/tt0111161/img
---

Movie dekhne se pehle log aksar ek sawal poochte hain: *"Yeh actor kaun hai? Aur kya kya kiya
hai us ne?"* IMDb par yeh jawab milta hai, magar 700 shabdon ki biography ke saath. Mizanora par
actor page ka maqsad alag hai: **filmography, photo, aur us ke saath kaam karne wale log** — saaf
aur halka.

## Actor page kaise banta hai

1. **Cast IMDb se**: har title ke cast mein naam aur character aata hai.
2. **Photo**: IMDb ke public portrait endpoint se, cache ke saath (aadha din).
3. **Filmography**: jo bhi titles Mizanora ke paas us actor ke saath hain, woh usi page par.
4. **Slug**: naam se URL — `/movies/actor/shah-rukh-khan`.

Sab kuch IMDb ka official data hai, koi manual list nahi. Isi liye jab IMDb mein cast badalta hai,
Mizanora ka actor page bhi badal jata hai.

## Photos: "image load nahi ho rahi" ka asli hal

Star photos kai CDN se aati hain (IMDb portrait lookup, TMDB, shop ki apni uploads). Teen masle
aate hain:

- CDN **hotlink** block kar deta hai (Referer dekh kar),
- link **expire** ho jata hai,
- CDN par file hi nahi hoti (404).

v56 se har portrait ka rasta yeh hai:

| Step | Kya hota hai |
| --- | --- |
| 1 | Asli URL, `no-referrer` ke saath (yeh akela 80% blocks hal karta hai) |
| 2 | Fail ho to shop ka relay `/api/img` — server photo khud fetch karta hai |
| 3 | Phir bhi na aaye to **monogram** (naam ke do harf, rangeen background) |

Yani broken-image icon kabhi nahi. Aur yeh sirf actor page par nahi — movie cards, actors rail aur
actors directory, sab par.

## Actors directory

`/movies/actors` par har star ka card hai — photo, naam, role (actor/director) aur us ke titles.
Yeh page 682+ profiles se banta hai aur alphabet ke hisaab se sitemap mein bhi jata hai
(`actors-a.xml` … `actors-z.xml`), taake Google ko chhote, saaf lists milein.

## Kisi actor ki filmography dekhne ka tareeqa

1. Movie page kholo → cast mein naam par click.
2. Ya seedha search: `/search?q=shah rukh khan`.
3. Actor page par "Titles" section — jo bhi us ke saath Mizanora par maujood hai.

Agar koi film missing lagti hai to woh IMDb par bhi missing ho sakti hai; aap `/movies/tt…` se
seedha IMDb id se page khol sakte hain.

## Cast se judi chhoti baatein

- **Character vs actor**: Mizanora dono dikhata hai — kaun actor, kaun sa role.
- **Directors**: unka apna page aur unki filmography alag.
- **Series vs film**: actor page dono mila kar dikhata hai, taake TV ka kaam chhup na jaye.

## Aage kya

- Actor ke saath "known for" ranking (IMDb ke star meter ke baghair, sirf ratings se).
- Actor page par "aap ne pehle dekha" (local history).
- Urdu biography summary — AI se draft, phir insani review (galat maloomat se bachne ke liye).

Aage padhein: [Movies system samjhaya](/blog/mizanora-movies-imdb-player-explained) · [Actors directory](/movies/actors) · [sab articles](/blog/author/muaaz-iqbal).
