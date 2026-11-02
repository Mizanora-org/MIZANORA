/*
 * Mizanora v43 tests — Mizanora as the OWNER panel:
 * own channel catalogue + movies/series (M3U import), served to Xtream AND Stalker clients,
 * plus live tracking and exports.
 *
 * Run: node scripts/test-v43.mjs   (also wired into `npm test`)
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

const vod = await import('../lib/iptvVod.js');
const cat = await import('../lib/iptvCatalogue.js');

// ---------------------------------------------------------------- 1. movie / series model
ok('vod: splitName reads S01E02', JSON.stringify(vod.splitName('Breaking Bad S01E02')) === JSON.stringify({ season: 1, episode: 2, title: 'Breaking Bad' }) || vod.splitName('Breaking Bad S01E02')?.episode === 2);
ok('vod: splitName reads 1x05', vod.splitName('Show 1x05')?.episode === 5);
ok('vod: splitName leaves a plain film alone', vod.splitName('Film Name (2022)') === null);
ok('vod: a year comes out of the name', vod.cleanMovie({ name: 'Film (2021)', url: 'https://x/a.mp4' }).year === 2021);
ok('vod: movie keeps its group', vod.cleanMovie({ name: 'A', url: 'https://x/a.mp4', group: 'Action' }).group === 'Action');
ok('vod: movie defaults to Movies', vod.cleanMovie({ name: 'A', url: 'https://x/a.mp4' }).group === 'Movies');
ok('vod: javascript: link is refused', vod.cleanMovie({ name: 'A', url: 'javascript:alert(1)' }) === null);
ok('vod: movie without a name is refused', vod.cleanMovie({ name: '', url: 'https://x/a.mp4' }) === null);
ok('vod: extension comes from the url', vod.cleanMovie({ name: 'A', url: 'https://x/a.mkv' }).ext === 'mkv');

const show = vod.cleanSeries({
  name: 'Show', seasons: [
    { n: 1, episodes: [{ n: 1, url: 'https://x/s1e1.mp4' }, { n: 2, url: 'https://x/s1e2.mp4' }] },
    { n: 2, episodes: [{ n: 1, url: 'https://x/s2e1.mp4' }] },
  ],
});
ok('vod: series keeps two seasons', show.seasons.length === 2);
ok('vod: series season 1 has two episodes', show.seasons[0].episodes.length === 2);
ok('vod: series without episodes is refused', vod.cleanSeries({ name: 'Empty', seasons: [] }) === null);
ok('vod: episode title falls back to Episode N', show.seasons[1].episodes[0].title === 'Episode 1');

const m3u = `#EXTM3U
#EXTINF:-1 tvg-logo="https://img/a.jpg" group-title="Movies",Film One (2023)
https://cdn.example.com/film1.mp4
#EXTINF:-1 group-title="Series",My Show S01E01
https://cdn.example.com/show-s1e1.mkv
#EXTINF:-1 group-title="Series",My Show S01E02
https://cdn.example.com/show-s1e2.mkv
#EXTINF:-1 group-title="Movies",Film Two 2019
https://cdn.example.com/film2.mkv
`;
const parsed = vod.parseVodM3U(m3u);
ok('m3u: two movies found', parsed.movies.length === 2);
ok('m3u: one series found', parsed.series.length === 1);
ok('m3u: series has two episodes', parsed.series[0].seasons[0].episodes.length === 2);
ok('m3u: movie poster kept', parsed.movies.some((m) => m.poster === 'https://img/a.jpg'));

const saved = vod.cleanVod({ movies: parsed.movies, series: parsed.series });
ok('m3u: series episodes carry the ext', saved.series[0].seasons[0].episodes[0].ext === 'mkv');
ok('vod: stats count movies, series, episodes', vod.vodStats(saved).movies === 2 && vod.vodStats(saved).series === 1 && vod.vodStats(saved).episodes === 2);
ok('vod: a duplicate url is dropped', vod.cleanVod({ movies: [parsed.movies[0], parsed.movies[0]] }).movies.length === 1);
const fid = `s${saved.series[0].id.replace(/\D/g, '')}-1-2`;
ok('vod: findVod resolves a series episode by id', vod.findVod(saved, 'series', fid)?.url === 'https://cdn.example.com/show-s1e2.mkv');
ok('vod: findVod resolves a movie by id', vod.findVod(saved, 'movie', saved.movies[0].id)?.url === 'https://cdn.example.com/film1.mp4');
ok('vod: findVod returns null for a stranger', vod.findVod(saved, 'movie', 'm999') === null);

// ---------------------------------------------------------------- 2. channel catalogue ids
const cc = cat.cleanCatalogue({ channels: [{ name: 'A', url: 'https://cdn.example.com/a.ts' }, { name: 'B', url: 'https://cdn.example.com/b.ts' }] });
ok('catalogue: ids are 1,2 for gateway addressing', cc.channels[0].id === '1' && cc.channels[1].id === '2');
ok('catalogue: duplicate url is dropped', cat.cleanCatalogue({ channels: [{ name: 'A', url: 'https://cdn.example.com/a.ts' }, { name: 'A2', url: 'https://cdn.example.com/a.ts' }] }).channels.length === 1);
ok('catalogue: groups are counted', cat.catalogueGroups(cc.channels).length >= 1);

// ---------------------------------------------------------------- 3. routes: Xtream + Stalker
ok('route: player_api exists', existsSync(join(root, 'app/api/gw/player/route.js')));
ok('player: serves live categories', has('app/api/gw/player/route.js', /get_live_categories/));
ok('player: serves live streams', has('app/api/gw/player/route.js', /get_live_streams/));
ok('player: serves vod streams', has('app/api/gw/player/route.js', /get_vod_streams/));
ok('player: serves vod info', has('app/api/gw/player/route.js', /get_vod_info/));
ok('player: serves series list', has('app/api/gw/player/route.js', /get_series_info/));
ok('player: reads OUR catalogue, not an upstream panel', has('app/api/gw/player/route.js', /getGatewayCatalogue/) && !/upstreamStreamUrl|sourceConfig/.test(read('app/api/gw/player/route.js')));
ok('player: line is verified before any data', has('app/api/gw/player/route.js', /verifyLine/));
ok('player: device limit is enforced', has('app/api/gw/player/route.js', /checkDevice/));
ok('player: a login is tracked', has('app/api/gw/player/route.js', /trackEvent\('login'/));

ok('playlist: includes movies', has('app/api/gw/playlist/route.js', /\/movie\/\$\{u\}/));
ok('playlist: includes series episodes', has('app/api/gw/playlist/route.js', /\/series\/\$\{u\}/));
ok('playlist: never prints an upstream host', !/source\.host|apiBase\(/.test(read('app/api/gw/playlist/route.js')));

ok('route: stalker portal exists', existsSync(join(root, 'app/api/gw/portal/route.js')));
ok('portal: handshake returns a token', has('app/api/gw/portal/route.js', /action === 'handshake'/) && has('app/api/gw/portal/route.js', /token:/));
ok('portal: get_profile supported', has('app/api/gw/portal/route.js', /get_profile/));
ok('portal: get_genres supported', has('app/api/gw/portal/route.js', /get_genres/));
ok('portal: channel list supported', has('app/api/gw/portal/route.js', /get_all_channels/));
ok('portal: ordered list (itv/vod) supported', has('app/api/gw/portal/route.js', /get_ordered_list/));
ok('portal: command points at OUR domain', has('app/api/gw/portal/route.js', /ffmpeg \$\{base\}\/live/));
ok('portal: MAC is normalised', has('app/api/gw/portal/route.js', /normMac/));
ok('portal: line is looked up by MAC', has('app/api/gw/portal/route.js', /where\('mac', '==', mac\)/));
ok('portal: device limit is enforced', has('app/api/gw/portal/route.js', /checkDevice/));
ok('portal: token is sealed, not a raw mac', has('app/api/gw/portal/route.js', /open\(token\)/));

// ---------------------------------------------------------------- 4. stream handler
ok('stream: live channel comes from our catalogue', has('lib/gateway/handleStream.js', /findChannel/));
ok('stream: movies/series come from our VOD doc', has('lib/gateway/handleStream.js', /findVodItem/));
ok('stream: the play is tracked with the channel name', has('lib/gateway/handleStream.js', /trackEvent\('stream_start'/));
ok('stream: the raw url is never returned to the client', !/headers:\s*\{\s*['"]?Location/.test(read('lib/gateway/handleStream.js')));

// ---------------------------------------------------------------- 5. admin APIs
ok('admin: vod api exists', existsSync(join(root, 'app/api/admin/iptv/vod/route.js')));
ok('admin: vod api is admin only', has('app/api/admin/iptv/vod/route.js', /verifyAdmin/));
ok('admin: vod api imports an m3u link', has('app/api/admin/iptv/vod/route.js', /action === 'import'/));
ok('admin: vod api merges series episodes', has('app/api/admin/iptv/vod/route.js', /mergeSeries/));
ok('admin: vod api clears its cache tag', has('app/api/admin/iptv/vod/route.js', /revalidateTag\('iptv'\)/));
ok('admin: live/tracking api exists', existsSync(join(root, 'app/api/admin/iptv/live/route.js')));
ok('admin: live api is admin only', has('app/api/admin/iptv/live/route.js', /verifyAdmin/));
ok('admin: live api reads sessions and events', has('app/api/admin/iptv/live/route.js', /iptvSessions/) && has('app/api/admin/iptv/live/route.js', /iptvEvents/));
ok('admin: export api exists', existsSync(join(root, 'app/api/admin/iptv/export/route.js')));
ok('admin: export api is admin only', has('app/api/admin/iptv/export/route.js', /verifyAdmin/));
ok('admin: export can download the m3u', has('app/api/admin/iptv/export/route.js', /what === 'm3u'/));
ok('admin: export can download the mac list', has('app/api/admin/iptv/export/route.js', /what === 'macs'/));

// ---------------------------------------------------------------- 6. panel UI
ok('ui: movies & series card exists', existsSync(join(root, 'components/IptvVodAdmin.js')));
ok('ui: live now card exists', existsSync(join(root, 'components/IptvOpsAdmin.js')));
ok('ui: both cards are on the IPTV admin page', has('components/AdminIptv.js', /IptvVodAdmin/) && has('components/AdminIptv.js', /IptvOpsAdmin/));
ok('ui: live card polls every 20s', has('components/IptvOpsAdmin.js', /20_000/));
ok('ui: live card shows the portal url', has('components/IptvOpsAdmin.js', /portal/));
ok('ui: vod card can import by link', has('components/IptvVodAdmin.js', /action: 'import'/));

// ---------------------------------------------------------------- 7. rewrites + rules
const cfg = read('next.config.js');
ok('rewrite: /portal.php -> portal', /source: '\/portal\.php', destination: '\/api\/gw\/portal'/.test(cfg));
ok('rewrite: /server/load.php -> portal', /source: '\/server\/load\.php'/.test(cfg));
ok('rewrite: /c/:path* -> portal', /source: '\/c\/:path\*'/.test(cfg));
ok('rewrite: /magload.php -> portal', /source: '\/magload\.php'/.test(cfg));
ok('rules: the vod doc is server-only', has('firestore.rules', /id != 'iptvVod'/));
ok('rules: the channel catalogue is server-only', has('firestore.rules', /id != 'iptvCatalogue'/));
ok('rules: the event log is server-only', has('firestore.rules', /match \/iptvEvents\/\{id\} \{ allow read, write: if false; \}/));

// ---------------------------------------------------------------- 8. line defaults
ok('lines: admin line has a mac field', has('app/api/admin/iptv/route.js', /mac/));
ok('lines: a mag line gets a generated mac', has('app/api/admin/iptv/route.js', /randomMac/));
ok('lines: server default is our own domain', !/dns\.mizanora\.tv/.test(read('app/api/reseller/route.js')) && !/dns\.mizanora\.tv/.test(read('app/api/admin/iptv/route.js')));

// ---------------------------------------------------------------- 9. docs
ok('docs: v43 notes exist', existsSync(join(root, 'UPGRADE-v43.md')));
ok('docs: notes explain we own the content', /apna|own/i.test(read('UPGRADE-v43.md')));
ok('docs: notes list what is still missing', /baqi|NAHI/i.test(read('UPGRADE-v43.md')));

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
