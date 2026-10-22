# Mizanora v23

Upgrade steps: purani files ko is zip ki files se replace karein, GitHub par commit karein, Vercel deploy ho jayega. Koi naya npm package nahi. Koi naya environment variable zaroori nahi.
Phir **Firebase rules mein kuch nahi badalna** (siteMeta pehle hi admin-write hai).

## 1. /deals: saari deals ek link mein
- `https://aap-ki-site/deals` : har in-stock product jis ki qeemat uski purani qeemat (compare price) se kam hai, live + catalogue-file products dono, sab se bara discount pehle.
- Filters: 10/20/30/50%+, category chips, sorting, "Show more deals", WhatsApp/Facebook/Copy share ("ek link, sab deals"), optional countdown.
- Admin > **Deals page**: title, minimum %, countdown, "hot picks" (slugs jo sab se upar aayen), on/off.
- Home ka "Hot deals" ab /deals par le jata hai. Header, menu, footer, sitemap mein /deals hai.

## 2. Quran session (admin se control)
- Admin > **Quran session**: mode (off / waqt ke mutabiq / hamesha), roz ke time windows (Pakistan time, jaise dukaan 09:00 se 09:30), din chunna, **"Start now: 15/30/60/120 min"**, surah + ayat range, qari (7), tarjuma (Urdu Jalandhry / Junagarhi / English / none), look (green / night / cream), animation (glow / rise / write / float), kaise khule (chhota button / bottom sheet / full screen), volume, "next surah", loop.
- Visitor ko **ayat animation ke saath** nazar aati hain aur **awaaz ke saath sync** hoti hain: har ayah ki apni audio file hai, ayah khatam to agli ayah aati hai; ayah ke andar alfaaz recite hone ke saath roshan hote hain.
- Quran ka text aur awaaz **AlQuran Cloud (Tanzil) / Islamic Network** se aati hai, kuch bhi haath se type nahi kiya (galti ka khatra nahi). Server surah 30 din cache karta hai.
- Browser ka rule: awaaz pehli touch ke baad hi shuru hoti hai. Isi liye "Tap to listen" aata hai aur pehli touch par khud shuru ho jati hai. Shop ka background music Quran ke dauran ruk jata hai.
- Naya: `/quran` (114 surah) aur `/quran/<surah>` (poora text server par bhi, Google ke liye) + player. Checkout/cart/admin par session khud nahi khulta.
- Pehli baar session **OFF** hai; Admin > Quran se Save karne ke baad hi chalega.

## 3. Studio: animations + apna code (admin panel se)
- Admin > **Studio**: 9 tayyar animations (rise on scroll, golden sparkle, lanterns, confetti, 3D tilt, shimmer badges, glow buttons, progress bar, smooth taps) ek tap se on/off.
- Apna **CSS / JavaScript / HTML** snippet pages chun kar lagayein. Naya snippet OFF se shuru hota hai. Admin ke andar kuch nahi chalta.
- Masla ho to koi bhi address ke aakhir mein `?noinject=1` lagayein: us visit mein sab snippets band. Admin > Studio mein "Emergency switch" sab kuch band kar deta hai.
- Warning: JS har visitor ke phone par chalta hai. Sirf wohi code lagayein jo samajhte hon.

## 4. AI Manager: ab "poora access" (confirm ke saath)
Naye tools: Quran schedule/start now, deals page, **apply_deal** (products ko x% deal), animations, snippets (add/on/off/delete), **repo_read_file / repo_write_file** (GitHub ke zariye naye page, component, admin panel, feature banana), search engines ko ping (IndexNow), research.
Safety: qeemat, code, file, snippet, delete = AI sirf **tayyar** karta hai, aap ko poora code/summary dikhta hai, **Confirm** aap dabate hain. Files mein secrets, login/admin-check code (`adminAuth.js`, `firebase-admin.js`), rules, workflows, package files **mana** hain. Har kaam `aiManagerLog` mein. GitHub commit revert ho sakta hai. Code likhne ke liye `GITHUB_TOKEN` + `GITHUB_REPO` Vercel mein chahiye (pehle se publish_blog ke liye).
AI ko bade jawab/code ke liye zyada token aur 10 steps mile hain.

## 5. AI sahi kiya: har sawal ka jawab, honest aur Islami
- **Noor (shop assistant)** ab shop ke ilawa sawal bhi (general, Islami, news, how-to) Google search se jawab deti hai (`web_answer`, `lib/webAnswer.js`), chhota, source ke saath.
- Dono AI (Noor aur Admin AI Manager) ke rules: sach, koi ayat/hadees/hawala khud nahi banana; masail mein sirf mustanad jawab, ikhtilaf ho to "aalim se poochein"; riba, jua, dhoka, fake review/discount/countdown se inkaar; kisi firqe ya shakhs ki bura-bhala nahi.

## 6. Islami feed
- +30 naye ayat/ahadees/duas, har ek hawale ke saath (sirf wo jo pakke hain).
- **Aaj ki Ayat**: roz alag ayah (Arabic + Urdu), API se, "Sunein aur parhein" link.
- Feed se /quran aur /islamic ke buttons.

## 7. Product video + images ek saath
- Product gallery mein photos ke baad **videos bhi slides** hain (poster + play, wahin chalti hain), thumbnails mein play icon. Cards par "Video" badge.

## 8. SEO / Google
- `/muaaz-iqbal` (Person + ProfilePage + FAQ schema, sameAs links), sitemap mein /deals, /quran, /quran/1..114, /muaaz-iqbal, product images; `llms.txt` update; **8 naye blogs** (deals, Quran feature, HijriAnchor, Muaaz Iqbal projects, asli discount, Sehr/Iftar, AI manager, Aaj ki Ayat).
- Google par aane ke liye: Search Console > Sitemaps > `sitemap.xml` submit karein, naye URLs ko "URL Inspection > Request indexing". Ranking ki guarantee koi nahi de sakta: usually kuch din se hafte lagte hain. AI Manager "submit_to_search" Bing/Yandex ko foran batata hai (INDEXNOW_KEY chahiye).
- Muaaz Iqbal page mein date of birth, ghar ka pata ya zaati tafseel **nahi** rakhi. IPTV/streaming projects (MITV, MiNexus) public page par nahi dale.

## Kya test hua / kya nahi
- Test hua: `node scripts/check.js`, `node scripts/typecheck.js`, saari `scripts/test-*.mjs` (naya `test-v23.mjs`: surah totals 6236, Pakistan-time schedule, midnight window, API parsing, deals filter, snippet sanitiser, AI file guard).
- **Test nahi hua**: asli `next build`, asli Firebase / AlQuran Cloud / GitHub / Gemini (is sandbox mein npm aur ye sites blocked thin). Deploy ke baad: `npm run check && npm test`, phir Admin > Quran > "Test on this screen", /deals, /quran/1-al-fatihah dekhein.
- Browser ki awaaz audio files ke codec par chalti hai; agar kisi qari ka link na chale to qari badal dein.
