# Mizanora v58 — "tasweerein wapas, gaane wapas"

Aap ki shikayat do hisson mein thi:

1. **MINEXUS par sab tasweerein aati theen** — posters, calendar, actor photos — Mizanora par nazar
   nahi aateen.
2. **Home ke sections / nav ko bhi badal diya tha**, jab ke sirf movies + series (aur songs) ka system
   behtar karna tha.
3. **Gaane theek nahi chalte**.

v58 dono ka asal sabab khatam karta hai. Neeche har cheez, aur jo cheez is sandbox se verify nahi ho
saki, dono sach ke saath likhi hui hai.

---

## 1. Asal masla kya tha (aur MINEXUS ne kaise hal kiya)

Reference repo (`minexustv2026`) ka code dekhne par ye saaf hua:

* Posters wahan `https://images.metahub.space/poster/medium/<imdbId>/img` se aate hain — magar **hamesha
  `<img>` mein seedha nahi**, onerror par fallback ke saath.
* Actor photos TMDB (`image.tmdb.org`) se aate hain, **server-side admin key** ke zariye.
* Gaane JioSaavn CDN (`aac.saavncdn.com`, `c.saavncdn.com`) se aate hain, **magar `/api/stream?url=`
  proxy ke through**, kyunki CDN hotlink/referer check karta hai — seedha `<audio>`/`<img>` silent fail
  ho jata hai.
* `api/title-page.js` bhi har poster server-side fetch karke apne domain se serve karta hai.

Mizanora mein hum `<img src="https://images.metahub.space/...">`, `<img src="https://c.saavncdn.com/...">`
aur `<audio src="https://aac.saavncdn.com/...">` **seedha browser ko** de rahe thay. Pakistan ke bohat se
ISPs par ye hosts blocked/throttled hain, is liye poster ki jagah gradient + initials, calendar mein
sirf rangeen box, actor card par sirf letter, aur gaana "play" hone par kuch nahi.

## 2. Hal: har tasveer aur har gaana hamare apne domain se

Teen naye routes (sab edge-cached, sab host-locked):

| Route | Kaam | Fallback chain |
|---|---|---|
| `/api/poster/<ttId>` | poster, `?k=backdrop` se wide art | metahub medium → small → large → TMDB (agar admin key ho) |
| `/api/person/<name>` | asal actor photo | TMDB person search → **English Wikipedia** (keyless) → IMDb suggestion |
| `/api/songs/cdn?url=…` | audio + album art | sirf `saavncdn.com` / `jiosaavn.com` hosts, Range forward (seeking chalta hai) |

Ab browser sirf `mizanora.vercel.app` se images/audio maangta hai. Poster pehli baar server se aata hai,
uske baad Vercel edge se (`s-maxage=2592000`) — tez aur reliable.

Kahan kahan lagaya:

* `cleanMovie()` har title par `posterSrc` / `backdropSrc` deta hai → sab cards, hero, world catalogue,
  continue-watching, my-list, calendar.
* **Calendar** mein ab asal poster dikhta hai (pehle sirf gradient + initials tha) — poster fail ho to
  bhi gradient + monogram + date chip rehta hai, khaali box nahi.
* **Title page ki cast strip** aur **actors directory** har naam ke liye `/api/person/<name>` maangte
  hain, is liye asal chehre aate hain; photo na mile to designed monogram.
* **Title page** par ab wide backdrop (film ka bada art) hero ke peeche chalta hai, poster ke saath —
  bilkul reference site jesa title header.
* Poster cards ab pehle se **roshan** hain (pehle poore card par kaala gradient tha, poster daba hua
  lagta tha — ab sirf neeche halka gradient, MINEXUS jesa).

## 3. Gaane — asal wajah aur fix

Do bugs thay:

1. **`downloadUrl` ka shape.** Saavn mirrors do shakal bhejte hain — `{quality, url}` aur
   `{quality, link}`. Hamara parser sirf `link` padhta tha, is liye naye mirrors par `stream` khaali
   aata tha aur gaana chalta hi nahi tha. Ab dono, plus `media_url`, plus 30-second preview
   (`more_info.vlink`) — sab accept hote hain.
2. **CDN hotlink.** Ab har quality ka link `audioSources` mein same-origin proxy ke through jata hai,
   aur player ka order hai: proxied files → humara resolver (fresh token) → resolver proxy → raw link.
   Isi tarah album art bhi proxy se aata hai, is liye song cards par blank grey box khatam.

## 4. Jo wapas kiya gaya (aap ki hidayat)

* Header ki v57 "media-first" nav hata di — **wahi purani shop category strip** wapas hai
  (All products, categories, Deals, Quran, Hadith, Live TV, Movies, Songs, Tools, Reels, …),
  `aria-label="Categories"` ke saath.
* Home ke sections bilkul waise hi hain jese pehle thay. Sirf movies/series/songs ka system badla hai.
* Mobile app bar aur mini player barqarar hain (wo aap ne songs ke liye maanga tha).

## 5. Verification (sach)

Verified:

* `npm run check` — **488 files, 0 problems**, typecheck clean.
* `npm test` — poora suite green, v58 ke **45+ checks** (poster/person/CDN routes, dono downloadUrl
  shapes, header revert, docs).
* `npm run build:offline` — build pass.
* Dev server par: `/movies` 200 (139 same-origin poster URLs), `/movies/calendar` 200 (444 poster URLs),
  `/movies/actors` 200 (257 `/api/person/` URLs), `/movies/tt1375666` 200 (cast photos wired).
* Route behaviour: `/api/poster/notanid` → 400, `/api/songs/cdn?url=https://evil.example/a.mp3` → 400
  (allowlist kaam karta hai), valid route upstream na milne par saaf 404/502 deta hai.

Verify **nahi** ho saka (sandbox ka network sirf GitHub/npm/PyPI allow karta hai):

* metahub / TMDB / Wikipedia / saavncdn tak nahi pohanch sakta, is liye asal tasveer yahan load nahi hoti.
  Routes ne isi halat mein 404/502 diya aur UI ne designed fallback dikhaya — yani fail hone par bhi
  page toota nahi.
* Live browser par lock-screen controls aur asal music playback Vercel par test karna baqi hai.

## 6. Files

Naye: `app/api/poster/[id]/route.js`, `app/api/person/[name]/route.js`, `app/api/songs/cdn/route.js`,
`scripts/test-v58.mjs`, `UPGRADE-v58.md`.

Badle: `lib/songs.js` (proxied sources, dono shapes), `lib/movies.js` (`posterSrc`/`backdropSrc`),
`components/MusicProvider.js` (audioSources first), `components/{SongBrowser,SongDetailPlayer,MiniPlayer,ResumeListening}.js`
(same-origin artwork), `components/{MoviePosterCard,MoviesCalendarClient,MoviesBrowser,ContinueWatching,MyListShelf}.js`,
`app/movies/{[slug],actors,actor/[slug]}/page.js`, `app/songs/{,artist/[slug],/[slug]}/page.js`,
`components/Header.js` (nav revert), `package.json` (58.0.0).
