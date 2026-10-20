# Mizanora v19 — bug fixes

1. **Reels ke upar header dikhna** — theek. Wajah: page ki fade animation (`.mz-page`, `animation ... both`) ek stacking layer bana deti thi, is liye full-screen reels header ke neeche phans jaate the. Ab animation `backwards` hai aur reels viewer `document.body` par portal ke zariye khulta hai (z-100), is liye header kabhi reel ke upar nahi aata.
2. **Images / posters load na hona** — product card, product gallery, thumbnails, worker list aur reels ke poster: pehle Next ka optimiser, na chale to browser seedha (no-referrer) photo load karta hai, phir hi card hataya jata hai.
3. **Phone par product ka buy bar** bottom tab bar ke upar chhup raha tha — ab tab bar ke theek upar hai.
4. **App background music** — phone par pehli tap se music shuru nahi hota tha (`touchstart/pointerdown` browser ke liye gesture nahi). Ab `touchend/pointerup/click` par unlock hota hai.
5. **Worker profit slabs** (`lib/workers.js` -> `PRICE_BANDS`): product Rs 1000 tak 10%, Rs 2000 tak 15%, Rs 3000 tak 20%, 3000 se upar 20% (`TOP_BAND_PCT`). Commission aur Elite worker ka apna profit (markup) dono isi slab se limit hote hain. Server, worker dashboard, /workers page sab isi se chalte hain.
6. **Worker apni qeemat aur market rate** — har level ka worker ab har product par apni *selling price* (shop price se shop price + band limit tak) aur *market rate* likh sakta hai. Market rate selling price se zyada ho to customer ko market rate kata hua + discount % dikhta hai; barabar ya kam ho to sirf price (koi discount nahi). Ye worker ke link se aane wale customer ko product page, cards (home/category/search), search suggestions, cart aur order mein lagta hai. Server order par qeemat dobara check karta hai.
7. **Dashboard mein "Max profit"** har product par likha hota hai (Rs aur %), aur batata hai ke commission 1% kyun hai: import ke waqt `affRate` shop ke profit ka ~35% par cap hota hai (`safeAffRate` in `lib/importProducts.js`), isliye kam profit wale product par commission chhota rehta hai; worker ka asli profit uski selling price se aata hai.
8. **9 naye blog posts**, `/blog/feed.xml` RSS, Bing verification env, music file ab pehle download nahi hoti (speed).

# v20 (Winter + Islamic feed + AI manager)

9. **Winter theme** is now the default (admin can change it without redeploy). Richer snow: flakes and soft dots, snowy hero, icy page tint; shown on more pages.
10. **Islami Feed** on the home page: ayat, hadees, dua, qaul (Arabic + Roman Urdu + reference), Hijri date, next Islamic occasion, namaz times for Kasur. Content: `lib/islamic.js`. Have a scholar check any text you add.
11. **Video links**: YouTube, Facebook, Instagram, TikTok, Vimeo, Dailymotion, Streamable, Google Drive, Dropbox, Cloudinary and any direct .mp4/.webm/.mov/.m3u8 link (Admin > Reels).
12. **AI speed**: lite model answers first (Admin > AI Assistant > Answer speed), shorter answers, voice starts with the first sentence and plays a little faster.
13. **Admin > AI Manager** (`/admin/ai`): tools for season, video feed, Islamic posts, products, tasks, web research, blog publishing. Risky actions need your Confirm. Every action is logged in Firestore `aiManagerLog`. Needs FIREBASE_SERVICE_ACCOUNT (and GITHUB_TOKEN for blog publishing).
14. **15 new blogs** (Muaaz Iqbal profile, Mizanora vs Daraz / Markaz / marketplaces, winter, halal trade, Noor AI, Kasur, reselling, students, Islamic feed). Team page shows Muaaz Iqbal's photos and WhatsApp number.

# v21

15. **Images and videos**: the Vercel image optimizer is now OFF by default (its monthly limit broke every photo once used up). Photos load straight from their host; every `<Image>` sends no referrer so hotlink-protected hosts work; broken video files show an "open video" button. To use the optimizer again set `NEXT_IMAGE_OPTIMIZE=1` in Vercel.
16. **Wishlist**: it only looked at Firebase products, so saved catalogue products never showed. Now `/api/wishlist-cards` finds a product anywhere; storage-blocked browsers still work; signed-in shoppers get their wishlist synced to their account (`users/{uid}.wishlist`).
17. **Account**: new "Security and devices" tab (this device, wishlist sync, sign out here, sign out everywhere via `/api/account/sessions`) and a member ID.
18. **AdSense**: the exact auto-ads script is in `<head>` of every page, plus the `google-adsense-account` meta and `public/ads.txt`. In AdSense > Sites > your site, make sure Auto ads is ON and add `/admin/*` to the excluded pages.
19. **Admin > Products**: one search box finds live AND catalogue-file products (the archive is searched automatically while you type). Archived products can be edited, hidden or marked sold out right there (written to the catalogue files, no Firebase).
20. **Owner pencils**: when you are signed in as the owner, a pencil shows on every product card and on product pages; it opens a pop-up editor (name, price, old price, categories, description, photos, videos, stock) and saves at once. A small pencil button (bottom-left) opens owner shortcuts.
21. **New pages**: /shipping, /size-guide, /islamic, /winter. **9 more blogs.**
