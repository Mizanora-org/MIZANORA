# Mizanora v10: 50,000+ products on the free Firebase (Spark) plan

## Why orders and workers broke
The free Spark plan allows **50,000 reads and 20,000 writes per day**. The old design read every product from Firebase on each refresh and
wrote 2 documents per imported product, so a big import or a few admin saves used the whole day's quota. When the quota is gone, orders fail
and the worker product list is empty. Open `/api/health`: it now tests a real write and tells you if the quota is the problem.

## The new design: live products in Firebase, old products in JSON files
* New / edited products stay in **Firebase** (small, editable).
* Old products live as **JSON files in your repository** (`data/catalog/`): zero reads, zero writes. 500 products per file, any number of files
  (`manifest.json` lists them). Slim "cards" of all files load once for lists and search; the full product is read from its file only when opened.
* Search, categories, price filters, workers' list, assistant, orders, sitemap and Google feed all see live + archived products together.
  A live product always replaces an archived one with the same id.
* Supplier cost and profit are never written to the files.

## Using it (Admin > Archive)
1. Vercel > Environment Variables: `GITHUB_TOKEN` (fine-grained, this repo only, Contents read/write), `GITHUB_REPO` (owner/name), optional `GITHUB_BRANCH`. Redeploy.
2. **Save to my repository**: the oldest N live products become the next file (one commit, one deploy). Without GitHub use "Download the files" and upload the 3 files to `data/catalog` on GitHub.
3. Wait until Vercel finished deploying, press **Clear part N from Firebase**. It refuses while the part is not live, deletes only that part's products, and keeps anything you edited after archiving.
4. To edit an archived product: Admin > Archive > search > **Copy to Firebase**.

## Big CSV (50,000 rows)
Admin > Import: files over 2,000 products default to **Save to archive**: files are built in 500-product parts and committed once. Or import to Firebase
in daily pieces with *Start at* / *Import how many* (the page shows the number of writes).

## Other changes
* **Pricing**: cost up to Rs 100 = profit Rs 2 to 30, up to Rs 500 = Rs 100, bigger items Rs 200 to 500 (editable table). Prices round up only.
* **Re-price** (Admin > Import, bottom): applies the table to live products with a saved cost.
* **Broken photos**: a photo that fails to load is checked by the server itself; broken ones are removed, a product with no working photo is hidden and listed in **Admin > Photo errors** (fix link, re-check, show, delete, scan all).
* **Gemini**: `AQ.` keys now work (the dot was rejected before); paste several keys at once. A model ladder (lite model first) and per key+model cool-downs, answers cached 24 h on the server and 7 days in the browser, the assistant answers plain searches itself without Gemini and falls back to shop search when Gemini is resting.
* Deals on imported products can never go below cost (`dealRoom`).

## Honest limits
* Archive files change only by a commit (about 1 to 3 min to go live). Archived stock/price are fixed until you copy the product to Firebase.
* Keep live Firebase products around 1,000 to 2,500: each admin save refreshes that list (one read per live product).
* A very large archive (50k) keeps about 15 MB of cards in each server instance's memory: fine on Vercel's default 1 GB.
