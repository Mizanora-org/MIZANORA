# Mizanora v57 — "Jese asal MINEXUS: mobile pe app, PC pe site"

v57 ka benchmark `minexustv2026` tha. Us repo ko clone karke dekha, us ki har feature list banai, aur
phir har cheez Mizanora ke apne system (movies + series + songs + Quran + shop) ke andar dobara banai —
copy nahi, upgrade. Neeche har kaam, aur jo cheez sandbox mein verify nahi ho saki, dono likhi hui hain.

## 1. Background play — ab asal mein background play hai

Pehle har screen ka apna `<audio>` tha. Is ki do wajah se shikayat thi:

* doosre page par jaate hi gaana band (component unmount ho jata tha),
* `/songs` se play karke song page kholne par do player aapas mein larte the.

v57 mein ek hi `<audio>` hai, root layout ke andar:

* `components/MusicProvider.js` — poori site ka ek player: `play`, `toggle`, `next`, `prev`, `seek`,
  `setVolume`, `setMuted`, `stop`; source chain wahi v56 wali (`/api/songs/audio/<id>` → proxy → raw CDN);
  Media Session metadata + lock-screen play/pause/prev/next/seek; `mz_last_song` aur `mz_last_queue`
  localStorage mein.
* `components/MiniPlayer.js` — har page par neeche chalta hua player (mobile par tab bar ke oopar,
  desktop par bottom-left floating card), artwork + play/pause + prev/next + close ke saath.
* `components/SongBrowser.js` aur `components/SongDetailPlayer.js` ab sirf buttons hain — dono
  `useMusic()` se baat karte hain, apna audio nahi banate.
* `components/ResumeListening.js` — reload ke baad "wahan se jari rakhein" card, queue ke saath.

Is ka matlab: gaana chalayein, phir movies, Quran, shop, blog — kahin bhi jayein, gaana chalta rahega.

## 2. Device ke hisaab se layout

* **Mobile:** neeche app tab bar — Home · Movies · Songs · Quran · Live · Shop (cart badge ke saath).
  Safe-area padding, `body.mz-has-player` spacing taake mini player footer ko na dhake, sticky gold
  header + search, tap ke liye bade targets. Ye asal app jesa behave karta hai.
* **PC:** header ki purani shop-category strip ki jagah media-first nav — Movies · Series · Calendar ·
  Actors · Songs · Live TV · Quran · Reels · Blog · Shop · Deals · Tools · Track · Support. Hover par
  underline/bg, poori width max-w-7xl grid.

## 3. Actors — asal filmography, har cast member ki

MINEXUS par actor ka koi alag page nahi tha; sirf title page ki cast strip. Mizanora mein actor pages
pehle se thay, magar live catalogue chhota hone ki wajah se patle thay.

v57 mein `data/imdb-seed.json` ki cast lists (`ca`) se asal directory bani:

* **55,292** distinct cast names, **10,394** ke paas 3 ya zyada titles.
* `/movies/actors` par naya "IMDb cast directory": search, A–Z filter, pagination (60 per page), har
  card par title count aur "known for" titles.
* `/movies/actor/<slug>` ab snapshot se poori filmography dikhata hai — misal: Leonardo DiCaprio **26**
  titles, Shah Rukh Khan **53**, Tom Hardy **22** (ye numbers seed file se aate hain, likhe hue nahi).
* Curated profiles (bio, awards) pehle ki tarah rehte hain; unke saath snapshot filmography merge hoti
  hai taake page bhara ho.
* Jo naam sirf snapshot mein hai us ke liye bio **sirf facts** se banti hai ("X appears in N films and
  series in Mizanora's IMDb snapshot (years)") — koi farzi biography nahi.

## 4. Songs — parsing, search, aur bhare hue pages

`lib/songs.js` ka parser v57 mein har mirror shape sambhalta hai:

* HTML entities (`&amp;`, `&#39;`, `&#x27;`) decode,
* duration `"3:33"`, `"1:02:05"` ya number — sab seconds mein,
* year seedha `year` se ya `releaseDate` se,
* artists object (`primary`/`featured`) ya ek string (`"A, B & C feat. D"`) — dono split ho kar saaf
  naam,
* `language` normalize (`hindi` → `Hindi`), album/permalink `more_info` se,
* har song par ready fields: `artistLine`, `durationText`, `playUrl`, `proxyUrl`, `hasStream`.

Pages:

* `/songs` par naya **Singers A–Z** directory (11 asal profiles: Atif Aslam, Nusrat Fateh Ali Khan,
  Rahat Fateh Ali Khan, Arijit Singh, Shreya Ghoshal, Ali Zafar, Momina Mustehsan, Abida Parveen,
  Mehdi Hassan, Lata Mangeshkar, Coke Studio Pakistan).
* `/songs/artist/<slug>` par profile card (origin, born, active years, genres, about) — mirror down
  hone par bhi page baat karta hai, aur "known for" songs ke search links deta hai.
* Mirror down ho to page jhoot nahi bolta: saaf likha jata hai ke catalogue jawab nahi de rahi.

## 5. Movies calendar

`/movies/calendar` v55 se mojood tha; v57 mein ise verify kiya:

* Snapshot se **48** titles calendar mein aate hain (2026: 16, 2025: 14, 2024: 18 releases),
* jahan exact date nahi hoti wahan group honest label ke saath "2026 — date TBA" ban jata hai,
* region + format + "upcoming only" filters, each card par "In N days" / "Released".

## 6. Jo sandbox mein verify nahi ho saka (sach)

Is machine ka network sirf GitHub/npm/PyPI allow karta hai. Is liye ye cheezein code mein hain magar
live test nahi ho sakeen:

* music mirrors (`saavn.dev`, `jiosavan-api2`) — `/api/songs/health` ne dono ko `unreachable` bataya,
* TMDB cast photos aur metahub posters — sandbox mein images load nahi hotin, is liye pages monogram
  (`AvatarImg`) se render hote hain,
* lock-screen controls (Media Session) — browser/device par test karna baqi hai.

Jo verify hua: `npm run check` (485 files, 0 problems), `npm test` (v57 ke 40+ checks samet), dev server
par har page 200, `/movies/actor/leonardo-dicaprio` par 26 titles, `/movies/actors?letter=S&page=1` par
810 matches, `/songs/artist/atif-aslam` par poora profile.

## 7. Files

Naye: `components/MusicProvider.js`, `components/MiniPlayer.js`, `components/ResumeListening.js`,
`lib/artistProfiles.js`, `scripts/test-v57.mjs`, `UPGRADE-v57.md`.

Badle: `app/layout.js`, `components/{BottomNav,Header,SongBrowser,SongDetailPlayer}.js`,
`app/songs/{page.js,artist/[slug]/page.js}`, `app/movies/{actors,actor/[slug]}/page.js`,
`lib/{songs,imdbSeed,moviesServer}.js`, `app/globals.css`, `package.json` (57.0.0), plus test updates
(`scripts/test-v54.mjs`, `scripts/test-v56.mjs`) jo ab naye global-player architecture ko check karte hain.
