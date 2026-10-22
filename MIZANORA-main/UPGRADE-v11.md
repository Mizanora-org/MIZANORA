# Mizanora v11

## 1. Realtime Database (second free database)  -> setup 2 minutes
Firestore (free plan): 50,000 reads / 20,000 writes a day. The **Realtime Database** is a separate free database with its own limits
(1 GB stored, 10 GB download a month, no read/write counter). v11 puts everything that happens often and is small into it:
visitor tracking, live users, daily counters, the shut-down switch and a **backup copy of orders**.

1. Firebase Console > Build > **Realtime Database** > Create database (locked mode).
2. Rules tab: paste `database.rules.json` from this project, Publish.
3. Only if its address is not `https://PROJECT-default-rtdb.firebaseio.com`: add `FIREBASE_DATABASE_URL` and `NEXT_PUBLIC_FIREBASE_DATABASE_URL` in Vercel. Redeploy.
Without it the shop works as before; the dashboard just shows the setup steps.

## 2. Admin > Dashboard (new, first tab)
Live visitors now (and the pages they are on), visitors / page views / orders / sales / conversion / average order today,
graphs for the last 7 to 60 days and the last 24 hours, shopping funnel (viewed > cart > checkout > order), traffic sources, devices,
most viewed and most added-to-cart products, top searches and **searches with no result**, live order feed.
All numbers come from the Realtime Database: **zero Firestore reads**. Your own admin visits are not counted. Bots are ignored.

## 3. Orders keep coming in when Firestore is full
If Firestore says "quota used up", the order is still accepted (prices re-checked from the shop's own data), saved in the Realtime Database,
and the customer sees the normal confirmation. The Dashboard shows a yellow box with these orders and a **Move to orders** button for later.
Promo codes are not available during such a moment (the customer is asked to order without it). Worker commission of such orders is added by hand.

## 4. Shut-down switch works even when Firestore is full
The status (Admin > Control room) is now stored in both databases and read from the Realtime Database first.

## 5. Archive: download EVERYTHING as one ZIP, and delete
Admin > Archive > **Download ALL products as ZIP**: every live product (packed in files of 500) + optionally all older archive parts + a merged `manifest.json`,
already laid out as `data/catalog/...`. Extract into your repository, commit, deploy. Then **Delete them from Firebase now** (type DELETE) removes exactly those
products (products you edited after the download are kept). No GitHub token needed.

## 6. Admin > CSV converter (new)
Upload a product CSV from any platform (Markaz, Shopify, WooCommerce, HHC, a supplier sheet ...). Columns are guessed, you can change them,
photo links are found in any column, your profit table is applied, and you download a Mizanora CSV that Admin > Import reads directly.
It all happens in the browser.

## 7. Smaller things
* Search statistics moved from Firestore to the Realtime Database (fewer Firestore writes).
* The AI assistant keeps its saved settings and Gemini keys when Firestore cannot be read.
* Build no longer hangs when the Firestore quota is used up (circuit breaker, v10.1).

## Honest limits
* Visitor numbers are counters, not a full session recording. "Live now" = visitors whose page pinged in the last 90 seconds.
* The tracking counters can be written by anyone who knows the database address (the rules only allow "+1 per request" on counters),
  so a determined attacker can inflate numbers. They can not read or change anything else.
* Not tested here: a real `next build`, a real Firebase/GitHub/Gemini connection. After deploying open Admin > Dashboard and place one test order.
