# MIZANORA v50.0.0 — Auto-Pilot Legal Movies, Series, Release Calendar, Cast Hub & Cinema Player

## Summary (English + Roman Urdu)

Mizanora **v50.0.0** adds a **100% legal, Google-safe, zero-manual-work** Entertainment & Cinema Discovery Hub (`/movies`) integrated directly with Mizanora's e-commerce catalog, product ads, blog guides, global search, and `sitemap.xml`.

Admin ko ek-ek movie ya drama haath se add karne ki zaroorat nahi:
- **Hourly Server Auto-Load (`lib/moviesAutoFeed.js` + `lib/moviesServer.js`)**: Upcoming (`ane wali` 2026–2027), Latest Newest-to-Oldest (`nayi se porani`), Regional (`Pakistan, India, Bangladesh, Iran, Iraq, Afghanistan, Turkey`), Classics, aur Public-Domain movies automatically load hoti hain.
- **Zero-Key + Optional TMDB Turbo Mode**: Bina kisi API key ke bhi **TVmaze Official API + IMDb Official Public Suggestion JSON + Internet Archive Feature Films + 65+ Built-in Titles** kaam karte hain; aur agar Admin `/admin/movies` mein apni free `TMDB_API_KEY` save kare (server-only `adminSecrets/movies`), to 10,000+ titles aur official YouTube trailers sync ho jate hain.
- **1-Click Auto-Sync & Bulk IMDb Paste (`/admin/movies`)**: Ek click se sab Upcoming + Latest + Classics sync karein, ya 10–250 `tt...` IMDb IDs / CSV / URLs ek saath paste karke bulk import karein.
- **Sharded Firestore Storage (`lib/moviesStore.js`)**: Movies aur Actors `siteMeta/movies/parts/p0..pN` shards mein save hote hain taake Firestore ki 1 MB document limit kabhi hit na ho.
- **Infinite Auto-Scroll + Default Newest-to-Oldest**: `/movies` page par Upcoming aur Newest se Oldest tak titles scroll karne par khud-ba-khud load hote hain.
- **Dynamic Image Sitemap (`app/sitemap.js`)**: Tamam movie slugs (poster images ke saath), actor slugs, release calendar, aur blog category pages automatically `sitemap.xml` aur `llms.txt` mein index hote hain.

---

## Key Modules Added / Updated

- `lib/moviesCatalog.js` — Built-in 65+ Movies & Series + 45+ Actors spanning 2027 Upcoming down to 1920s Public-Domain Classics across Pakistan, India, Bangladesh, Iran, Iraq, Afghanistan, Turkey & World.
- `lib/movies.js` — Validation, `sortMoviesNewestToOldest`, `extractImdbIds`, search/calendar helpers, and strict anti-piracy URL/host/IP guards (`isForbiddenStreamUrl`, `cleanLegalStream`, `cleanProviderLink`).
- `lib/moviesStore.js` — Sharded Firestore storage (`siteMeta/movies/parts/*`) + server-only `adminSecrets/movies` key storage.
- `lib/moviesAutoFeed.js` — Multi-source official metadata discovery (TMDB v3/v4, TVmaze Official API, IMDb Public JSON, Internet Archive Public Domain, and Bulk IMDb ID batch resolver).
- `lib/moviesServer.js` — Cached server hub loader (`getMoviesHub`), hourly live auto-feed + background shard persistence, and automatic TMDB -> Zero-Key IMDb fallback.
- `components/CinemaPlayer.js`, `components/MoviesBrowser.js`, `components/MoviesCalendarClient.js`, `components/MoviePosterCard.js`, `components/MoviesStrip.js` — Responsive mobile-app UI, infinite scroll auto-loader, legal HTML5/HLS player, and companion Mizanora shop deals.
- `app/movies/page.js`, `app/movies/[slug]/page.js`, `app/movies/calendar/page.js`, `app/movies/actors/page.js`, `app/movies/actor/[slug]/page.js` — Public routes with Schema.org `JsonLd`, `AdsInject`, and `ProductAds`.
- `app/admin/movies/page.js` & `app/api/admin/movies/route.js` — Admin Auto-Sync console, Bulk IMDb importer, and secret TMDB key manager.
- `app/sitemap.js`, `app/llms.txt/route.js`, `lib/siteSearch.js`, `app/search/page.js`, `components/SearchBox.js`, `firestore.rules`, and 4 SEO blog guides in `content/blog/*.md`.
