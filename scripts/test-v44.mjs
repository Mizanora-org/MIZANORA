/*
 * Mizanora v44 tests — IMDb metadata, sharded big catalogues, Xtream user manager,
 * analytics, GitHub archive, ads config.
 *
 * Run: node scripts/test-v44.mjs   (also wired into `npm test`)
 */
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), 'utf8') : '');
const has = (p, re) => re.test(read(p));

let pass = 0;
const fails = [];
const ok = (name, cond) => { if (cond) { pass++; console.log(`ok - ${name}`); } else { fails.push(name); console.log(`FAIL - ${name}`); } };

const meta = await import('../lib/iptvMeta.js');
const shard = await import('../lib/shardPlan.js');
const archive = await import('../lib/iptvArchive.js');
const adsLib = await import('../lib/iptvAds.js');
const stats = await import('../lib/iptvStats.js');

// ---------------------------------------------------------------- 1. IMDb name parsing
ok('meta: dots and quality are removed', meta.titleOf('The.Matrix.1999.1080p.WEB-DL.x264-GRP') === 'The Matrix');
ok('meta: a year in brackets is removed', meta.titleOf('Film Name (2024)') === 'Film Name');
ok('meta: S01E02 is chopped', meta.titleOf('Breaking Bad S01E02') === 'Breaking Bad');
ok('meta: 1x05 is chopped', meta.titleOf('Show 1x05') === 'Show');
ok('meta: a numeric title survives', meta.titleOf('1917.2019.1080p') === '1917');
ok('meta: year is read back', meta.yearOf('Film.Name.2021.720p') === 2021);
ok('meta: nonsense year is ignored', meta.yearOf('Film 1800') === 0);
ok('meta: similarity is high for the same title', meta.similarity('The Matrix', 'The Matrix') > 0.9);
ok('meta: similarity is lower for a sequel', meta.similarity('The Matrix', 'The Matrix Reloaded') < 0.9);
ok('meta: bestMeta prefers the matching year', meta.bestMeta([{ name: 'The Matrix', year: '1999' }, { name: 'The Matrix Reloaded', year: '2003' }], 'The Matrix', 1999).meta.year === '1999');
ok('meta: bestMeta refuses a bad match', meta.bestMeta([{ name: 'Totally Different Film', year: '2001' }], 'The Matrix', 1999) === null);
ok('meta: imdb id is found', meta.imdbIdOf({ id: 'tt0133093' }) === 'tt0133093');
ok('meta: metahub poster url', meta.metahubPoster('tt0133093').includes('tt0133093'));

const merged = meta.mergeMeta(
  { id: 'm1', name: 'The.Matrix.1999.1080p', url: 'https://cdn/film.mp4', poster: '', plot: '', year: 0, rating: 0, ext: 'mp4', group: 'Action' },
  { name: 'The Matrix', releaseInfo: '1999', imdbRating: '8.7', description: 'A hacker learns the truth.', id: 'tt0133093', genres: ['Action'], runtime: '136 min', cast: ['Keanu Reeves'] },
  'movie',
);
ok('meta: name is replaced by the IMDb title', merged.name === 'The Matrix');
ok('meta: rating comes from IMDb', merged.rating === 8.7);
ok('meta: year comes from IMDb', merged.year === 1999);
ok('meta: plot comes from IMDb', merged.plot.startsWith('A hacker'));
ok('meta: poster falls back to metahub', merged.poster.includes('tt0133093'));
ok('meta: stream url is untouched', merged.url === 'https://cdn/film.mp4');
ok('meta: id/ext/group are untouched', merged.id === 'm1' && merged.ext === 'mp4' && merged.group === 'Action');
ok('meta: cast is stored for movies', String(merged.cast).includes('Keanu'));
ok('meta: meta flag is set', merged.meta === 'imdb');
ok('meta: needsMeta is true for a bare item', meta.needsMeta({ name: 'X' }) === true);
ok('meta: needsMeta is false once filled', meta.needsMeta(merged) === false);

// ---------------------------------------------------------------- 2. IMDb network layer (shape only)
ok('imdb: uses the free Cinemeta catalogue', has('lib/gateway/imdb.js', /v3-cinemeta\.strem\.io/));
ok('imdb: has a search endpoint', has('lib/gateway/imdb.js', /\/catalog\/\$\{kind === 'series' \? 'series' : 'movie'\}\/top\/search=/));
ok('imdb: has a detail endpoint', has('lib/gateway/imdb.js', /\/meta\/\$\{kind === 'series'/));
ok('imdb: caches results', has('lib/gateway/imdb.js', /TTL/));
ok('imdb: batches with concurrency 3', has('lib/gateway/imdb.js', /i \+= 3/));
ok('imdb: never sends a key (none needed)', !/api_?key/i.test(read('lib/gateway/imdb.js')));

// ---------------------------------------------------------------- 3. shards (big catalogues)
const big = Array.from({ length: 1700 }, (_, i) => ({ id: String(i + 1), name: `C${i}`, url: `https://cdn.example.com/${i}.ts` }));
ok('shard: 1700 items split into 3 docs', shard.chunkList(big, 800).length === 3);
const plan = shard.planSharded({ enabled: true, channels: big }, ['channels']);
ok('shard: main doc carries no list', plan.main.channels.length === 0);
ok('shard: main doc counts entries', plan.main.totalEntries === 1700);
ok('shard: main doc marks sharded', plan.main.sharded === true);
ok('shard: shard docs hold the rows', plan.shards.reduce((n, s) => n + s.data.rows.length, 0) === 1700);
ok('shard: order survives the round-trip', shard.mergeShards(plan.main, plan.shards.map((s) => ({ data: s.data })), ['channels']).channels[1699].id === '1700');
ok('shard: small lists stay in the main doc', shard.planSharded({ channels: big.slice(0, 10) }, ['channels']).main.totalEntries === 10);
ok('shard: vod plan handles two fields', shard.planSharded({ movies: big.slice(0, 900), series: [] }, ['movies', 'series']).shards.length === 2);
ok('shard: cap is 480k channels', /MAX_IPTV_CHANNELS = 480000/.test(read('lib/iptvCatalogue.js')));
ok('shard: gateway reads through shards', has('lib/gateway/catalogue.js', /readShardedDoc/));
ok('shard: admin channels write through shards', has('app/api/admin/iptv/channels/route.js', /writeShardedDoc/));
ok('shard: admin vod write through shards', has('app/api/admin/iptv/vod/route.js', /writeShardedDoc/));
ok('shard: batch writes are chunked (500 limit)', has('lib/gateway/shards.js', /COMMIT_CHUNK/));

// ---------------------------------------------------------------- 4. archive
const lines = [
  { username: 'mz123456', password: 'secret1', plan: 'starter', status: 'active', maxDevices: 1, mac: '00:1A:79:AA:BB:CC', resellerId: 'r1', resellerName: 'Ali Traders', expiresAt: Date.now() + 86400e3 },
  { username: 'mz999999', password: 'secret2', plan: 'family', status: 'active', maxDevices: 2, mac: '', resellerId: 'admin', expiresAt: Date.now() + 5 * 86400e3 },
];
const built = archive.buildArchiveFiles({
  channels: [{ name: 'Geo News', url: 'https://cdn/geo.ts', group: 'News' }],
  movies: [{ name: 'Film', url: 'https://cdn/f.mkv', group: 'Movies', year: 2023 }],
  series: [{ name: 'Show', seasons: [{ n: 1, episodes: [{ n: 1, title: 'Pilot', url: 'https://cdn/s1e1.mp4' }] }] }],
  lines, base: 'https://mizanora.vercel.app', stamp: '2026-11-02T10-30',
});
const csv = built.files.find((f) => f.path.endsWith('lines.csv')).content;
const m3uFile = built.files.find((f) => f.path.endsWith('.m3u')).content;
ok('archive: 6 files are produced', built.files.length === 6);
ok('archive: catalogue json is included', built.files.some((f) => f.path.endsWith('catalogue.json')));
ok('archive: vod json is included', built.files.some((f) => f.path.endsWith('vod.json')));
ok('archive: m3u has the channel', m3uFile.includes('https://cdn/geo.ts'));
ok('archive: m3u has the movie', m3uFile.includes('https://cdn/f.mkv'));
ok('archive: m3u has the episode', m3uFile.includes('https://cdn/s1e1.mp4'));
ok('archive: csv has the username', csv.includes('mz123456'));
ok('archive: NO password in the csv', !csv.includes('secret1') && !csv.includes('secret2'));
ok('archive: mac is masked in the csv', csv.includes('00:1A:79:**:**:**'));
ok('archive: stats count everything', built.stats.channels === 1 && built.stats.movies === 1 && built.stats.episodes === 1);
ok('archive: repo name is validated', archive.cleanRepo('https://github.com/Mizanora-org/data.git') === 'Mizanora-org/data');
ok('archive: a bad repo is refused', archive.cleanRepo('not a repo') === '');
ok('archive: route is admin only', has('app/api/admin/iptv/archive/route.js', /verifyAdmin/));
ok('archive: token is never written to Firestore', !/set\(\{[^}]*token/i.test(read('app/api/admin/iptv/archive/route.js')));
ok('archive: pushes one atomic tree', has('app/api/admin/iptv/archive/route.js', /git\/trees/));

// ---------------------------------------------------------------- 5. ads
const ad = adsLib.cleanAds({ enabled: true, prerollUrl: 'https://cdn/ad.mp4', imageUrl: 'https://cdn/b.jpg', skipAfter: 99 });
ok('ads: skip is capped at 30s', ad.skipAfter === 30);
ok('ads: javascript url is refused', adsLib.cleanAds({ prerollUrl: 'javascript:alert(1)' }).prerollUrl === '');
ok('ads: all-channels ad returns for any id', Boolean(adsLib.adForChannel(ad, '12')));
const only = adsLib.cleanAds({ enabled: true, all: false, channels: ['12'], prerollUrl: 'https://cdn/ad.mp4' });
ok('ads: channel-limited ad only on that channel', Boolean(adsLib.adForChannel(only, '12')) && adsLib.adForChannel(only, '13') === null);
ok('ads: disabled means nothing', adsLib.adForChannel({ ...ad, enabled: false }, '12') === null);
ok('ads: channel opt-out with -id', adsLib.adForChannel(adsLib.cleanAds({ enabled: true, channels: ['-12'], prerollUrl: 'https://cdn/ad.mp4' }), '12') === null);
ok('ads: admin api exists', existsSync(join(root, 'app/api/admin/iptv/ads/route.js')));
ok('ads: public player endpoint exists', existsSync(join(root, 'app/api/gw/ad/route.js')));

// ---------------------------------------------------------------- 6. analytics
const now = Date.now();
const ev = [
  { type: 'stream_start', at: now - 1000, channel: 'Geo News', app: 'TiviMate', resellerId: 'r1' },
  { type: 'stream_start', at: now - 2000, channel: 'Geo News', app: 'VLC', resellerId: 'r1' },
  { type: 'login', at: now - 3000, app: 'TiviMate' },
];
ok('stats: daily buckets count plays', stats.dailySeries(ev, 3, now)[2].plays === 2);
ok('stats: daily buckets count logins', stats.dailySeries(ev, 3, now)[2].logins === 1);
ok('stats: top content is sorted', stats.topContent(ev)[0].name === 'Geo News' && stats.topContent(ev)[0].plays === 2);
ok('stats: top apps are grouped', stats.topApps(ev).find((a) => a.name === 'TiviMate').n === 2);
ok('stats: reseller rows are built', stats.byReseller([{ resellerId: 'r1', resellerName: 'Ali', expiresAt: now + 86400e3 }], ev, []).length === 1);
ok('stats: overview counts lines', stats.overview({ events: ev, lines: [{ expiresAt: now + 86400e3 }] }, now).lines === 1);
ok('stats: overview counts expiring', stats.overview({ lines: [{ expiresAt: now + 2 * 86400e3 }] }, now).expiring === 1);
ok('stats: overview counts online', stats.overview({ online: [{ lastSeen: now - 1000 }] }, now).online === 1);

// ---------------------------------------------------------------- 7. admin APIs + UI
ok('api: imdb meta route exists', existsSync(join(root, 'app/api/admin/iptv/meta/route.js')));
ok('api: imdb route is admin only', has('app/api/admin/iptv/meta/route.js', /verifyAdmin/));
ok('api: imdb route saves after enrich', has('app/api/admin/iptv/meta/route.js', /enrichList/));
ok('api: lines route exists', existsSync(join(root, 'app/api/admin/iptv/lines/route.js')));
ok('api: lines route can save an edit', has('app/api/admin/iptv/lines/route.js', /action === 'save'|const p = b\.patch/));
ok('api: lines route can renew', has('app/api/admin/iptv/lines/route.js', /'renew'/));
ok('api: lines route can reset a password', has('app/api/admin/iptv/lines/route.js', /resetPassword/));
ok('api: lines route can delete', has('app/api/admin/iptv/lines/route.js', /action === 'delete'/));
ok('api: lines route searches', has('app/api/admin/iptv/lines/route.js', /hay\.includes/));
ok('api: stats route exists', existsSync(join(root, 'app/api/admin/iptv/stats/route.js')));
ok('api: stats route is admin only', has('app/api/admin/iptv/stats/route.js', /verifyAdmin/));
ok('ui: lines manager exists', existsSync(join(root, 'components/IptvLinesAdmin.js')));
ok('ui: stats card exists', existsSync(join(root, 'components/IptvStatsAdmin.js')));
ok('ui: tools card exists', existsSync(join(root, 'components/IptvToolsAdmin.js')));
ok('ui: all v44 cards are on the IPTV admin page', has('components/AdminIptv.js', /IptvLinesAdmin/) && has('components/AdminIptv.js', /IptvStatsAdmin/) && has('components/AdminIptv.js', /IptvToolsAdmin/));
ok('ui: movies card has the IMDb button', has('components/IptvVodAdmin.js', /enrich/));
ok('ui: lines manager shows last device', has('components/IptvLinesAdmin.js', /activity\?\.app/));
ok('ui: reseller panel can search its own clients', has('components/ResellerPanel.js', /q\.trim\(\)\.toLowerCase\(\)/));
ok('ui: reseller search filters the table', has('components/ResellerPanel.js', /const lines = term/));

// ---------------------------------------------------------------- 8. version + docs
ok('version: package is 44+', /"version": "(44|45|46)\.0\.0"/.test(read('package.json')));
ok('docs: v44 notes exist', existsSync(join(root, 'UPGRADE-v44.md')));
ok('docs: notes name the IMDb source', /Cinemeta|IMDb/i.test(read('UPGRADE-v44.md')));
ok('docs: notes list what is still missing', /baqi|NAHI/i.test(read('UPGRADE-v44.md')));

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
