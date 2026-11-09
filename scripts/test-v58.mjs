/*
 * Mizanora v58 tests — "tasweerein aur gaane asal mein chalein".
 *
 * The bug report was simple: on the reference site (minexustv2026) posters, calendar art, actor photos
 * and music all worked; on Mizanora the pictures were missing and songs often refused to play. The
 * cause was that our <img>/<audio> elements pointed straight at third-party hosts (metahub, saavncdn,
 * tmdb, imdb) which block/throttle direct embedding on many networks.
 *
 * v58 routes every single one of those bytes through our own domain:
 *
 *   1. /api/poster/<imdbId>   — poster or backdrop, cached at the edge, TMDB fallback.
 *   2. /api/person/<name>     — real cast portraits (TMDB → Wikipedia → IMDb), keyless-friendly.
 *   3. /api/songs/cdn?url=    — host-locked audio/artwork proxy with Range support.
 *   4. Parser accepts both downloadUrl shapes ({quality,url} and {quality,link}).
 *   5. The header navigation is back to the original shop strip — only the movies/series/songs
 *      systems were supposed to change.
 *
 * Run: node --experimental-loader ./scripts/test-v30-loader.mjs scripts/test-v58.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), 'utf8') : '');
const ok = (m) => console.log(`ok    ${m}`);
let checks = 0;
const check = (cond, msg) => { assert.ok(cond, msg); checks += 1; };

const Songs = await import(pathToFileURL(join(root, 'lib/songs.js')).href);
const Movies = await import(pathToFileURL(join(root, 'lib/movies.js')).href);

// ------------------------------------------------------------------ 1. posters from our own domain
const posterRoute = read('app/api/poster/[id]/route.js');
check(posterRoute.length > 500, 'the poster route exists');
for (const bit of ['images.metahub.space', 'api.themoviedb.org', 'poster/medium', 'Cache-Control', 's-maxage']) {
  check(posterRoute.includes(bit), `the poster route uses ${bit}`);
}
check(/tt\\d\{6,10\}/.test(posterRoute) || posterRoute.includes('tt\\d{6,10}'), 'the poster route validates IMDb ids');
check(posterRoute.includes('k=backdrop') || posterRoute.includes("'backdrop'"), 'the poster route can serve backdrops');
check(read('lib/movies.js').includes('posterSrc'), 'movie cards carry a same-origin posterSrc');
check(read('lib/movies.js').includes('backdropSrc'), 'movie cards carry a same-origin backdropSrc');
const card = read('components/MoviePosterCard.js');
check(card.includes('movie.posterSrc'), 'the poster card renders the same-origin poster');
check(card.includes('titleInitials'), 'a missing poster still shows a designed monogram');
const calendar = read('components/MoviesCalendarClient.js');
check(calendar.includes('item.posterSrc') && /<img/.test(calendar), 'the calendar shows real posters');
check(calendar.includes('titleInitials'), 'the calendar keeps its gradient/monogram fallback');

// ------------------------------------------------------------------ 2. real faces everywhere
const personRoute = read('app/api/person/[name]/route.js');
check(personRoute.length > 500, 'the person photo route exists');
for (const bit of ['en.wikipedia.org', 'api.themoviedb.org', 'lookupPersonImage', 's-maxage']) {
  check(personRoute.includes(bit), `the person route falls back through ${bit}`);
}
check(read('app/movies/[slug]/page.js').includes('/api/person/'), 'cast strips request real portraits');
check(read('app/movies/actors/page.js').includes('/api/person/'), 'the actors directory requests real portraits');
check(read('app/movies/actor/[slug]/page.js').includes('/api/person/'), 'the actor page requests a real portrait');

// ------------------------------------------------------------------ 3. songs: audio + art through us
const cdn = read('app/api/songs/cdn/route.js');
check(cdn.length > 400, 'the song CDN proxy exists');
check(cdn.includes('saavncdn.com') && cdn.includes('jiosaavn.com'), 'the CDN proxy is host-locked');
check(cdn.includes("req.headers.get('range')"), 'seeking works (Range is forwarded)');
check(cdn.includes('immutable'), 'audio/artwork is cached at the edge');

const shaped = Songs.cleanSong({
  id: 'songA1',
  name: 'Shape Test',
  downloadUrl: [
    { quality: '96kbps', url: 'https://aac.saavncdn.com/x/96.mp3' },
    { quality: '320kbps', url: 'https://aac.saavncdn.com/x/320.mp3' },
  ],
  image: [{ quality: '150x150', url: 'https://c.saavncdn.com/x/small.jpg' }, { quality: '500x500', url: 'https://c.saavncdn.com/x/big.jpg' }],
});
check(shaped.stream.includes('320.mp3'), 'the best quality wins when the mirror uses {quality,url}');
check(shaped.audioSources.length >= 2, 'every quality becomes a proxied source');
// v60 supersedes the "everything through us" rule here: every proxied byte is Vercel origin
// transfer, and the Hobby allowance is what got the shop paused on 2026-11-08. The CDN now plays
// first and the same file stays behind our proxy as the fallback, so nothing is lost.
check(shaped.audioSources[0].startsWith('https://'), 'the CDN file plays directly first (0 bytes through us)');
check(shaped.audioSources.some((u) => u.startsWith('/api/songs/cdn?url=')), 'the same file stays behind the CDN proxy as the fallback');
check(shaped.imageSrc.startsWith('https://') && shaped.imageProxy.startsWith('/api/songs/cdn?url='), 'artwork loads direct, with the proxy as the onError fallback');

const legacy = Songs.cleanSong({
  id: 'songB2',
  name: 'Legacy Shape',
  downloadUrl: [{ quality: '320kbps', link: 'https://aac.saavncdn.com/y/320.mp3' }],
  image: 'https://c.saavncdn.com/y/art.jpg',
});
check(legacy.stream.includes('320.mp3'), 'the older {quality,link} shape still plays');
check(legacy.imageSrc.startsWith('https://') && legacy.imageProxy.startsWith('/api/songs/cdn?url='), 'a plain image string loads direct, with the proxy kept');
check(Songs.cleanSong({ id: 'songC3', name: 'Preview', more_info: { vlink: 'https://aac.saavncdn.com/z/preview.mp3' } }).stream.includes('preview.mp3'), 'the 30s preview is the last resort');

const provider = read('components/MusicProvider.js');
check(provider.includes('song.audioSources'), 'the player prefers the proxied CDN files');
check(provider.indexOf('song.audioSources') < provider.indexOf('song.playUrl'), 'proxied files come before the resolver round-trip');
for (const f of ['components/SongBrowser.js', 'components/SongDetailPlayer.js', 'components/MiniPlayer.js', 'components/ResumeListening.js']) {
  check(read(f).includes('songImageSrc'), `${f} uses same-origin artwork`);
}

// ------------------------------------------------------------------ 4. home/nav was not supposed to change
const header = read('components/Header.js');
check(header.includes('aria-label="Categories"'), 'the original shop category strip is back');
check(!header.includes('mz-topnav'), 'the v57 media-first nav was reverted');
check(header.includes('/songs') && header.includes('/movies'), 'movies and songs are still one tap away');
check(read('components/BottomNav.js').includes("'/songs'"), 'the mobile app bar still has the songs tab');

// ------------------------------------------------------------------ 5. version + docs
const pkg = JSON.parse(read('package.json'));
check(Number(pkg.version.split('.')[0]) >= 58, 'package.json is bumped for v58');
check(existsSync(join(root, 'UPGRADE-v58.md')), 'v58 is documented');

console.log(`\nAll ${checks} v58 checks passed.`);
