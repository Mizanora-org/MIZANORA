# v36 — MUAZ IQBAL IS ON THE SITE (self-hosted photos) + A BLOG BUILT FOR 125 GUIDES

Two things were asked for: put Muaz Iqbal's pictures into the shop properly, and grow the blog
into the subjects that matter (his thinking, shopping, searching, and what is changing in the
world). Both are done, and a set of real bugs found on the way is fixed.

---

## 1. The pictures: eight photos, self-hosted, three sizes each

**Before:** the only pictures of Muaaz Iqbal were two links to a third-party image host
(`i.ibb.co`). Those links can rot, they send a referrer, they can be hotlink-blocked, and
Google sees them as somebody else's images.

**Now:** the shop serves its own copies from `public/img/muaaz/`.

```
node scripts/muaaz-photos.mjs <folder-with-photos>
```

For every picture that script:

| step | what it does |
| --- | --- |
| strips EXIF | GPS coordinates, camera model and date are removed — a person's location must never ship to the public web |
| bakes rotation | the phone's orientation flag becomes real pixels, so nothing shows sideways |
| writes 3 sizes | `<id>.jpg` full (max 1200 px, q82) · `<id>-thumb.jpg` (max 480 px, q72) · `<id>-sq.jpg` (512×512 cover for avatars) |
| writes the manifest | `data/muaaz-photos.json` — real width/height (no layout jump) and the alt text (how Google Images understands a picture) |

Result: **8 photos, 24 files, 0.87 MB on disk**, EXIF verified gone from every file.

Re-running is safe and idempotent. Adding one more photo later: drop it in the folder, run the
command again.

### Where the pictures now appear

| surface | what changed |
| --- | --- |
| [`/muaaz-iqbal`](/../app/muaaz-iqbal/page.js) | a real gallery with a lightbox (click, arrow keys, Escape), `ImageGallery` + 8 `ImageObject` rows in the structured data |
| [`/team`](/../app/team/page.js) | the founder avatar uses the local square file, with the old links kept only as a fallback |
| `/sitemap.xml` | the 8 pictures lead the image entries — self-hosted first, old links after |
| `/muaaz-iqbal` (schema) | `image:` now points at a picture the shop actually serves |

The old links are **not deleted** — they are already indexed, and they remain as the last
fallback if the manifest is ever missing.

### New files

| file | what it is |
| --- | --- |
| `public/img/muaaz/*.jpg` | 24 optimised pictures (8 × full, thumb, square) |
| `data/muaaz-photos.json` | the manifest — **edit the titles and alt text here** |
| `lib/founderPhotos.js` | reads the manifest; `getFounderPhotos`, `founderAvatarPhotos`, `founderHeroPhoto`, `founderPhotoJsonLd`, `founderPhotoUrls` |
| `components/PhotoGallery.js` | the gallery + lightbox (keyboard, focus trap, scroll lock, reduced motion) |
| `scripts/muaaz-photos.mjs` | the pipeline |

---

## 2. Twenty new guides

| shelf | new guides |
| --- | --- |
| **Muaaz Iqbal — his thinking** (8) | the Mizan mindset (balance) · the zero-quota theory · the Urdu-first theory · unchi soch chhote qadam (small steps) · the compound builder theory · the trust-first theory · the AI orchestra theory · *Muaaz Iqbal ka dimaag kaise kaam karta hai* (Roman Urdu) |
| **Shopping** (3) | 11 mistakes Pakistanis make · buying electronics without getting a clone · cash on delivery vs advance payment |
| **Searching** (4) | *smart search ka tareeqa* (Roman Urdu) · search by price, not by name · Google search operators · voice search in Urdu |
| **2026 tech & world news** (5) | agentic commerce · what 170,000 Pakistani orders show · ACP / AP2 / TAP / UCP explained · five things that changed by 2026 · how small shops stay visible to AI |

The news guides are grounded in published research and say where the numbers stop: the
Salesforce holiday figures, Bain's 2030 projection, the Braze adoption survey, the
~170,000-order Pakistani dataset (94.5% COD, 1.6% prepaid, COD cancelling 13× more often) and
the State Bank's digital-payment volumes. Every projection is labelled as a projection, and
every article links to at least two others.

**The blog is now 125 guides** (was 105).

---

## 3. Bugs found and fixed

These were real, live bugs — not tidy-ups.

| # | bug | what it did | fix |
| --- | --- | --- | --- |
| 1 | **`{cta}` was never matched** | 22 guides (and every one of the 20 new ones) ended with a literal `{cta}` paragraph, and their call-to-action block never appeared. Only `{{cta}}` was recognised. | both spellings now work; the 20 new files were normalised to `{{cta}}` |
| 2 | **"Keep reading" was a lie** | `getPosts().filter(...).slice(0, 2)` — it showed the two *newest* posts, not related ones. Bad for readers and worthless for internal linking. | `relatedPosts()` scores by shared category + shared tags, then freshness |
| 3 | **local images could not be used in markdown** | the image rule only matched `https://` links, so `![alt](/img/...)` silently became a paragraph | relative paths work, with a path-traversal guard |
| 4 | **sitemap shipped `https://mizanora.vercel.app//img/...`** | `founderPhotoUrls(absUrl('/'))` double-joined the slash; Google drops malformed entries | the base is trimmed in both `founderPhotoUrls` and `founderPhotoJsonLd` |
| 5 | **sitemap shipped relative image URLs** | a guide with `image: /img/...` produced `<image:loc>/img/...`, which Google rejects | blog images are made absolute |
| 6 | **one broken markdown file killed the build** | `getPosts()` threw on bad front matter, so the whole site failed to compile | the file is skipped and reported |
| 7 | **duplicate slugs silently overwrote each other** | two files with the same slug: one just disappeared | detected, warned, skipped |
| 8 | **quoted front matter kept its quotes** | `title: "Hello"` rendered as `"Hello"` | values are unquoted |
| 9 | **/blog rendered 105+ cards on one page** | slow LCP and impossible to browse | paginated 24 at a time, with live search and category chips |
| 10 | **`test-v28` hard-coded the package version** | bumping to 36.0.0 broke an unrelated test | it now accepts any version from v28 on |
| 11 | **no tables in markdown** | a pipe table rendered as a pile of paragraphs | tables render, and scroll on phones |

---

## 4. New blog machinery

**`lib/blog.js`** — categories, tags, `relatedPosts()`, `getBlogCategories()`, `postCards()`,
`resetBlogCache()`, table support, `####` headings, horizontal rules, italics, safe link
filtering, and a `categoryOf()` that files the 105 older guides into a shelf from their words
(explicit `category:` wins when present).

Shelves: Shopping Guides 54 · Muaaz Iqbal 25 · Earning & Business 23 · Islamic 10 ·
Live TV & Reels 10 · Free Tools 3.

**`/blog`** — "New this week", the category shelves, then a paginated, searchable browser.
**`/blog/category/[slug]`** — six new static hub pages, each with `CollectionPage` data, so
Google has one address per topic instead of a single 125-item list.

A guide can now carry `category:`, `tags:` and `image:` in its front matter.

---

## 5. Getting it into Google

**Search Console cannot be driven from here — it needs a human signed in to Google.** What is
done instead is everything up to the paste:

```bash
node scripts/search-console.mjs              # writes out/search-console/
node scripts/search-console.mjs --ping       # also pings IndexNow (Bing, Yandex, Seznam, Naver)
node scripts/search-console.mjs --since 30   # only the last 30 days
```

It produces **141 pages in 15 daily batches of 10** (Google's URL Inspection limit is about 10
a day), a separate image list, and a `README.txt` with the four steps in order:

1. add the property → verify with the HTML tag (`NEXT_PUBLIC_GSC_VERIFICATION` in Vercel);
2. submit `sitemap.xml` and `blog/feed.xml`;
3. paste `day-01.txt` into URL Inspection, ten a day;
4. check *Page indexing* and *Core Web Vitals* weekly.

`out/` is gitignored — the lists are generated, not committed.

For the record: nothing here can log into Google, upload a photo to Google Images, or submit
to Search Console programmatically. Google deliberately has no unauthenticated submission API.
The sitemap is the automated path, and it is already correct — which is the part that makes the
rest work.

---

## 6. Tests

`node scripts/test-v36.mjs` — 15 checks: the 8 pictures exist in 3 sizes with real dimensions
and alt text; EXIF/GPS are gone; the library drops traversal and junk rows and returns `[]` on a
missing manifest; `/muaaz-iqbal`, `/team`, the sitemap and `next.config.js` are wired; the
gallery handles keyboard, focus, scroll lock and reduced motion; 125 guides with unique slugs;
categories; related posts are actually related; local images, captions, callouts and tables
render; a broken file cannot break the build; the hub pages are static and 404 properly; the 20
new guides have real metadata and link onwards; both scripts are in place.

`npm test` now runs 27 files. `npm run check` and `npm run build:offline` are green
(263 static pages, up from 237).

---

## 7. What is still yours to do

1. **Edit the alt text.** `data/muaaz-photos.json` — the pipeline wrote honest placeholders
   ("photo 01"). Say what each picture actually shows; that is what Google Images reads.
2. **Deploy.** `git push` → Vercel builds it.
3. **Search Console**, ten URLs a day, using `out/search-console/day-01.txt`.
4. **Optional:** set `INDEXNOW_KEY` in Vercel so Bing and friends are pinged automatically.
