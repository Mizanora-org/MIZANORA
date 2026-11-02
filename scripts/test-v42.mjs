/*
 * Mizanora v42 tests — the serverless IPTV gateway (no VPS):
 * sealed stream tokens, line auth, device limit, M3U/player endpoints, rewrites, source secrecy.
 *
 * Run: node scripts/test-v42.mjs   (also wired into `npm test`)
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

const { seal, open, sealUrl, openUrl, sameSecret, deviceHash } = await import('../lib/gateway/security.js');
const { cleanSource, sourceReady, upstreamStreamUrl, apiBase } = await import('../lib/gateway/sourceConfig.js');

// ---------------------------------------------------------------- 1. sealed tokens
const tok = sealUrl('http://panel.example.com:8080/live/up/pass/123.ts');
ok('seal: token looks opaque (v1.)', tok.startsWith('v1.'));
ok('seal: the raw url is NOT inside the token', !tok.includes('panel.example.com') && !tok.toLowerCase().includes('live'));
ok('seal: opens back to the same url', openUrl(tok) === 'http://panel.example.com:8080/live/up/pass/123.ts');
ok('seal: a tampered token is refused', open(tok.slice(0, -4) + 'AAAA') === null);
ok('seal: a random string is refused', open('v1.not-a-real-token') === null);
ok('seal: an expired token is refused', open(seal({ u: 'http://x/y' }, -10)) === null);
ok('seal: two seals of the same url differ (fresh iv)', sealUrl('http://x/y') !== sealUrl('http://x/y'));
ok('seal: payload objects survive', open(seal({ u: 'http://a/b', k: 'live' })).k === 'live');

// ---------------------------------------------------------------- 2. helpers
ok('auth: same secret compares true', sameSecret('abc123', 'abc123') === true);
ok('auth: wrong secret is false', sameSecret('abc123', 'abc124') === false);
ok('auth: empty password never matches', sameSecret('', '') === false);
ok('device: hash is stable and 16 chars', deviceHash('1.2.3.4', 'TiviMate') === deviceHash('1.2.3.4', 'TiviMate') && deviceHash('1.2.3.4', 'x').length === 16);
ok('device: a different ip gives a different hash', deviceHash('1.2.3.4', 'x') !== deviceHash('1.2.3.5', 'x'));

// ---------------------------------------------------------------- 3. source config
const src = cleanSource({ mode: 'xtream', host: 'http://panel.example.com:8080/', username: 'up', password: 'p@ss word', enabled: true });
ok('source: trailing slash is removed', src.host === 'http://panel.example.com:8080');
ok('source: xtream with host+user+pass is ready', sourceReady(src) === true);
ok('source: missing host is not ready', sourceReady(cleanSource({ mode: 'xtream', username: 'u', password: 'p' })) === false);
ok('source: javascript: url is rejected', cleanSource({ mode: 'm3u', url: 'javascript:alert(1)', enabled: true }).url === '');
ok('source: a plain m3u link is ready', sourceReady(cleanSource({ mode: 'm3u', url: 'https://x/y.m3u', enabled: true })) === true);
ok('source: apiBase strips player_api.php', apiBase({ host: 'http://a:8080/player_api.php' }) === 'http://a:8080');
const up = upstreamStreamUrl({ host: 'http://a:8080', username: 'u', password: 'p' }, 'live', 12, 'm3u8');
ok('source: live url is xtream shaped', up === 'http://a:8080/live/u/p/12.m3u8');
ok('source: movie url is xtream shaped', upstreamStreamUrl({ host: 'http://a:8080', username: 'u', password: 'p' }, 'movie', 5, 'mkv') === 'http://a:8080/movie/u/p/5.mkv');
const trick = upstreamStreamUrl({ host: 'http://a', username: 'u', password: 'p' }, 'live', 1, '../../x');
ok('source: extension is sanitised (no path tricks)', !trick.includes('..') && trick.endsWith('/1.x'));

// ---------------------------------------------------------------- 4. routes exist
ok('route: player_api exists', existsSync(join(root, 'app/api/gw/player/route.js')));
ok('route: playlist (get.php) exists', existsSync(join(root, 'app/api/gw/playlist/route.js')));
ok('route: stream proxy exists', existsSync(join(root, 'app/api/gw/stream/route.js')));
ok('route: sealed piece proxy exists', existsSync(join(root, 'app/api/gw/s/route.js')));
ok('route: epg (xmltv) exists', existsSync(join(root, 'app/api/gw/epg/route.js')));
ok('route: icon proxy exists', existsSync(join(root, 'app/api/gw/icon/route.js')));
ok('route: admin source api exists', existsSync(join(root, 'app/api/admin/iptv/source/route.js')));

// ---------------------------------------------------------------- 5. security in the routes
ok('player: verifies the line', has('app/api/gw/player/route.js', /verifyLine/));
ok('player: checks the device limit', has('app/api/gw/player/route.js', /checkDevice/));
ok('player: rate limited', has('app/api/gw/player/route.js', /rateLimit/));
ok('player: never prints the upstream password', !/password:\s*source\.password/.test(read('app/api/gw/player/route.js')));
ok('stream: resolves the channel server-side', has('lib/gateway/handleStream.js', /upstreamStreamUrl|findChannel/));
ok('stream: path form route exists for the rewrites', existsSync(join(root, 'app/api/gw/x/[...parts]/route.js')));
ok('stream: playlist links are sealed', has('lib/gateway/handleStream.js', /sealUrl/));
ok('stream: private addresses are blocked (fetchPublic)', has('lib/gateway/handleStream.js', /fetchPublic/));
ok('piece: token is opened, never accepted raw', has('app/api/gw/s/route.js', /openUrl/));
ok('piece: 900 requests/minute cap', has('app/api/gw/s/route.js', /900/));
ok('epg: line is verified before any xml', has('app/api/gw/epg/route.js', /verifyLine/));
ok('playlist: built on our own domain', has('app/api/gw/playlist/route.js', /x-forwarded-host/));
ok('playlist: never prints the upstream host', !/source\.host/.test(read('app/api/gw/playlist/route.js')));
ok('source api: admin only', has('app/api/admin/iptv/source/route.js', /verifyAdmin/));
ok('source api: password is masked on read', has('app/api/admin/iptv/source/route.js', /hasPassword/));
ok('source api: never returns the password itself', !/password:\s*.*source\.password/.test(read('app/api/admin/iptv/source/route.js')));

// ---------------------------------------------------------------- 6. rewrites
const cfg = read('next.config.js');
ok('rewrite: /player_api.php -> gateway', /source: '\/player_api\.php', destination: '\/api\/gw\/player'/.test(cfg));
ok('rewrite: /get.php -> gateway', /source: '\/get\.php', destination: '\/api\/gw\/playlist'/.test(cfg));
ok('rewrite: /xmltv.php -> gateway', /source: '\/xmltv\.php', destination: '\/api\/gw\/epg'/.test(cfg));
ok('rewrite: /live/:u/:p/:f -> gateway', /source: '\/live\/:u\/:p\/:f', destination: '\/api\/gw\/x\/live/.test(cfg));
ok('rewrite: /movie and /series too', /source: '\/movie\/:u\/:p\/:f'/.test(cfg) && /source: '\/series\/:u\/:p\/:f'/.test(cfg));

// ---------------------------------------------------------------- 7. rules + admin
ok('rules: the source doc is not readable from a browser', has('firestore.rules', /allow read: if id != 'iptvSource'/));
ok('rules: gateway sessions are server-only', has('firestore.rules', /match \/iptvSessions\/\{id\} \{ allow read, write: if false; \}/));
ok('admin: source card is on the IPTV page', has('components/AdminIptv.js', /IptvSourceAdmin/));
ok('admin: the card can test the connection', has('components/IptvSourceAdmin.js', /Test connection/));

// ---------------------------------------------------------------- 8. docs
ok('docs: v42 upgrade notes exist', existsSync(join(root, 'UPGRADE-v42.md')));
ok('docs: notes explain the no-VPS model', /VPS/i.test(read('UPGRADE-v42.md')));
ok('docs: notes list what is still missing', /baqi|NAHI|missing/i.test(read('UPGRADE-v42.md')));

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
