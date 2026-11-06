# MIZANORA v51.0.0 — Every Movie Searchable, Admin Play Servers, New Cinema Player, Licence Pages

Aap ka hukm tha: *“Movies section upgrade karo — bas kuch khaas movies load hoti hain. HR tarah ki movie,
IMDb ki all movies, search, release calendar, series, blogs, images, actor images. Movie play bhi kare
mere player se — `https://domain/play/{imdbid}` is tarah ka player admin panel mein set kar sakoon,
server add/edit/delete, apna player jis mein Mizanora products ka ad chal phir player load ho. Live TV
player bhi upgrade, licence aur privacy pages bhi.”*

v51 wahi karta hai. Har tabdeeli neeche aasan lafzon mein.

---

## 1. “Sirf kuch khaas movies” — masla aur hal

**Masla:** v50 ka feed ek fix list par chalta tha (`STARTER_MOVIES` + hourly auto-feed). Jo title us list
mein nahi tha, us tak pohnchne ka koi rasta nahi tha — na search, na page.

**Hal — Live World Catalogue Search:**

| Naya | Kya karta hai |
|---|---|
| `lib/moviesAutoFeed.js` → `searchWorldCatalog()` | Teen official catalogues ek saath: **IMDb public suggestion JSON** (zero key, `tt…` IDs + official posters + stars), **TVmaze** (series/dramas), **TMDB `/search/multi`** (jab admin ki key save ho). |
| `searchImdbSuggestions()` | Naam se `tt…` ID nikalta hai; exact-title ko sab se upar rakhta hai. |
| `searchTmdbTitles()` | TMDB results ke liye `external_ids` se asal IMDb ID laata hai, taake result ka link `/movies/tt…` khule. |
| `app/api/movies/search/route.js` | Public API: local library + world catalogue, duplicate hata kar, har result ke saath seedha `href`. 5 min cache. |
| `components/MoviesBrowser.js` | Search-as-you-type (420ms debounce, abort purani request). “World catalogue — IMDb + TMDB + TVmaze” section, poster, saal, rating, IMDb ID, “in library” badge. Quick chips (Jawan, Maula Jatt, Inception…). |

Iske sath hi lafzi (literal) IMDb ID lookup pehle se mojood tha — ab woh behtar bhi hai:

- `resolveMovieOrSeries()` valid `tt…` par metadata na milne ki soorat mein **404 nahi** deta; ek honest
  placeholder page deta hai (`stubMovieFromImdbId`, `noindex`) jahan player aur play servers phir bhi chalte hain.
- `app/api/movies?imdb=tt…` bhi wohi placeholder deta hai.

---

## 2. Play Servers — admin se add / edit / delete

Yeh v51 ka dil hai. Naya module `lib/movieServers.js` (pure, isomorphic — server page, API aur browser
player teeno ek hi link banate hain).

| Cheez | Tafseel |
|---|---|
| **Template** | `https://my-cdn.com/play/{imdbid}` — tokens: `{imdbid}`, `{imdb}`, `{tt}`, `{slug}`, `{title}`, `{year}`, `{type}`, `{season}`, `{episode}`, `{s}`, `{e}` |
| **Validation** | https only, public host only (localhost/private IP mana), unknown `{token}` mana, 400 chars max — ghalat link save nahi hota |
| **Kind** | `auto` (link se pata: `.m3u8` → HLS, `.mp4` → MP4, warna embed), ya fix `embed` / `hls` / `mp4` / `dash` |
| **Scope** | dono / sirf movies / sirf series |
| **Extras** | quality label, zubaan, note, priority (order), enabled (ON/OFF), rights confirmation |
| **Admin APIs** | `POST /api/admin/movie-servers` — `load`, `add`, `update`, `delete`, `toggle`, `move`, `duplicate`, `save` (player + ads), `reset` |
| **Public API** | `GET /api/movies/servers?imdb=tt…&type=series&season=1&episode=2` |
| **Storage** | `siteMeta/movieServers` (max 40 servers, chhota document), `unstable_cache` tag `movie-servers` |
| **Admin UI** | `components/MovieServersAdmin.js` — hairan kar dene wala panel: token chips (cursor par insert), example templates, **live URL preview** (sample IMDb ID daal kar), list mein ↑↓ / copy / edit / ON-OFF / delete, ad settings |

`resolveMovieServers()` sirf woh servers deta hai jo **is** title ke liye chal sakte hain: scope match,
enabled, aur agar template mein `{imdbid}` hai to title ke paas IMDb ID bhi honi chahiye. Khaali `/play/`
par bhejne wala classic bug is tarah khatam.

---

## 3. Naya Cinema Player (`components/CinemaPlayer.js`)

| Feature | Kya milta hai |
|---|---|
| **Pre-roll ad** | “Watch Now” → Mizanora ka apna ad (default 10s, 5s baad skip) → phir stream load. Ad ke andar product image, name, price, “View on Mizanora”. Koi third-party ad script nahi. Skip karne par us title ke liye session mein dobara ad nahi. |
| **Server switcher** | Har server pill par naam, quality, type (HLS/MP4/Embed), ON server par tick. Switch foran. |
| **Start gate** | Poster par bara Play button, server ka naam, ad timing, upcoming badge. |
| **Direct player** | Custom control bar: play/pause, ±10s, volume, time, buffered bar, **quality menu** (Auto + asal heights/bitrates), **audio track** menu, **subtitles** menu, **speed** (0.5–2×), PiP, full screen, **screenshot (PNG)**, stats chip (resolution · bitrate). |
| **HLS tuning** | `startLevel:-1` + connection-aware `abrEwmaDefaultEstimate`, `startFragPrefetch`, buffer 30/90, retries bounded, `recoverMediaError` + `startLoad` on fatal errors. |
| **Resume** | Position har 4s local storage mein; wapis aane par “Resume from 12:34”. |
| **Keyboard** | Space/K, ← →, ↑ ↓, F, M, C. Double-click full screen. |
| **Embed servers** | Sandboxed iframe + “Open in new tab” fallback (jin hosts par `X-Frame-Options` ho). |
| **Series** | Season buttons + episode rail + prev/next; episode badalne par template se naya URL. |
| **Empty state** | Server na ho to saaf Roman Urdu hidayat (Admin > Movies > Play Servers) + trailer CTA. |

Purana legal public-domain stream player bhi isi player ke andar “Mizanora Free Archive” server ban kar
chalta hai — kuch bhi kho nahi.

---

## 3b. Continue Watching, auto server fallback aur bulk add

| Feature | Tafseel |
|---|---|
| **Continue Watching** | Player har 4 second baad position save karta hai (`lib/movieProgress.js`, localStorage, device par). `/movies` par nayi shelf: poster, progress bar, “Resume 37%”, “Clear all”. Koi account ya server call nahi. |
| **Auto server fallback** | Seedha (HLS/MP4) server mar jaye to player khud agla ON server try karta hai — har server sirf ek dafa, taake do kharab hosts ke darmiyan ping-pong na ho. Embed frames ke liye 12 second baad “Next server try karein” chip. |
| **My List** | Movie page par “My List” button, `/movies` par saved-titles shelf (`lib/movieList.js`, max 60). Device par save — account ki zaroorat nahi. |
| **Server test** | Admin list mein har server ke saath ↗ button — sample IMDb ID ke saath wohi URL naye tab mein khul jata hai, taake live check ho sake. |
| **Bulk add** | Admin > Play Servers mein ek saath kai links paste karein — har line par ek link, ya `Naam | link`. Duplicate aur ghalat links skip ho kar report hote hain. |

## 4. Images — posters, cast aur actors

- `cleanMovie()` ab cast ke saath **`photo`** rakhta hai (safe https only).
- TMDB cast `profile_path` → `w185` portrait; TVmaze cast → person image.
- `mergeMoviesCatalog()` backfill karte waqt cast ki photo actor profile mein le jata hai.
- `lib/moviesServer.js` → `actorPhotoLookup()` / `enrichActorsWithPhotos()`: jis actor ki tasveer na ho
  uske liye official IMDb public suggestion se portrait, **12 ghante cache** (actors directory pehle 24
  par, actor page par jab zaroorat ho).
- Movie detail page cast cards ab asal chehre dikhate hain, warna khoobsurat gradient initials.

---

## 5. Legal pages (naye + update)

| Page | Kya hai |
|---|---|
| `/licence` | Content kis licence par hai, play-server policy, public-domain rules, trailers, metadata sources (TMDB/TVmaze/IMDb/Archive), open-source licences table, ads policy, contact |
| `/copyright` | DMCA-style takedown: kya bhejein, 24h acknowledge / 48h action, counter-notice, metadata/posters ka alag rasta |
| `/privacy-policy` | Naya section: movies & player (local storage resume, third-party embeds aur unke IP policies, first-party ad) |
| `/terms` | Naya section: movies/live TV rules, no re-streaming, takedown ka hawala |
| Footer + `sitemap.xml` | Dono naye pages linked aur indexed |

Player ke server strip par aur admin panel mein `/licence` ka link mojood hai.

---

## 6. Live TV

- **Admin > Live TV**: har channel row par **⧉ Duplicate** — same stream ki nayi row (HD/SD variant banane ke liye).
- **Player**: `testBandwidth: false` — hls.js pehle fragment ko naapne mein waqt zaya nahi karta; shuruaati
  level `abrEwmaDefaultEstimate` se chunta hai, is liye pehli tasveer pehle aati hai. v49 ke tamam features
  (asal resolutions, audio tracks, embedded captions, stats, screenshot, PiP, wake lock, media session,
  favourites, relay) waise hi hain.

---

## 7. Testing

Naya `scripts/test-v51.mjs` (npm test chain mein):

- template validation (https, private host, unknown token, non-URL) aur id/priority/order cleanup
- `buildServerUrl` movies **aur** series (`{season}/{episode}`) ke liye
- `resolveMovieServers` scope / enabled / no-IMDb filtering + duplicate URL removal
- `searchWorldCatalog`, `searchImdbSuggestions`, `lookupPersonImage` — **mocked fetch** se (koi network nahi)
- `stubMovieFromImdbId` ka `noindex` placeholder
- `lib/movieProgress.js`: clock labels, progress %, aur browser ke baghair safe behaviour
- file wiring: routes, admin panel, player features, world search, legal pages, footer, sitemap, blogs, version

`npm run check`, `npm test` aur `npm run build:offline` — teeno pass.

---

## 8. Aap ke liye pehla kaam

1. **Admin > Movies > Play Servers** kholein.
2. Apne licensed server ka template add karein (`https://…/play/{imdbid}`).
3. Ad ki lambai aur skip timing set karein → Save.
4. `/movies` par koi bhi title search karein → **Watch Now**.

Sirf apne ya licensed servers add karein. Baqi tafseel: [`/licence`](/licence) aur [`/copyright`](/copyright).
