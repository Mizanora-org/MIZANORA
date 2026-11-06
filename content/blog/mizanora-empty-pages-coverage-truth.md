---
title: "Khali pages ka sach: 86,783 URLs mein se kitne bhare hue hain?"
slug: mizanora-empty-pages-coverage-truth
description: Mizanora ke sitemap mein 86,783 movie/series URLs hain, magar committed snapshot sirf 17,157 titles ka hai. Yahan poora hisaab hai — kaun se pages khali hain, kyun, aur unhein theek karne ke teen raste. Koi chhupao nahi.
date: 2026-11-06
category: earning-and-business
tags: mizanora, coverage, seo, sitemap, imdb, quality, indexing
image: /img/muaaz/muaaz-iqbal-08.jpg
---

Har website owner kehta hai "mere paas hazaron pages hain". Sawal yeh hai: **un pages par kya
likha hai?** Yeh post Mizanora ke apne numbers hain, kyunki jab tak sach samne na ho, fix bhi nahi
hota.

## Numbers (aaj ke)

| Cheez | Count |
| --- | --- |
| Sitemap mein movies + series URLs | **86,783** |
| Committed snapshot (internet ke baghair chalta hai) | **17,157** (16,229 films + 928 series) |
| Live IMDb par depend karte hain | **~69,626** |
| Bhare hue pages ka percentage | **~19.8%** |

Yani paanch mein se chaar page **live IMDb** par depend karta hai. Jab IMDb jawab deta hai, page
bhara hua hai. Jab nahi deta — page "data pending" ban jata hai.

## "Data pending" page kya dikhata hai (v56 se)

Pehle aisa page ek chhota warning box tha, phir khali poster aur khali cast. Ab:

1. **Kaun sa title**: film ya series, aur kaun sa saal — committed id pool se.
2. **Player**: agar admin ne play servers set kiye hain to stream chalta hai.
3. **Search box** + **popular titles** (jo bhare hue hain) — taake visitor khali haath na jaye.
4. **Retry now** — sirf us page ka cache saaf karta hai (poori site ka nahi).
5. **noindex** — Google is adhoore page ko index nahi karta.

Is se user ka tajurba bachta hai. Google ka masla alag hai: woh still aise URL crawl karta hai agar
aap sitemap mein bhej rahe hain.

## Teen (aur sirf teen) raste

### A) Sitemap quality mode — aaj lagayein
```
SITEMAP_DATA_ONLY=1
```
Index sirf un titles ko list karega jinka data commit hai (~17k). Indexing rate barhega, thin
pages kam honge. Nuqsan: sitemap chhota lagta hai — magar **chhota aur bhara hua** bara aur khali
se behtar hai.

### B) Live IMDb ko reliable karein
Cinemeta/TMDB usually chalte hain; masla outage aur build-time block ka hai. Hal: retry + cache +
`TMDB_API_KEY`. Jab live reliable ho, full 86k pool theek hai.

### C) Pool ko sach mein barhayein (500k ka asli rasta)
IMDb ke official datasets (`title.basics.tsv.gz`) se ids + titles laayein, phir snapshot bhi barhayein
— warna 500k mein se 480k khali honge. Yeh kaam script se hota hai, jadoo se nahi.

## Kaun se pages khali hain — khud dekh lein

- `/sitemaps` par **Coverage card**: percentage, kitne live par depend karte hain.
- `npm run coverage` (script) — poori list + CSV banata hai.
- `/admin/coverage` — admin panel se same report.

## Aam sawal

**Q: Kya yeh pages Google se hata dene chahiye?**
A: Nahi — unhein **noindex** rakhein aur sitemap se nikaal dein jab tak data na aaye. `SITEMAP_DATA_ONLY=1`
yehi karta hai.

**Q: 500,000 sitemap ka kya?**
A: 500k **URLs** banaye ja sakte hain, magar 500k **bhare hue pages** sirf data se bante hain. Pehle
data, phir URLs.

**Q: User ko kaise pata chalega?**
A: Page khud kehta hai "official tafseel abhi load nahi ho saki", aur player + search deta hai.
Jhoot bol kar "loading" spinner dikhana behtar nahi.

Yeh post is liye likhi ke har "sab perfect hai" wala jawab aakhir mein tootta hai. Numbers samne
rakhein, chhota lekin bhara hua sitemap banayein, phir barhayein.

Aage padhein: [sitemap playbook](/blog/mizanora-sitemap-seo-playbook) · [Coverage guide page](/sitemaps) · [sab articles](/blog/author/muaaz-iqbal).
