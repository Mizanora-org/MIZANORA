# Mizanora v9: AI assistant, cheapest first, app feel

## 1. AI voice assistant (round button above WhatsApp)
- Tap the sparkle button: she greets in a female voice ("Mizanora mein main aapko deals ya cheezein dikha sakti hoon"), understands Urdu / Roman Urdu / English, by voice or text.
- She searches YOUR real catalogue (never invents products), shows product cards with Add to cart, helps with delivery questions and sends order problems to WhatsApp.
- **Bargaining:** when a customer insists on a lower price she can lower it, but only inside YOUR limits (admin panel): most Rs off (default Rs 100), never more than % of price (default 15%), customer must ask 2 times (1st = polite no, 2nd = half, 3rd = full and final). If a product's supplier cost is saved, she always keeps at least Rs 50 profit. The AI cannot choose the amount: the server decides it.
- The deal is a signed token (3 hours, up to 5 pieces, not combinable with promo codes). The cart shows "Deal -Rs 100" and the order route re-checks the token, so a fake discount from the browser is impossible.
- Search box and product grid: "Ask our assistant" when nothing is found.

## 2. Admin panel: /admin/assistant (new tab "AI Assistant")
- Add **as many Gemini API keys as you want**. Chats and AI search are spread over all keys; if one key hits its free limit or is invalid, the next key is used automatically and the bad one rests. "Test" button per key.
- Keys are saved in Firestore collection `assistantKeys`, which NO browser can read (firestore.rules denies it; only the server reads it). Publish the new firestore.rules.
- Settings: ON/OFF, name, model, voice (free phone voice or natural Gemini female voice + voice name), opening words, bargaining limits.
- Keys in Vercel (GEMINI_API_KEY / GEMINI_API_KEYS) also work and are mixed in.

## 3. Cheapest first
- Home: counter strip (total products, categories, "prices start from Rs ..."), budget buttons (Under Rs 500 / 1000 / 2000 / 5000), a shelf with the cheapest product of EVERY category, and every category shelf now starts with its cheapest products.
- /products and category pages open sorted cheapest first (while searching, best match first). Budget chips added to the filters.

## 4. Search upgrades
- "Did you mean ...?" for typos, budget chips, "Ask our assistant" for hard searches, AI search now uses the shared key pool.

## 5. App-like feel
- The page no longer pinch-zooms or bounces (viewport locked, gesture zoom blocked, 16px inputs so phones never zoom on typing). Normal scrolling and photo swipe work as before.
  (If you ever want zoom back for accessibility: remove `AppFeel` from app/layout.js and `maximumScale/userScalable` in `viewport`.)

## 6. Google feed
- /api/feed/google now carries every product that has a photo and price, plus mpn, custom labels (category, price bucket, sale) for Shopping campaigns. Open /api/feed/google?skipped=1 to see exactly which products were left out and why (no photo / no price).

## Before deploy
1. Publish firestore.rules. 2. Add a Gemini key in /admin/assistant (free key: aistudio.google.com/apikey). 3. `npm install && npm run build` once (not possible in my sandbox; `check.js` and `typecheck.js` pass).
Voice notes: speech recognition works in Chrome/Android/Safari; the female phone voice depends on the phone (en-IN / hi-IN voices). For one consistent voice choose "Gemini female voice".
