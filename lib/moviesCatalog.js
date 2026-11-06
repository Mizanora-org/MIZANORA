// Mizanora v50 — Curated Legal Movies, Series, Upcoming Calendar & Actors Catalogue.
//
// 100% Legal & Google-Safe:
//   * Commercial copyrighted movies & series carry ONLY official metadata, cast/episode guides,
//     official YouTube trailers (youtube-nocookie.com), and official legal "Where to Watch" links.
//   * Full-length video streams appear ONLY on verified Public-Domain classics or Creative Commons
//     open-cinema films with explicit license attribution.

export const MOVIE_REGIONS = [
  { id: 'all', label: 'All Regions', badge: 'Global' },
  { id: 'Pakistan', label: 'Pakistan', badge: 'PK · Urdu / Punjabi' },
  { id: 'India', label: 'India', badge: 'IN · Hindi / South' },
  { id: 'Iran & Afghanistan', label: 'Iran & Afghanistan', badge: 'IR · AF · Persian / Dari' },
  { id: 'Bangladesh', label: 'Bangladesh', badge: 'BD · Bangla' },
  { id: 'Turkey & Arabic', label: 'Turkey & Arabic', badge: 'TR · IQ · MENA' },
  { id: 'International', label: 'International', badge: 'Hollywood & World' },
];

export const MOVIE_GENRES = [
  'Action', 'Drama', 'Thriller', 'Sci-Fi', 'Comedy', 'Romance',
  'Crime', 'History', 'Family', 'Biography', 'Animation', 'Mystery', 'Adventure',
];

// ---------------------------------------------------------------------------------------------
// v54: the hand-curated list is GONE.
//
// v50 shipped 180 hand-written movie/series entries and a starter actor list. That was the
// "custom movie system": a title only showed up if somebody had typed it in. Since v54 every
// film and series on MIZANORA comes from IMDb (Cinemeta), so these arrays stay empty on purpose —
// they exist only so older imports keep working. Do not add titles here: an IMDb id is the
// source of truth, and /movies/tt1234567 always resolves without any catalogue entry.
// ---------------------------------------------------------------------------------------------
export const STARTER_MOVIES = [];
export const STARTER_ACTORS = [];
