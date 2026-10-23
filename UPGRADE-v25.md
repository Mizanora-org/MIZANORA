# Mizanora v25

Upgrade: purani files ko is zip ki files se replace karein, GitHub par commit, Vercel deploy. Koi naya npm package nahi, koi naya environment variable nahi, Firebase rules mein kuch nahi badalna.

## 1. Tools hub (`/tools`): 34 free tools
Sab tools visitor ke browser mein chalte hain (server, Firestore ya upload nahi), isliye dukaan ko koi kharcha nahi.
- **Islamic:** Zakat calculator (PKR, nisab 52.5 / 7.5 tola, qarz minhaa), Hijri <-> English converter, Islamic calendar, Qibla finder, Tasbih counter.
- **Calculators:** scientific (apna safe parser, eval nahi), percentage, discount, profit/margin/markup, loan EMI, BMI, age, days between dates, sales tax, amount in words (lakh/crore).
- **Converter:** marla, kanal, acre, tola, masha, ratti, length, weight, volume, temperature.
- **Linux / developer:** 120+ commands ka searchable cheat sheet, chmod, cron, JSON, Base64, URL encode, SHA-1/256/512, password, UUID, regex, timestamp, colour.
- **Text / SEO:** word counter, case converter, slug, keyword generator (English + Roman Urdu), meta title/description + Google preview, WhatsApp link.
- Har tool ka apna page `/tools/<naam>`: title, description, keywords, FAQ (FAQ schema), WebApplication schema, breadcrumb, related tools, blog guide ka link, aur neeche dukaan ke products.
- Naya tool jodne ke liye: `lib/tools.js` mein ek row, `components/tools/` mein screen, `ToolRunner.js` mein naam. `scripts/test-v25.mjs` check karta hai ke teeno mein mel hai.

## 2. Live TV naya design
- Dark cinematic player, LIVE badge, channel number, channel **groups** (News, Islamic...), **search**, channel **grid** with logos, **Favourites** aur **Recent** (is device par), Random, Next/Previous, full screen, picture-in-picture, share.
- **Auto-skip**: jo channel na chale 4 second baad agla khud lagta hai (6 baar tak, band kar sakte hain).
- Keyboard: left/right arrow, F full screen, R random.
- Ads: pehle jaisa (admin ke chune hue products), ab progress bar ke saath.
- **Har channel ka apna page** `/live/<channel-naam>` (Google mein milne ke liye); sitemap mein; band/ghalat channel 404. `/live` par sab channels ke naam text link ki tarah bhi hain.
- **Admin > Live TV**: 13 tez "Quick lists" (iptv-org ki public playlists: Pakistan, Islamic, News, Kids, Sports, Music, Urdu, India, Saudi, UAE, Turkey, UK, USA). Tap karein, phir Load, phir Save. 800 channel tak.

## 3. Home, search, navigation
- Home par naya **hub**: Quran / Hadith / Live TV / Tools ke 4 bade darwaze, live channels ki patti, mashhoor tools.
- Naya **`/search`**: tools, Live TV channels, Quran surah, Hadith books, blog guides, pages ek jagah. Search box mein "Search everything" link. Google ke site-search schema ka target bhi `/search` hai.
- Header, mobile menu aur footer mein Tools. Dukaan band ho tab bhi `/tools`, `/live`, `/search` khule rehte hain.
- Products ki patti (`ProductAds`: photo/video wale cards, qeemat dukaan se) `/tools`, har tool page, `/live`, har channel page, `/quran`, `/hadith`, `/search` par. Kisi bhi page mein `<ProductAds seed="naam" />` laga sakte hain.

## 4. Blogs (8 naye)
Zakat guide, calculators guide, marla/kanal/tola guide, Linux commands (Urdu + English), text tools, SEO keyword tools, Tools hub, Live TV features. Sab mein tools ke andar ke links hain.

## Kya test hua / kya nahi
- Test hua: `node scripts/check.js`, `node scripts/typecheck.js`, saari `scripts/test-*.mjs` (naya `test-v25.mjs`: formulas, registry, blog links, channel slugs, search, wiring).
- **Test nahi hua:** asli `next build` (npm/network band tha), browser mein screens ka dekhna, asli streams, iptv-org ke links. Deploy ke baad: `npm install && npm run check && npm test`, phir `/tools`, 2-3 tools, Admin > Live TV > Quick list > Load, `/live`, `/search?q=zakat`.
- iptv-org ki playlists mein bohat se links `http://` hain: https website par wo skip hote hain (admin ko ginti dikhti hai). Kuch channels dusri website par chalne se mana karte hain, auto-skip unhein chhor deta hai. **Sirf wohi streams rakhein jin ko dikhane ka haq ho.**
- Zakat calculator rehnumai hai, fatwa nahi (page par likha hai). Qeemat-e-sona/chandi visitor khud likhta hai: live rate nahi.

## Traffic ke baare mein
"Zabardasti" ya nakli traffic (bots, kharide hue visitors) maine nahi banaya: Google/Meta ads aur Search Console account band ho sakte hain aur nakli visitors kuch nahi kharidte. Asli traffic ke liye ye sab bana hai: har tool aur channel ka apna searchable page, keywords + FAQ schema, sitemap, aur blogs. Deploy ke baad Google Search Console mein sitemap dobara submit karein (`/sitemap.xml`) aur 2-4 hafte intezar karein.
