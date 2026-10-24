# Mizanora v26

Upgrade: purani files ko is zip ki files se replace karein, GitHub par commit, Vercel deploy. Koi naya npm package nahi. Koi naya environment variable zaroori nahi (optional: `TV_PROXY_SECRET`, neeche dekhein). Firebase rules mein kuch nahi badalna.

## 1. Live TV: tez aur smooth
**Asal wajah jo channels load nahi hote the:** (a) bohat se M3U links `http://` hote hain aur browser https website par unhein block kar deta tha, v25 unhein chhor deta tha; (b) kuch servers dusri website par chalne se mana karte hain (CORS); (c) mare hue channels 20 second tak ghoomte rehte the; (d) hls.js tab download hota tha jab channel dabaya jata.

Kya badla:
- **Stream relay** `/api/tv/p`: http channels ab chalte hain, aur jo channel seedha na chale wo khud ba khud relay se dobara try hota hai. Relay sirf wohi channel kholta hai jo admin ne save kiye, baqi sab addresses par signature (HMAC) hai, private/local addresses band hain, HTML/script/data nahi guzarte. Playlist ke andar ke saare segment/key links relay ke through ho jate hain.
- **hls.js page khulte hi** download (pehle channel dabane par), cdnjs se connection pehle khul jata hai.
- hls.js ki tez settings: chhote timeouts, chhota pehla buffer, player ke size ke mutabiq quality, networkError par sirf 2 koshish (pehle hamesha ke liye), mediaError par 1 recover.
- Na chalne wala channel **10 second** mein fail (pehle 20), phir relay, phir auto-skip 3 second mein (pehle 4). Buffering ka chhota spinner.
- **Admin > Live TV > "Check all channels"**: server 12-12 channel check karta hai (6 second limit), laal/hara dot, "Switch off dead" aur "Working first" (tez channel upar). Mare hue channels hatane se TV sab se zyada tez hota hai. Check Vercel server se hota hai: jo channel sirf Pakistan mein chalta ho wo yahan "dead" dikh sakta hai, isi liye delete nahi, **off** hota hai (dobara on kar sakte hain).
- **Dhyan:** relay se guzarne wali video aap ke Vercel bandwidth se guzarti hai. Free (Hobby) plan par bohat zyada viewers ho to limit aa sakti hai. Kam channel rakhein jo log asal mein dekhte hain. Zyada traffic ke liye https wale channel (seedha chalte hain, relay nahi lagta) rakhna behtar hai. `TV_PROXY_SECRET` (koi bhi lambi random string) Vercel mein daalen to signature ki chabi aap ki apni hogi; na daalen to Firebase key se banti hai.
- **Sirf wohi streams rakhein jin ko dikhane ka aap ko haq hai.**

## 2. Home par "Mizanora Feed" (mix)
Ek hi feed mein **products + Islami posts (ayat, hadees, dua) + Live TV channels + free tools**. Products sab se zyada (deals/featured pehle), har 12 cards mein 2 Islami, 1 TV, 1 tool. Tabs: Sab / Products / Islami / Live TV / Tools (sirf CSS se, foran badalte hain). Feed roz badalti hai, din bhar wahi rehti hai. Purani Islami Feed (namaz ke auqaat wali) bhi apni jagah hai.

## 3. Market upgrades: 4 naye tools (ab 38)
Naya group "Market & seller tools":
- **COD Order Profit Calculator**: return rate, return delivery, ad cost ke saath asli munafa aur break-even return %.
- **Price per Unit Comparison**: kaun sa pack asal mein sasta (per 100 g / 100 ml / piece).
- **Khata: Udhaar Ledger**: kis ne dena hai / kis ko dena hai, sirf aap ke browser mein.
- **Image Compressor and Resizer**: product photo chhoti karein (upload nahi hoti).
Har tool ka apna page, FAQ schema, blog guide `free-market-seller-tools-cod-profit-khata-price-per-unit`.

## 4. Noor assistant
- Naye tools: `compare_products` (2-3 products ka farq), `site_search` (tools, TV channels, guides, pages: "zakat nikalna hai", "news channel lagao").
- **Products hamesha dikhte hain**: agar customer ne kuch kharidne ki baat ki aur AI ne search nahi ki ya kuch nahi mila, server khud search karke cards laga deta hai (ek asaan dobara koshish ke saath). Sawal ke nishan `?` wale seedhe product messages ab bina Gemini ke foran jawab paate hain.
- Prompt mein saaf qaida: kisi cheez ko stock/sasta tab hi kahe jab tool kahe; pehli search na mile to ek asaan search.
- Muaaz Iqbal, Asaan Lang aur official links ke durust facts (date of birth / ghar ka pata nahi).

## 5. Muaaz Iqbal: LinkedIn, GitHub, Asaan Lang, projects
- `/muaaz-iqbal` par buttons: **LinkedIn** (https://pk.linkedin.com/in/muaaz-iqbal-744b25430), GitHub, Asaan Lang, YouTube, X, Instagram. Structured data (`sameAs`) mein bhi. Footer mein bhi 3 links.
- Naya section **Asaan Lang** (code ke misaal ke saath) aur projects: Asaan Lang, MIZANORAOT (tracking), Mizanora Android, Agent Web, AI WhatsApp agent (asaan-lang.vercel.app/ecosystem se).
- 3 naye blogs: Asaan Lang kya hai, Urdu mein coding sikhein (8 misalein), Muaaz Iqbal ke LinkedIn/GitHub/projects. Blog mein pehli baar ``` code blocks chalte hain.
- Date of birth, ghar ka pata, zaati tafseel **jaan boojh kar nahi** (aap kam umar hain; ye test bhi check karta hai).
- Asaan Lang ki maloomat uski GitHub README aur website se li gayi hain. Blog ki misalon ke kuch lines (jaise `pakro g`, multi-line `kaam`) README ke mutabiq hain: `FEATURES.md` se ek baar mila lein.

## Kya test hua / kya nahi
- Test hua: `node scripts/check.js`, `node scripts/typecheck.js`, saari `scripts/test-*.mjs` (naya `test-v26.mjs`: relay ki hifazat, playlist rewrite, signatures, feed, tools ke formulas, Muaaz pages).
- **Test nahi hua:** asli `next build`, browser mein dekhna, **asli live streams aur relay (sandbox mein internet band tha)**, Gemini. Deploy ke baad: `npm run check && npm test`, Admin > Live TV > Quick list > Load > **Check all channels** > Switch off dead > Save, phir `/live` par 3-4 channel (ek http wala bhi), home par feed, `/tools/khata-udhaar-ledger`, Noor se "joota dikhao" aur "zakat calculator".
