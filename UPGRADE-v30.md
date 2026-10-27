# Mizanora v30 — Noor, Live TV, product archive aur naye guides

## Pehle zaroor parhein

- Is upgrade se aapka deployed data ya GitHub branch khud delete/change **nahi** hota. Admin se save/delete karne par hi operation hota hai.
- Existing Firestore / GitHub settings use hoti hain; naye Firebase rules ya package ki zaroorat nahi. Deploy ke liye `npm ci`, `npm test`, `npm run check`, phir `npm run build` chalayein. Offline build ke liye `npm run build:offline`.
- Live AI aur streams ki availability external providers, credentials aur network par depend karti hai. Local preview mein demo streams aur limited Noor mode use ho sakte hain.

## 1. Live TV: themes, editable links, backups

1. **Admin > Live TV > Settings** mein default theme (Cinema, Emerald, Ocean, Midnight) chunein. Viewer player mein theme badal sakta hai; choice uske device par yaad rehti hai.
2. **Channels > Edit links & details** khol kar primary URL, group aur logo edit karein. Ek channel ke liye primary ke ilawa **7 backup URLs** (one per line) add kar sakte hain. Save dabana na bhoolen.
3. Direct aur relay try karne ke baad player agla backup try karta hai, phir hi auto-skip hota hai. Viewer Stream menu se bhi source choose kar sakta hai. YouTube embed ki automatic failure detection limited hai; wahan backup manually select karein.
4. **Check all channels** sab source links check karta hai. Sirf woh channel jiske *saare* links fail hon, dead count mein aata hai. Server ki location ki wajah se Pakistan-only streams galat unavailable dikh sakti hain; test karke hi switch off karein.
5. Stuck buffering watchdog ab repeatedly check karta hai, is liye recovery ke aglay steps bhi chal sakte hain. Playback ki guarantee nahi: channel ka source, internet, permissions aur CORS matter karte hain.

Only streams you have the right to display add karein. Stream URLs viewer ko nazar aate hain: private passwords ya secrets URL mein na rakhein. HTTP/relayed streams aapki hosting bandwidth use karte hain. Purane single-link channels isi tarah kaam karte hain. Relay ke signed playlist links ke liye deployed server instances par same `TV_PROXY_SECRET` set karna recommended hai; configured Firebase service-account secret bhi fallback hai. Key ke baghair local demo mein random temporary key use hoti hai aur multiple independent instances ke darmiyan relay links kaam na kar sakte hain.

## 2. Archive: creation-date range export / delete

**Admin > Product archive > Export or delete archived products by date**:

1. From aur To dates choose karke **Preview range**. Dono din Pakistan time (UTC+05:00) mein inclusive hain. Filter original `createdAt` use karta hai, last edit nahi.
2. Preview mein unique matching archived products, samples aur bina usable creation date walon ki count dikhegi. Hidden items bhi shamil hain. Missing date wale exclude hote hain; purani version ne agar date pehle hi badal di thi to woh automatically recover nahi ho sakti.
3. **Export full details as ZIP** se JSON backup download hota hai. Yeh full product details hai, ready-to-deploy catalogue nahi. Backup safely save karein.
4. Delete ke liye pehle backup rakhein, phir exactly `DELETE <count>` type aur final confirmation karein. Latest selected IDs ki **har archived version current branch ke files se** nikalti hai, taake purana version wapas na aaye. Git history mein purane versions rahenge. Naya deployment complete hone ke baad change shop par nazar aata hai.
5. Yeh tool **sirf archive files** handle karta hai. Firebase ke live product copies na export hote hain na delete; agar same ID Firebase mein hai to woh shop par reh sakta hai. Firebase cleanup ke liye existing archive/backup tools alag hain.
6. Deletion ke liye server par existing GitHub archive configuration (`GITHUB_TOKEN`, `GITHUB_REPO`, aur agar zaroori ho `GITHUB_BRANCH`) aur write permission chahiye. GitHub change ho jaye to preview dobara karein. Connection na ho to deployed archive export ho sakta hai, delete nahi.

## 3. Product details aur edit safety

Admin > Products ke form mein **More product details** se brand, highlights, box contents, care/usage aur warranty add karein. Ye optional fields sirf add hone par product page par aati hain aur archived export mein shamil hain. Existing options, media, specs, affiliate settings aur original creation date archive edit par preserve hoti hain. GitHub par newer product version ko pehle read kiya jata hai aur concurrent repository change par write stop hoti hai.

## 4. Noor assistant

Noor ab general, site-help aur shopping intent alag karne ki koshish karti hai: general sawal ke saath unrelated product cards forcibly nahi lagti. Current conversation ke recently shown product IDs follow-up mein madad dete hain; prices/stock tool se verify hote hain. Available web answers mein sources ke buttons bhi show hote hain.

**General AI answers ke liye working Gemini key/model aur provider access zaroori hain.** Admin > AI Assistant mein key ka Test button use karein, ya existing `GEMINI_API_KEY` / `GEMINI_API_KEYS` server variables configure karein. Key absent, quota exhausted ya provider down ho to Noor basic product search aur kuch site links deti hai, aur general sawal par unavailable hone ka sach batati hai. AI ki baat verify karein; health, legal aur religious decisions ke liye qualified professional se poochein.

## 5. Naye blogs

Pakistan marketplace comparison, social-commerce comparison, Muaaz Iqbal ke projects, Asaan Lang beginner aur practice tutorials, aur Noor/TV/product details guide add kiye gaye hain. Comparison mein unsupported cheapest/best claims nahi kiye gaye; competitor terms time ke saath change hoti hain.

## 6. Checks

`npm test` mein naye v30 tests multi-source/relay rules, Pakistan date boundaries, duplicate/hidden archive versions, real catalogue card/full consistency, product metadata preservation aur Noor routing check karte hain. Archive API ka preview/delete flow mock admin aur in-memory GitHub data se bhi check hota hai; yeh real remote write nahi karta. GitHub/Firebase par real writes ya deletes aur real Gemini/stream providers ko test karne ke liye properly configured staging environment chahiye; production data ko test ke liye delete na karein.
