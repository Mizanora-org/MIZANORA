# Mizanora v14 — FINAL: clean shop, price lock, team profiles, account, loading, SEO

This is the "no errors left" release. It fixes the empty/blank product cards you showed in the screenshot, stops the CSV
import from ever changing an existing price, adds the public team page (founder + workers), a real account/profile area,
beautiful loading screens everywhere, and new blogs + faster search-engine discovery.

Checked before shipping: `node scripts/check.js` → **248 files, 0 problems** · `node scripts/typecheck.js` → clean ·
`next build` → **90 pages** · real production server smoke test on an archive with **no Firebase at all** (home, browse,
search, for-you, sitemap, Google/Meta feeds, product page, /team, /account, /worker, /blog, admin pages).

---

## 1. THE PHOTO FIX (your screenshot: blank cards)

Rule now: **a product whose photo does not load is never shown on the shop.** Three layers make this certain:

1. **In the visitor's browser** — `components/CardPhoto.js` (new). If the image fails for *that* phone (slow network,
   hotlink blocked, 404), the whole card marks itself dead and CSS removes it (`[data-card][data-dead]` in `globals.css`).
   No grey box, no empty card — the grid simply reflows.
2. **On the server, before the page is ever built** — a product with no photo link at all is filtered out of
   home shelves (`getShopAll`), browse, search, category pages, "Aap ke liye", `/catalog.json`, the Meta feed,
   the Google feed and `sitemap.xml` (`lib/catalogQuery.js` → `hasPhoto`, `lib/products.js`, `app/sitemap.js`,
   `app/api/for-you/route.js`).
3. **In the admin panel** — **Admin → Catalogue (files) → “Check photos in this list”** (new). It checks the main photo of
   every product you are viewing (30 links per request), lists exactly which ones are broken and why, and then
   **“Hide N broken product(s)”** hides all of them in **ONE commit** (new `hideMany` action — never N commits).
   Hidden products stay in the archive files so you can fix or re-photo them later.

**Also fixed (bug found while testing):** hidden products (`active:false`) were skipped only on the home page, not in
browse/search, because the archive reader tested a field name that no longer exists. `lib/archive.js` now checks the
real field — hidden products are gone from **every** public list, feed and the sitemap. New safety net in
`lib/catalogQuery.js` (`hasPhoto` also refuses `active === false`).

## 2. PRICE LOCK — your CSV can never change a live price

* Import page has a new checkbox, **on by default**: *“Price lock: keep the price of products that already exist
  (only new products take the CSV price)”*.
* **Archive mode**: the server reads the existing cards (newest parts first, slim files only) and overrides the price of
  every product that already exists *before* writing the new part. The reply tells you: “N product(s) already existed,
  so their price was NOT changed (price lock)”. Zero Firestore reads.
* **Firebase mode**: existing prices are read (30 ids per query) and kept; the final message reports how many prices
  were locked.
* So: upload the same CSV again, or an export you edited — **existing products keep the price that is live on the shop**.
  Only genuinely new products get the CSV price. If you *want* to change a price, edit it in Admin → Catalogue (files)
  or Admin → Products; the import will not do it by accident any more.

## 3. Public TEAM page + profiles (`/team`) — credits done properly

* **`app/team/page.js`** (new): a real public page with the founder card — **Muaaz Iqbal, Founder & Developer** (what he
  built: the whole web app, assistant Noor, the worker programme, the zero-Firebase catalogue) — plus the team roles
  (support, dispatch, workers programme, quality/photos, developers, community) and the **worker profiles** section.
* **Worker profiles are opt-in.** A worker opens their dashboard → **“Public profile (team page)”** → turns it on and
  writes name, city, a line about themselves, optional photo link (`app/api/worker/myprofile/route.js`, new). The public
  page reads only those fields — **never CNIC, phone, address, payout account or earnings** (the API strips everything).
* Credits everywhere: footer card + link, About page section, every blog post now shows **“By Muaaz Iqbal, Founder & Developer”**,
  and the JSON-LD (`Organization.founder` + `Person`) tells Google who built the store.
* `/team` is in `sitemap.xml` and in the footer “Company” column.

## 4. ACCOUNT / SESSION / PROFILE — everything in one place

* **New account header card** (signed-in): avatar with your initials, name, email, how you signed in (Google / email),
  member since, last sign-in date, and live counters (wishlist items, saved addresses, orders).
* **Profile tab rewritten**: edit your **name and phone** (saved to your account and used on orders and reviews),
  **change password by email link**, wishlist and track-order shortcuts, sign out — plus a session note for shared phones.
* Every "Loading..." text replaced with **shimmer skeletons** (no bare text, no jumping layout).

## 5. Loading screens and smoothness (every page)

* New skeletons: `ListSkeleton` (listing pages), `ProductSkeleton` (product page), plus the blog loader —
  `app/products/loading.js`, `app/product/[slug]/loading.js`, `app/category/[slug]/loading.js`, `app/blog/loading.js`.
* Cards still carry **no per-card JavaScript** (the global listener system stays), so a 150-card page scrolls and taps
  exactly as before; the archive is read from memory (zero Firestore reads) and lists are cached for 2 minutes.
* The branded splash + ring loader (v12/v13) is untouched and still respects `prefers-reduced-motion`.

## 6. Home page — beautiful + new marketing strip

* New **“Earn with us”** section on the home page (commission numbers, join button, link to the team page) — this is the
  marketing block that also feeds the worker programme.
* Archived (CSV/file) products keep appearing on all home shelves (v13) — now **only the ones with working photos**.

## 7. SEO: faster discovery, better data

* **IndexNow** (`lib/indexnow.js`, new): after a catalogue edit, a bulk hide or an archive commit, the shop pings
  Bing/Yandex/Seznam/Naver with the changed URLs so they are indexed in minutes instead of weeks. Just set
  `INDEXNOW_KEY` (16–64 letters/numbers) in Vercel; the ownership file is already served at `/api/indexnow-key`.
  Google continues to use `sitemap.xml` (90 pages, all products, categories and blogs).
* New blogs default to **author Muaaz Iqbal** with `Person` author data in the article JSON-LD.
* `Organization` JSON-LD now includes the **founder**, and `knowsAbout` for the store's specialities.

## 8. New blog posts (37 total)

Long, keyword-focused, all internal-linked and CTA-ended (each links `/team`, `/workers` or the shop):

| Slug | Target keyword style |
| --- | --- |
| `online-shopping-2026-pakistan-guide` | online shopping Pakistan 2026 |
| `worker-bank-ya-part-time-online-earning-pakistan` | online earning / commission work |
| `trust-online-store-kaise-pehchane-pakistan` | fake online shop / trust |
| `eid-sale-ki-tayyari-pakistan-tips` | Eid sale / online shopping plan |

---

## 9. Install (5 minutes)

1. **Deploy** this folder to your Vercel project (as usual).
2. Make sure these are in Vercel → Settings → Environment Variables:
   * `GITHUB_TOKEN` + `GITHUB_REPO` → to save/edit products in `data/catalog` (Contents: Read and write).
   * `FIREBASE_DATABASE_URL` → assistant taste memory.
   * Your existing Firebase web + service account keys → orders and the panel.
   * *(Optional but recommended)* `INDEXNOW_KEY` (16–64 letters/numbers) and `HOME_WINDOW` (default 4000).
3. **Clean the blank cards you saw:** Admin → **Catalogue (files)** → search or open the part → **Check photos in this list**
   → **Hide N broken product(s)** (one commit, zero Firebase). The same fix also runs on every future import.
4. **Import a CSV again** to see the price lock: existing products keep their live price, the panel tells you how many.
5. Open **`/team`**, turn on your own worker profile from **/worker**, and check `/account` for the new header card.

### Checklist after deploy
- [ ] No blank/empty product cards anywhere (home, category, search).
- [ ] Hidden or photo-less products do **not** appear in browse, search, sitemap or feeds.
- [ ] Re-importing your CSV does not change any existing price.
- [ ] `/team` shows Muaaz Iqbal as Founder & Developer, and worker profiles appear only after opt-in.
- [ ] `/account` shows the new header card, editable profile and skeletons while loading.
- [ ] `/api/feed/google` and `/sitemap.xml` still list your products (only those with working photos).

## 10. Files in this upgrade

**New:** `app/team/page.js`, `lib/team.js`, `components/CardPhoto.js`, `components/SafeImg.js`,
`components/WorkerPublicProfile.js`, `app/api/worker/myprofile/route.js`, `lib/indexnow.js`,
`app/products/loading.js`, `app/product/[slug]/loading.js`, `app/category/[slug]/loading.js`, `app/blog/loading.js`,
4 new blog posts, this file.

**Edited:** `components/ProductCard.js`, `app/globals.css`, `lib/catalogQuery.js`, `lib/products.js`, `lib/archive.js`
(hidden-product bug fix), `lib/seo.js` (founder + Person), `app/sitemap.js`, `app/about/page.js`, `components/Footer.js`,
`app/blog/[slug]/page.js`, `lib/blog.js`, `components/AccountClient.js`, `components/WorkerClient.js`,
`components/PageLoader.js`, `app/admin/import/page.js` (price lock), `app/admin/catalogue/page.js` (photo check),
`app/api/admin/archive/route.js` (price lock + IndexNow), `app/api/admin/archive-edit/route.js` (`hideMany` + IndexNow),
`app/api/for-you/route.js`, `content/blog/*.md`, `.env.example`, `package.json` → **14.0.0**.

## 11. Honest notes
* A photo that breaks *later* is caught in the visitor's browser (card removed) — the admin photo check is what fixes the
  catalogue itself, so run it once after every big import.
* Worker profiles on `/team` are cached for 5 minutes (`revalidate = 300`), so a change can take a few minutes to appear.
* IndexNow helps Bing/Yandex immediately; Google picks changes up from the sitemap on its own schedule.
* Orders, checkout, cart and payment behaviour are unchanged in this release.
