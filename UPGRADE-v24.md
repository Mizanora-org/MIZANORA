# Mizanora v24

Upgrade: purani files ko is zip ki files se replace karein (`mizanora-v16.rar` hata di gayi hai, 4 MB ka bekaar bojh tha), GitHub par commit karein, Vercel deploy. Koi naya npm package nahi, koi naya environment variable nahi, Firebase rules mein kuch nahi badalna.

## 1. Dukaan ka waqt (Admin > Control > "Shop hours")
- Khulne / band hone ka waqt (Pakistan time), kaun se din, aur band hone ka message.
- Waqt ke baahar visitors ko "Dukaan abhi band hai" screen dikhti hai aur dukaan waqt par khud khul jati hai. Firebase se kuch nahi parha jata, redeploy nahi chahiye. Raat ke paar waqt bhi chalta hai (jaise 18:00 se 02:00).
- Emergency band (Shut down) alag hai aur hamesha hours par bhari hai.
- Google ko server se hamesha khuli dukaan dikhti hai (band screen page load ke baad aati hai), is liye SEO par asar nahi.
- Band hone par bhi `/quran`, `/hadith`, `/islamic` khule rehte hain.

## 2. Dukaan band ho tab bhi live Quran
- Band screen (hours ke baad ya emergency shut down) par Quran live chalta rehta hai. Admin > Quran mein naya switch "Keep playing when the shop is closed" (default ON).
- Koi live stream link ghalat ho ya chalti na ho to khud ba khud ayah-by-ayah tilawat (ayat + tarjuma ke saath) shuru ho jati hai: Quran kabhi khamosh nahi rehta.
- Tarjuma masla: ab tarjuma 5 baar tak khamoshi se dobara mangta hai (pehle sirf 2), server 3 koshish karta hai, aur har nayi surah ko apni koshishein milti hain (pehle poore session mein sirf 2 thin, is liye lambi live tilawat mein tarjuma ruk jata tha).
- **Asli live stream**: Admin > Quran > Source = "ready-made live stream" mein Makkah/Madinah ya kisi bhi Quran channel ka YouTube live link ya mp3/aac stream link paste karein. Mujhe is sandbox se koi link test karne ki ijazat nahi thi, is liye maine koi link khud se nahi likha (galat link se dukaan par ghalat cheez chal sakti thi). Aap link daalen: agar na chale to ayah-by-ayah khud shuru ho jayega.

## 3. Hadees (naya /hadith)
- Bukhari, Muslim, Abu Dawud, Tirmidhi, Nasai, Ibn Majah, Muwatta Malik, Nawawi 40, Qudsi 40: Urdu / English / Arabic.
- Kitab, baab, hadith number se kholna, baab ke andar talash, "Sunein" (phone ki awaaz), copy, "Noor se poochein". Darja (grade) wahi dikhta hai jo data mein hai.
- Text khule hadith-api (jsDelivr) se aata hai, kuch haath se nahi likha. Server 30 din cache karta hai. Jis kitab ka Urdu tarjuma na ho wahan English dikha kar saaf likh deta hai.
- Test nahi hua: asli jsDelivr/hadith-api (sandbox mein internet band tha). Deploy ke baad `/hadith` kholen. Agar kisi kitab ka data na aaye to `lib/hadith.js` mein edition ka naam dekhein.

## 4. Noor assistant
- Naya tool `hadith_info`: hadith ka asli text + book + number + darja (yaad se kabhi nahi).
- Dukaan ke hours ka pata hai, website ke features (Quran live, hadith, deals, reviews, wishlist, worker) par jawab de sakti hai.
- Jahan aap samjhane / research / kahani / baat karne ko kahein wahan 6 chhote jumlon tak jawab (pehle har cheez 1-3 jumle thi). Token limit 650 se 900.
- Search aur "kisi bhi sawal ka jawab" pehle se `web_answer` (Google search) se chalta hai; Gemini key ho to chalega.

## 5. Reviews (asli, bharosa mand)
- **10,000 banawati reviews maine nahi banaye aur na banaunga**: dusre naamon/IDs se jhooti reviews customers ko dhoka hain, Google, Meta aur Daraz sab par mana hain, aur aap ki dukaan ke apne usool (halal, sach) ke khilaaf. Jis din aap par ek bhi screenshot aaya, poori dukaan ka bharosa chala jayega.
- Nayi cheezein: product page par rating ka breakdown (5/4/3/2/1 ka %), review ki tareekh, form mein spam check (link, phone number, dohrao, sab capital, chhota text), bot ka chhupa hua field, aur sach ka ailaan.
- Naya `/reviews` page: poori dukaan ke approved reviews, average, aur "hum reviews ko sacha kaise rakhte hain" + "fake review kaise pehchanein".
- Reviews badhane ke asli tareeqe: har order ke baad WhatsApp par shukriya + review ka link bhejein, purane asli customers se kahein ke apne account se review likhein, chhoti si discount coupon "review ke baad agli khareed par" (review ki shart ke baghair, taake sirf asli tajurba likha jaye).

## 6. Muaaz Iqbal page
- Date of birth, ghar ka pata aur zaati tafseel **jaan boojh kar nahi** rakhi gayi (pehle ke version ki tarah). Aap 16 saal ke hain: poori date-of-birth public website par parhne se identity chori aur fraud ka khatra hota hai, aur is se SEO ko koi faida nahi. Aap ka naam, kaam, projects, skills aur links page par hain.

## 7. Safai
- `mizanora-v16.rar` (4 MB) hata di, version 24.0.0, `scripts/test-v24.mjs` (9 checks).

## Kya test hua / kya nahi
- Test hua: `node scripts/check.js`, `node scripts/typecheck.js`, saari `scripts/test-*.mjs` (naya v24 test sahit).
- **Test nahi hua**: asli `next build` (npm/network band), asli Firebase, AlQuran Cloud, hadith-api, Gemini. Deploy ke baad: `npm run check && npm test`, phir Admin > Control > Shop hours, Admin > Quran > Test, `/hadith`, `/reviews`, aur Noor se "Bukhari hadith 1" poochh kar dekhein.
