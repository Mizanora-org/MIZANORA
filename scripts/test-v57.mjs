/*
 * Mizanora v57 tests — "jese asal MINEXUS: app jesa mobile, PC jesa desktop".
 *
 * The v57 upgrade is architectural, so the checks are about structure, not cosmetics:
 *
 *   1. ONE audio element for the whole site (MusicProvider in the root layout) + a mini player that
 *      follows the visitor, so music survives navigation and the lock screen has controls.
 *   2. A songs tab in the app bar, a media-first desktop nav, and the songs screens driving the
 *      global player instead of owning their own <audio>.
 *   3. Song parsing that handles every mirror shape (entities, "3:33", releaseDate, string artists).
 *   4. A real cast directory + filmography from the IMDb snapshot (55k names, 10k with 3+ titles).
 *   5. Singer profiles so /songs and /songs/artist/<slug> are never thin pages.
 *
 * Run: node --experimental-loader ./scripts/test-v30-loader.mjs scripts/test-v57.mjs
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
const Seed = await import(pathToFileURL(join(root, 'lib/imdbSeed.js')).href);
const Artists = await import(pathToFileURL(join(root, 'lib/artistProfiles.js')).href);

// ------------------------------------------------------------------ 1. one player, everywhere
const layout = read('app/layout.js');
check(layout.includes('MusicProvider') && layout.indexOf('MusicProvider') < layout.indexOf('<MiniPlayer'), 'the root layout mounts the global music provider');
check(layout.includes('<MiniPlayer'), 'the root layout mounts the mini player');
const provider = read('components/MusicProvider.js');
check((provider.match(/<audio\s*\n?\s*ref=/g) || []).length === 1, 'the provider renders exactly one <audio> element');
for (const bit of ['mediaSession', 'previoustrack', 'nexttrack', 'mz_last_song', 'mz_last_queue', 'proxyUrl']) {
  check(provider.includes(bit), `the global player handles ${bit}`);
}
check(provider.includes('export function useMusic'), 'useMusic() is the public hook');
const mini = read('components/MiniPlayer.js');
for (const bit of ['useMusic', 'SkipBack', 'SkipForward', 'setMuted', 'stop']) check(mini.includes(bit), `the mini player has ${bit}`);
check(mini.includes("path.startsWith('/admin')"), 'the mini player stays out of the admin panel');

// ------------------------------------------------------------------ 2. app-like navigation, both devices
const nav = read('components/BottomNav.js');
check(nav.includes("href: '/products'") || nav.includes('href: "/products"'), 'the shop tab is still in the app bar');
for (const tab of ["'/movies'", "'/songs'", "'/quran'", "'/live'"]) check(nav.includes(tab), `the app bar has a ${tab} tab`);
check(nav.includes('Music4'), 'there is a songs tab, not just a home tab');
const header = read('components/Header.js');
for (const bit of ['/movies/calendar', '/movies/actors', '/songs', '/live', '/quran']) check(header.includes(bit), `the desktop nav links ${bit}`);
check(header.includes('md:block') && nav.includes('md:hidden'), 'desktop and mobile have their own navigation');

// The songs screens must not own an <audio> any more.
const browser = read('components/SongBrowser.js');
const detail = read('components/SongDetailPlayer.js');
check(!/<audio\s/.test(browser) && browser.includes('useMusic'), 'the songs browser drives the shared player');
check(!/<audio\s/.test(detail) && detail.includes('useMusic'), 'the song page drives the shared player');
check(read('components/ResumeListening.js').includes('mz_last_queue'), 'the songs page can resume the last queue after a reload');

// ------------------------------------------------------------------ 3. parsing every mirror shape
check(Songs.decodeEntities('Tum Hi Ho &amp; You &#39;re') === "Tum Hi Ho & You 're", 'html entities are decoded');
check(Songs.parseDuration('3:33') === 213, 'clock durations parse');
check(Songs.parseDuration('1:02:05') === 3725, 'long clock durations parse');
check(Songs.parseDuration(213.4) === 213, 'numeric durations round');
check(Songs.parseYear({ releaseDate: '2013-04-26' }) === 2013, 'the year comes out of a release date');
check(Songs.parseYear({ year: 2019, releaseDate: '2001-01-01' }) === 2019, 'an explicit year wins');
const parsed = Songs.cleanSong({
  id: 'abc123XYZ',
  title: 'Tum Hi Ho &amp; You',
  artist: 'Arijit Singh, Pritam & Mithoon feat. D',
  duration: '4:22',
  releaseDate: '2013-04-26',
  language: 'hindi',
  downloadUrl: [{ quality: '320kbps', link: 'https://cdn.example/a.mp3' }],
});
check(parsed.title === 'Tum Hi Ho & You', 'titles are cleaned');
check(parsed.artists.length >= 3 && parsed.artists[0] === 'Arijit Singh', 'string artists are split');
check(parsed.duration === 262 && parsed.durationText === '4:22', 'duration is normalised and formatted');
check(parsed.year === 2013 && parsed.language === 'Hindi', 'year and language are normalised');
check(parsed.playUrl.startsWith('/api/songs/audio/'), 'songs still play through our own route first');
check(Songs.cleanSong({ id: 'x', name: 'Song', artists: { primary: [{ name: 'Atif Aslam' }] } }).artists[0] === 'Atif Aslam', 'object artists still work');

// ------------------------------------------------------------------ 4. real cast directory and filmography
const castSize = Seed.seedCastSize(3);
check(castSize > 5000, `the snapshot has a deep cast directory (${castSize} people with 3+ titles)`);
const leo = Seed.seedActor('leonardo-dicaprio');
check(leo && leo.count >= 10, 'a known actor comes out of the snapshot with a real title count');
const leoFilms = Seed.seedFilmography('leonardo-dicaprio', 60);
check(leoFilms.length >= 10, 'the filmography returns real cards');
check(leoFilms.every((m) => m.imdbId && m.title), 'filmography cards are complete titles');
const letterS = Seed.seedActorRows({ letter: 'S', limit: 10, minTitles: 3 });
check(letterS.total > 100 && letterS.rows.length === 10, 'the directory filters by letter and paginates');
check(letterS.rows.every((r) => r.name.toUpperCase().startsWith('S')), 'letter filtering is exact');
const searchCast = Seed.seedActorRows({ q: 'khan', limit: 10, minTitles: 3 });
check(searchCast.total > 0 && searchCast.rows.some((r) => /khan/i.test(r.name)), 'the cast directory can be searched');
const server = read('lib/moviesServer.js');
check(server.includes('seedFilmography') && server.includes('seedActor'), 'actor pages merge the snapshot filmography');
const actorPage = read('app/movies/actor/[slug]/page.js');
check(actorPage.includes('Filmography') || actorPage.includes('filmography'), 'the actor page shows a filmography');
const actorsPage = read('app/movies/actors/page.js');
for (const bit of ['seedActorRows', 'letter', 'page', 'PER_PAGE']) check(actorsPage.includes(bit), `the actors directory has ${bit}`);

// ------------------------------------------------------------------ 5. singer profiles
check(Artists.ARTIST_PROFILES.length >= 8, 'there are real singer profiles');
const atif = Artists.artistProfile('atif-aslam');
check(atif && /Wazirabad/.test(atif.origin), 'the Atif Aslam profile is factual');
check(Artists.artistProfile('not-a-real-slug') === null, 'unknown singers do not get invented profiles');
const artistPage = read('app/songs/artist/[slug]/page.js');
check(artistPage.includes('artistProfile'), 'artist pages use the profiles');
const songsPage = read('app/songs/page.js');
check(songsPage.includes('ARTIST_PROFILES'), 'the songs page has a singers directory');

// ------------------------------------------------------------------ 6. version + docs
const pkg = JSON.parse(read('package.json'));
check(Number(pkg.version.split('.')[0]) >= 57, 'package.json is bumped for v57');
check(existsSync(join(root, 'UPGRADE-v57.md')), 'v57 is documented');

console.log(`\nAll ${checks} v57 checks passed.`);
