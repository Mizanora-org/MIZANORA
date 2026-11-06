---
title: "Sitemap SEO playbook: 150 files, Search Console aur sach"
slug: mizanora-sitemap-seo-playbook
description: Mizanora ke sitemaps ka poora structure — titles-YYYY, actors A–Z, songs A–Z, quran, blog, live — kaun sa file kya rakhta hai, Search Console mein kya submit karna hai, aur kaun si ghalti indexing kharab karti hai.
date: 2026-11-06
category: earning-and-business
tags: seo, sitemap, google-search-console, indexing, mizanora, imdb
image: /img/muaaz/muaaz-iqbal-02.jpg
---

"Sitemap bana do, Google apne aap sab index kar lega" — yeh aadha sach hai. Sitemap sirf **raasta**
batata hai; index karna Google ka faisla hai. Aur us faisle ko kharab karne ka sab se aasan
tareeqa: hazaron aise URL bhejna jin par kuch nahi hota.

Yeh playbook wohi hai jo Mizanora par lagaya gaya — numbers ke saath.

## Structure (v56)

| File | Kya | Kitne URLs |
| --- | --- | --- |
| `/sitemap.xml` | shop, categories, products, tools, Quran, blog, hubs | ~12,000 |
| `/sitemaps/titles-YYYY.xml` | ek saal ke movies + series | ~98 files |
| `/sitemaps/actors-a…z.xml` | actor profiles | 26 files |
| `/sitemaps/songs-a…z.xml` | songs (jab mirror zinda ho) | 26 files |
| `/sitemaps/quran.xml` | 114 surahs | 114 |
| `/sitemaps/actors.xml`, `live.xml`, `blog.xml`, `songs.xml` | directories/hubs | chhote |
| `/sitemap-index.xml` | in sab ka index (robots.txt mein) | 150+ files |

**Sirf ek URL submit karein:** `https://mizanora.vercel.app/sitemap-index.xml`.
Har chunk alag submit karna nuqsan hai — same URL do sitemaps mein duplicate signal banta hai.

## Kyun year-wise, chunk-wise nahi

Pehle `movies-0.xml … movies-4.xml` the (20,000 URLs per file). Kaam karta tha, magar:

- ek file mein 1930 ki film aur 2026 ki series sath — Google ko theme samajh nahi aati,
- 20,000-URL block crawl budget kha jata hai,
- kharab URL ek jagah chhup jata hai.

Ab `titles-1999.xml`, `titles-2026.xml` — chhote, dated, themed lists. Purane chunk routes 404 nahi
hote (cached index ke liye zinda hain), magar index mein list nahi hote. **Ek URL, ek sitemap.**

## Search Console: 6 step

1. Property add karein (domain ya URL prefix).
2. Verify (DNS ya HTML tag).
3. Sitemaps → **sitemap-index.xml** submit.
4. 48–72 ghante baad: "Discovered URLs" dekhein. Kam ho to index file check karein.
5. Pages report: "Crawled – currently not indexed" zyada ho to content/quality ka masla hai, sitemap ka nahi.
6. Har hafte: Sitemaps → "Last read" date update honi chahiye.

## Coverage: asli masla

Sitemap mein 86,783 titles hain. Un mein se **16,229 films + 928 series** ka data repo mein commit
hai — baqi live IMDb par depend karte hain. Yani:

- **Online** (asli visitors): sab pages bhar jate hain.
- **Offline / IMDb down**: 70,000+ pages "data pending" dikhate hain (noindex, magar phir bhi thin).

Do hal hain:

| Option | Kab | Kya karta hai |
| --- | --- | --- |
| `SITEMAP_DATA_ONLY=1` | Jab aap quality chahte hain | sirf bhare hue titles list karta hai (17k) |
| Full pool | Jab IMDb reliably chalta ho | 86k titles, sab indexed |

Sach yeh hai: **500,000 URLs ka target sirf URL count se nahi aata** — uske liye IMDb ke official
datasets (`title.basics.tsv.gz`) se id pool barhana parta hai, aur har page ke peeche data hona
chahiye. Warna Google 500k mein se 480k ko "thin" keh kar chhor deta hai.

## Har hafte ka 5-minute routine

```bash
npm run check && npm test
node scripts/build-imdb-seed.mjs
# deploy
curl -s https://mizanora.vercel.app/sitemap-index.xml | grep -c "<sitemap>"
curl -s https://mizanora.vercel.app/sitemaps/titles-2026.xml | grep -c "<loc>"
```

## Aam ghaltiyan

- **Sitemap mein noindex pages** — ulta signal. Pehle noindex hatao ya sitemap se nikaalo.
- **500 error wale sitemap** — Search Console "Couldn't fetch". Har file 200 + valid XML ho.
- **Khali file** — 0 URLs wala sitemap warning deta hai. Isi liye songs files sirf tab list hoti
  hain jab mirror jawab de.
- **lastmod jhoot** — har file par aaj ki date dalna Google ko bewaqoof nahi banata, woh ignore karta hai.
- **Canonical ghalat** — `http`, `www` ya purana domain.

Aage padhein: [coverage ka sach](/blog/mizanora-empty-pages-coverage-truth) · [Sitemaps guide page](/sitemaps) · [sab articles](/blog/author/muaaz-iqbal).
