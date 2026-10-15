# MIZANORA Store: Setup Guide (Next.js + Firebase + Vercel)

## 0. Replace the old site in GitHub
1. In your GitHub repo, delete the OLD files: `public/`, `static/`, `content/`, `build.js`, `config.js`, `vercel.json`, `README.md` and the files inside `.github/workflows/` (the old bot workflows).
2. Upload ALL files from this zip to the repo root (use a PC or GitHub Desktop; the phone browser skips hidden files like `.gitignore`).
   You should see `app/`, `components/`, `lib/`, `public/`, `content/`, `package.json`, `next.config.js`, `vercel.json`, `firestore.rules` at the top level.

## 1. Firebase (free Spark plan)
1. console.firebase.google.com > Add project (turn Google Analytics off).
2. **Firestore Database** > Create database > Production mode > pick a region (asia-south1 Mumbai is closest to Pakistan).
3. **Authentication** > Get started > Sign-in method > enable **Email/Password** AND **Google** (choose a support email, Save).
4. Authentication > Users > **Add user**: your admin email + a strong password (for the email login). Copy the **User UID**. If you only want Google login you can skip this user.
5. Authentication > Settings > User actions > keep **"Enable create (sign-up)" ON**. Customers now create accounts. Admin power comes ONLY from your UID/email in firestore.rules, so customers can never see admin pages or other people's orders.
6. Firestore > Rules: paste the contents of `firestore.rules`, replace `PASTE_ADMIN_UID_HERE` with your UID and `PASTE_ADMIN_EMAIL_HERE@gmail.com` with your Google admin email, click **Publish**. (Google login works through the email line, email login works through the UID line.)
6b. Authentication > Settings > **Authorized domains** > Add `mizanora.vercel.app` (and later `mizanora.store`). Google login fails without this.
7. Project settings (gear) > General > Your apps > Web (`</>`) > register app > copy `apiKey`, `authDomain`, `projectId`, `appId`.
8. Project settings > **Service accounts** > Generate new private key. Open the JSON: you need `client_email` and `private_key`.

## 2. Vercel
1. vercel.com > your project > Settings > Build and Development Settings: Framework Preset **Next.js**. **Turn OFF every override** (Build Command, Output Directory, Install Command must show the defaults).
2. Settings > Environment Variables. Add (see `.env.example`):

| Name | Value |
|---|---|
| NEXT_PUBLIC_SITE_URL | https://mizanora.vercel.app (later https://mizanora.store) |
| NEXT_PUBLIC_WHATSAPP_NUMBER | 923062015326 |
| NEXT_PUBLIC_SHIPPING_FEE | 250 (flat delivery charge for every order) |
| NEXT_PUBLIC_FIREBASE_API_KEY / _AUTH_DOMAIN / _PROJECT_ID / _APP_ID | from step 1.7 |
| NEXT_PUBLIC_ADMIN_EMAIL | your admin email(s), separated by commas, same as in the rules |
| FIREBASE_CLIENT_EMAIL | `client_email` from the JSON |
| FIREBASE_PRIVATE_KEY | `private_key` from the JSON, in double quotes, keep the `\n` |
| ADMIN_UID | the admin User UID (only needed for the email login) |
| IMGBB_API_KEY | your ImgBB API key (secret, Vercel only). Lets /admin upload photos from your gallery |
| NEXT_PUBLIC_ANNOUNCEMENT | optional text for the gold bar at the top of every page |
| NEXT_PUBLIC_META_PIXEL_ID | your Pixel ID |
| META_CAPI_TOKEN | Events Manager > Settings > Conversions API > Generate access token |
| NEXT_PUBLIC_GSC_VERIFICATION | Search Console HTML-tag code (only the content value) |
| NEXT_PUBLIC_FACEBOOK_URL | your Facebook page link |

3. Deployments > Redeploy. Any `NEXT_PUBLIC_*` change needs a redeploy.

## 3. Test the whole flow (do this before ads)
1. Open `/admin`, sign in, go to **Products**, click "Add a sample product" or add your own (price, photo links, sizes).
2. Open the product on the site > Order now > fill the form > Place order. You land on the thank-you page.
3. In `/admin/orders` the order appears live. Change status, tap "WhatsApp customer", tap "Export CSV".
4. Product photos: in /admin/products tap **Upload photos**, pick pictures from your gallery, then Save. Photos are shrunk automatically and stored on ImgBB. You can still paste image links instead.

## 3b. Make it look like a market (banners, categories, deals)
- **Categories** appear automatically from the "Category" field of your products (menu bar, home page circles and `/category/...` pages). Use the same spelling for products in one category.
- **Hot deals** show products that have an "Old price" higher than the price. **Top picks** show products with "Featured on home" ticked.
- **Banners:** `/admin/banners` > paste a wide image link (about 1600 x 640 px) > Save. Several banners slide automatically.
- **WhatsApp is support only:** customers order on the website. The green Support button, Contact page and "Chat with support" links open your WhatsApp number. In `/admin/orders` the "WhatsApp customer" button is for you to message customers.

## 4. Meta Pixel and Conversions API
1. Events Manager > your Pixel > **Test events**. Copy the test code into `META_TEST_EVENT_CODE`, redeploy, browse the shop, place a test order.
2. You should see PageView, ViewContent, AddToCart, InitiateCheckout and Purchase. Purchase and the others appear twice (Browser + Server) and show as **Deduplicated**.
3. Remove `META_TEST_EVENT_CODE` when done, and redeploy.
4. Install the "Meta Pixel Helper" Chrome extension to double check.

## 5. Domain (mizanora.store from Namecheap)
1. Vercel > Settings > Domains > Add `mizanora.store` (and `www`). Vercel shows the exact DNS records.
2. Namecheap > Domain List > Manage > Advanced DNS: add the records Vercel shows (usually an A record for `@` and a CNAME for `www`). Wait for "Valid configuration".
3. Set `NEXT_PUBLIC_SITE_URL=https://mizanora.store` and redeploy. Make `mizanora.store` the primary domain.

## 6. Google Search Console
1. Add the property (URL prefix with your final domain). Verify with the HTML tag (`NEXT_PUBLIC_GSC_VERIFICATION`) or DNS.
2. Sitemaps > submit `sitemap.xml`.
3. URL Inspection > Request indexing for `/`, `/products`, each product page, `/blog` and each blog post.
4. Test a product page in the Rich Results Test (search "Google Rich Results Test"). It should show a valid **Product** item.
5. Check "Pages" (indexing) weekly. `/cart`, `/checkout`, `/thank-you`, `/admin` are intentionally `noindex`.
6. When you move to a new domain, add the new property and keep the old one for a while.

## 7. App install (PWA)
- Android Chrome, Edge, Samsung Internet and desktop Chrome: after about 7 seconds the site shows an "Install the Mizanora app" banner. Install buttons also appear in the menu, after Add to cart and on the thank-you page. If someone closes the banner, it asks again after 3 days.
- iPhone: browsers do not allow an install button. The banner shows "Share > Add to Home Screen" instructions.
- A website cannot force an install. Browsers only allow the install window after a user tap.
- Test: Chrome DevTools > Application > Manifest, and Lighthouse > PWA.

## 8. Things to know
- **HHC / courier CSV:** column names are in `lib/csv.js` (`CSV_COLUMNS`). Compare with the sample upload sheet from HHC, Trax or Leopard and rename or reorder columns there.
- **Vercel Hobby plan:** Vercel's rules limit Hobby to personal, non-commercial use. A real store is commercial, so check their current fair-use policy; you may need Vercel Pro, or host on another provider.
- **Orders are protected:** browsers cannot create, read or change orders. The server creates them and calculates prices from your database, so nobody can edit prices in the browser.
- Firebase Storage is not used (it needs a paid plan now), so images are links.
- Local run: `npm install`, copy `.env.example` to `.env.local`, then `npm run dev`.

## 9. What changed in this update (read this first)
- **Products now always show.** The shop reads products with the Admin key if it works, and otherwise straight from Firestore's public REST API (only the NEXT_PUBLIC_FIREBASE_* values are needed). New products appear within about a minute.
- **Open `/api/health`** on your site. It tells you with yes/no flags what is missing in Vercel (IMGBB_API_KEY, Firebase keys, Meta Pixel) and how many products the shop can see. The same warnings show at the top of `/admin`.
- **Photo upload and admin checks** no longer need ADMIN_UID. The server asks Firestore itself whether you are the admin (same rules as orders). You only need `IMGBB_API_KEY` in Vercel, then Redeploy. Your UID or Google email must be in `firestore.rules` and published.
- **Sign-in errors** now show the exact reason (for example unauthorized domain, wrong API key, method switched off) and how to fix it. Inside Facebook/Instagram browsers Google sign-in uses redirect; open /admin in Chrome if it still fails.
- **Meta:** Graph API default is now v26.0 (current). Meta product catalog feed: in Commerce Manager > Catalog > Data sources > Data feed, use `https://YOUR-DOMAIN/api/feed` with a daily schedule. Feed ids equal the product slug, the same ids the Pixel sends, so catalog ads match.
- **Blog:** add a new post any time by adding a `.md` file in `content/blog/` (copy any existing file for the format) and commit it.
- **Departments:** the home page shows starter departments (Footwear, Men Fashion, Mobile Accessories, ...). Use the same name in a product's Category field and it becomes a real category with its own shelf.

## 10. NEW: customer accounts, bills, coupons, reviews, videos (do these steps)
1. **Publish the new Firestore rules (important).** Open `firestore.rules`, put YOUR admin UID and Google email where it says PASTE_ADMIN_UID_HERE / PASTE_ADMIN_EMAIL_HERE, then Firebase Console > Firestore > Rules > paste > Publish. Without this, saved addresses, order history, coupons and reviews will show a "rules" message.
2. **Turn on Email/Password and Google** in Authentication and add your domain under Authorized domains.
3. Redeploy on Vercel.

What customers get:
- **Account** (`/account`): sign in with Google or email, saved addresses (Home/Work/Other + default), order history with full bills, order again, wishlist link. Guests can still order without an account.
- **Order confirmation + bill:** after ordering, a full bill (items, quantity, line totals, coupon discount, delivery, total to pay), print / save as PDF, and progress (Order placed > Confirmed > On the way).
- **Track order** (`/track`): order ID + phone number, no account needed.
- **Wishlist** (heart on cards and product pages), **recently viewed**, **search suggestions** that forgive spelling mistakes.
- **Share and copy product link** on every product page, and a share button on every product card.
- **Reviews:** signed-in customers can review a product. Reviews are hidden until you approve them in `/admin/reviews`. Approved reviews add star ratings for Google.

What you get in /admin:
- **Coupons** (`/admin/coupons`): percent or flat, minimum order, maximum discount, expiry, use limit.
- **Reviews** approval, and **sales stats** (orders today, pending, sales, average order) at the top of Orders.
- **Videos:** in a product, paste YouTube / Facebook / Instagram reel / TikTok / .mp4 links (one per line). They play on the product page and appear in "Watch and shop" on the home page.

Meta extras: events Search, AddToWishlist, CompleteRegistration and Contact are sent (browser + server). Logged-in customers improve match quality. Optional env `NEXT_PUBLIC_FB_DOMAIN_VERIFICATION` adds the Meta domain-verification tag. Product pages carry Facebook product tags (price, availability).

## 11. NEW: product options, mobile fixes, smart search
- **Options for every category.** In Admin > Products, choose the Category and tap the suggestions: Footwear gets Size + Color, Women Fashion gets Color + Size + Fabric details, Electronics gets Color + Storage + Warranty, Beauty gets Shade + Volume, Grocery gets Weight + Pack, and so on. Write options one per line like `Color: Red, Blue, Black` and `Size: S, M, L`. Colour names show as colour dots. Shoppers must pick every option before ordering. The chosen label (for example `Baby Pink / M`) is saved on the order and the bill.
- **Product details** (Material, Brand, Warranty, Dimensions ...): one per line like `Fabric: Katan silk`. They appear as a details table on the product page and help Google.
- **Old products** that only had sizes keep working. They become an option called Size.
- **Screen no longer spreads sideways, and pinch-zoom is off.** (Zoom is disabled on purpose, as requested.)
- **Admin on phone:** the products list and the add/edit form are now separate screens with a Back button. Photo upload has a Photos button (opens the gallery picker) and a Camera button. Some phones (for example Oppo/Realme) open their Files app for the Photos button; choose Photos/Gallery on the left of that screen. Videos cannot be uploaded to ImgBB: upload to YouTube/Facebook and paste the link.
- **Smart search** understands English, Roman Urdu and Hindi, colours and prices: `laal suit 2000 se kam`, `black joota under 5k`, `sasta watch`. It tolerates spelling mistakes. No key needed.
- **Optional AI search (Google Gemini):** get a free key at https://aistudio.google.com/apikey and add `GEMINI_API_KEY` in Vercel, then Redeploy. Optionally set `GEMINI_MODEL` (default `gemini-flash-latest`). When the normal search finds nothing, Gemini rephrases the sentence into keywords and filters. Without the key nothing breaks.

## 12. Order placing fixes
- The anti-spam limit now counts only orders that were really placed, so mistakes, coupon tries and test attempts can no longer show "Too many orders".
- Checkout has a "Review and confirm" sheet: items, address and total to pay, with Edit and Place order. After ordering, an animated confirmation shows the Order ID, the amount to pay, and what happens next.
- The shop tells the browser it is a light-theme site, so phone "force dark mode" no longer turns it black.

## 13. If orders fail ("We could not place your order")
Open `https://YOUR-SITE/api/health`. Look at `ordersCanBeSaved` and `ordersProblem`. The same message shows at the top of /admin.
The usual cause is a wrongly pasted `FIREBASE_PRIVATE_KEY` in Vercel. The easy fix: in Vercel add ONE variable `FIREBASE_SERVICE_ACCOUNT` and paste the **whole contents** of the downloaded service-account `.json` file (Firebase > Project settings > Service accounts > Generate new private key). Then Redeploy. The old two variables can stay or be removed.

## 14. Reels (watch and shop)
- **Admin > Reels > Add reel.** Paste a YouTube Short, Facebook reel, Instagram reel, TikTok or .mp4 link, give it a title, and choose the product. Shoppers see it in "Reels: watch and shop" on the home page and on `/reels`. Tapping opens it full screen with a **Shop now** button (goes to the product), a price, share, and up/down buttons (or swipe on the left edge of the screen) for the next reel.
- Videos you already added inside products appear in Reels automatically.
- **Publish the updated `firestore.rules`** again (it now has a `reels` section).
- Facebook, Instagram and TikTok only play if the original post is public and allows embedding. If one will not play, the viewer has an "Open original" button.
