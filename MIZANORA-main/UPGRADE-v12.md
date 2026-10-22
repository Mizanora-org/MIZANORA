# Mizanora v12 - Admin panel upgrade (professional panel + connection tests + product search)

Scope of this upgrade: **the admin panel only**. The shop (home, products, cart, checkout…) is unchanged in behaviour and look.
Everything below was checked with `node scripts/check.js` (235 files, 0 problems), `node scripts/typecheck.js` (clean) and a real
`next build` (all 17 admin routes built, production server smoke-tested).

---

## 1. What is new

### A. A real panel layout (desktop sidebar + phone drawer)
* **`components/AdminNav.js`** (new) - the panel now has a proper sidebar with five groups
  (Overview / Catalogue / Selling / Content / System), short descriptions under every name, active highlight,
  a "Go to" jump list and the signed-in admin at the bottom (Open shop / Sign out).
* On phones the same menu opens as a drawer from a slim top bar, plus a row of quick chips
  (Dashboard, Products, Import CSV, Orders, Connections) that stay reachable while scrolling.
* The old row of 14 inline pills is gone. `app/admin/page.js` now opens on **Dashboard** (numbers first).
* Login screen and the Firestore-rules based admin check are unchanged in behaviour
  (same check, now remembered for 15 minutes per browser session so every admin page does not pay that read again).

### B. One search box for the whole panel
* **`lib/adminSearch.js`** + **`components/AdminSearch.js`** (new) - the search box in the sidebar filters the page that is open.
* Smart matching: word-by-word (AND), case-insensitive, slug + category + price included,
  and **phone numbers work in every spelling** ("0300 1234567", "03001234567", "3001234567" all find the same order).
  Urdu letters are supported (diacritics are stripped).
* **Products page**: the list filters as you type, best match first, with "N of M match" and a **Show more**
  button (only 80 rows are drawn at a time so a 5,000-product list cannot freeze a phone).
* **Orders page**: the same box now searches order id, name, phone, city, province, promo code **and product names inside the order**.

### C. Product search inside the ARCHIVE (the "CSV -> DATA/CATALOG" link)
* **`app/api/admin/product-search/route.js`** (new) - searches the old products that live as JSON files in your repository
  (`data/catalog/*.json`), newest part first, reading only the slim `cards-*.json` files and stopping early, so a
  50,000-product archive answers in a second or two with **zero Firestore reads**.
* Products page: **"Search the archive too"** button - shows archived hits with photo, price, categories and part number,
  then **Restore** copies one back into Firebase (and revalidates the shop) so you can edit it normally.
* This is why the CSV pipeline (Admin > Import CSV -> 500-product parts -> GitHub commit into `data/catalog`) can now be
  searched from the panel: live products in the browser, archived products on the server, one screen.

### D. Admin > Connections - REAL tests of Firestore, Realtime Database and GitHub
* **`app/api/admin/connections/route.js`** + **`app/admin/connections/page.js`** (new).
* Every test really talks to the service and reports milliseconds, the project id and a plain-language fix when it fails:
  1. **Firestore (server key)** - writes, reads and deletes one tiny `_health/conn` document, then counts your products.
  2. **Firestore (web/browser key)** - checks the public REST path used when the server key is missing.
  3. **Realtime Database (server key)** - write / read / delete through the Admin SDK (visitors, counters, order backup, kill switch).
  4. **Realtime Database (public REST)** - the copy the website reads first, so the shut-down switch also works on a day
     the Firestore quota is finished.
  5. **GitHub** - non-destructive: repo exists, token valid, branch exists, **can the token write?** (Contents: Read and write).
     Nothing is committed by the test.
* A verdict banner at the top (healthy / partial / broken), and a CSV-import card that says honestly what the import can do
  right now: archive mode (GitHub connected) or Firebase mode, with buttons to Import CSV / Convert / Archive.
* Bottom table: every environment variable this deployment found, green dot when set, red when missing -
  values are never shown for secrets.

### E. Smaller things
* The shop **footer and the WhatsApp button now live inside `<main>`** and are hidden on `/admin` (new `components/HideOnAdmin.js`),
  so no storefront chrome sits under the panel. Public pages and printing are unchanged (`no-print` is kept on both).
* `lib/github.js`: new `ghTest()` used by the Connections screen.
* `package.json` version `12.0.0`.

---

## 2. How to install this upgrade (2 minutes)

1. Unzip the archive over your project folder (same names, files are replaced - nothing else to configure).
2. `npm install` (only if you build locally), then push to GitHub. Vercel deploys automatically.
3. Open `/admin` -> **Connections** -> press **Test again**. You will see at a glance whether Firestore,
   Realtime Database and GitHub are wired correctly, and exactly what to paste in Vercel if something is red.
4. Recommended Vercel variables for the full feature set (nothing new is required by this upgrade):
   * `FIREBASE_SERVICE_ACCOUNT` (or `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`) - orders + admin saves
   * `FIREBASE_DATABASE_URL` / `NEXT_PUBLIC_FIREBASE_DATABASE_URL` - only if your Realtime Database address is not
     `https://PROJECT-default-rtdb.firebaseio.com`
   * `GITHUB_TOKEN` + `GITHUB_REPO` (+ optional `GITHUB_BRANCH`) - unlocks CSV-to-archive and archive search
   * `IMGBB_API_KEY` - photo upload

## 3. Using the new panel

| I want to... | Where |
| --- | --- |
| See today's numbers | Dashboard (opens by default) |
| Check if everything is connected | Connections (green/red, with fixes) |
| Find a product | Sidebar search box, or Products page -> "Search the archive too" |
| Find an old product that is not in Firebase | Products -> search -> "Search the archive too" -> Restore |
| Import a supplier CSV | Import CSV (2,000+ products switch to archive mode automatically) |
| Find an order by phone | Orders -> search box: type `0300 1234567` |
| Shut down / high alert | Control room |

## 4. Honest limits

* Archive search reads the `cards` files from GitHub, so it needs `GITHUB_TOKEN` + `GITHUB_REPO` on the deployment;
  without them the button explains that instead of failing silently. One search reads up to 12 part files
  (6,000 products) and stops early - increase `maxParts` in the API body if you want it to dig deeper.
* Restore brings ONE product back into Firebase; that costs 1 write and refreshes the shop cache.
* The Connections test writes and deletes one tiny `_health/conn` document per run in Firestore and the Realtime Database
  (so it needs those to be writable); GitHub is only read.
* The search box keeps its text while you move between admin pages (by design: it filters whatever you open).
  Press the small ✕ or "clear" to reset it.
