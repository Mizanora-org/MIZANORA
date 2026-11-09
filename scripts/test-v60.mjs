/**
 * Mizanora v60 — ORIGIN TRANSFER / BANDWIDTH BUDGET.
 *
 * Why this suite exists:
 *   On 2026-11-08 Vercel paused every deployment of this project with
 *       FAIR_USE_LIMITS_EXCEEDED / blockedDueToOverageType = fastOriginTransfer
 *   on the Hobby plan (10 GB per rolling 30 days), until 2026-12-08.
 *   "Fast Origin Transfer" is bytes that come OUT of a Function/Middleware instead of the
 *   CDN cache. The shop had three habits that produced it in bulk:
 *       1. product photos and song artwork were relayed through /api/img by default,
 *       2. requested+relayed media had no `s-maxage`, so the edge could never keep it,
 *       3. middleware ran on every request (matcher = everything) and every request that hits
 *          middleware also by-passes the CDN.
 *
 * What this suite proves (offline, no network needed):
 *   1. the photo relay is a LAST RESORT that remembers broken hosts (not the default path)
 *   2. the relayed image/media responses are cacheable at the edge (s-maxage)
 *   3. songs play from the CDN first and only fall back to our proxy
 *   4. the Live TV relay has a budget and can be switched off
 *   5. middleware does not run for static assets
 *
 * Run: node scripts/test-v60.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), 'utf8') : '');
const imp = (p) => import(pathToFileURL(join(root, p)).href);
let checks = 0;
const ok = (m) => { checks += 1; console.log(`ok    ${m}`); };
const check = (cond, msg) => { assert.ok(cond, msg); checks += 1; };

// ---------------------------------------------------------------- 1. photo relay budget
const Img = await imp('lib/imgFallback.js');

// A plain remote picture is NOT relayed until it actually fails.
check(Img.relayMode() === 'fallback', 'the relay defaults to "fallback", never "always"');
check(Img.shouldRelay('https://cdn.example/a.jpg') === false, 'a new host is tried directly first (0 bytes through us)');
check(Img.proxyImage('https://cdn.example/a.jpg') === '/api/img?u=https%3A%2F%2Fcdn.example%2Fa.jpg', 'the relay URL is still built correctly');

// A failed picture is remembered, so the next photo from that host skips the doomed attempt.
const fake = { attrs: { src: 'https://blocked.example/a.jpg' }, getAttribute(k) { return this.attrs[k] || ''; }, setAttribute(k, v) { this.attrs[k] = v; }, style: {}, closest: () => null };
Img.imgFallback({ currentTarget: fake });
check(Img.isProxyUrl(fake.attrs.src), 'a failed photo is retried through the relay');
check(Img.shouldRelay('https://blocked.example/b.jpg'), 'the broken host is remembered for the rest of the session');

// A second failure hides the picture (no broken icon) and does not loop.
Img.imgFallback({ currentTarget: fake });
check(fake.attrs['data-dead'] === '1' && fake.style.display === 'none', 'a photo that fails twice is hidden');

// Declared hotlink-blocking hosts go straight to the relay.
process.env.NEXT_PUBLIC_IMAGE_RELAY_HOSTS = 'imgbb.com, i.ibb.co';
check(Img.shouldRelay('https://i.ibb.co/x/y.jpg') === true, 'NEXT_PUBLIC_IMAGE_RELAY_HOSTS declares hosts that always need the relay');
delete process.env.NEXT_PUBLIC_IMAGE_RELAY_HOSTS;

// The owner can switch the relay off while the plan is capped.
process.env.NEXT_PUBLIC_IMAGE_RELAY = 'off';
check(Img.shouldRelay('https://i.ibb.co/x/y.jpg') === false, 'NEXT_PUBLIC_IMAGE_RELAY=off disables the relay');
process.env.NEXT_PUBLIC_IMAGE_RELAY = 'always';
check(Img.shouldRelay('https://cdn.example/a.jpg') === true, 'NEXT_PUBLIC_IMAGE_RELAY=always restores the old behaviour');
delete process.env.NEXT_PUBLIC_IMAGE_RELAY;
ok('image relay: direct first, remembered failures, opt-in hosts, off switch');

// Every picture component must use the budget, not a bare proxyImage.
for (const file of ['components/CardMedia.js', 'components/CardPhoto.js', 'components/RemoteImg.js', 'components/SafeImg.js', 'components/AvatarImg.js']) {
  const t = read(file);
  check(t.includes('shouldRelay'), `${file} consults the relay budget before relaying`);
  check(t.includes('markBrokenHost'), `${file} remembers a host that failed`);
}
ok('all picture components share the relay budget');

// ---------------------------------------------------------------- 2. edge caching
const imgRoute = read('app/api/img/route.js');
check(/s-maxage=/.test(imgRoute), 'the image relay response is cacheable at the edge (s-maxage)');
check(!/readLimited/.test(imgRoute), 'the image relay streams the upstream body instead of buffering it');
check(/content-length/i.test(imgRoute), 'an oversized upstream file is refused before downloading it');

const cfg = read('next.config.js');
for (const bit of ['/api/img', '/api/poster/:path*', '/api/songs/cdn', '/api/tv/p']) {
  check(cfg.includes(bit) && /s-maxage/.test(cfg), `next.config.js gives ${bit} an edge cache header`);
}
check(!/outputFileTracingIncludes:\s*\{\s*'\/\*\*'/.test(cfg), 'the data folder is no longer copied into every function');
ok('relayed media and functions are cacheable / scoped');

// ---------------------------------------------------------------- 3. songs
const songs = await imp('lib/songs.js');
const direct = songs.songAudioSources({ downloadUrl: [{ quality: '320kbps', link: 'https://aac.saavncdn.com/x/320.mp3' }] });
check(direct[0] === 'https://aac.saavncdn.com/x/320.mp3', 'songs play from the CDN first (no bytes through us)');
check(direct.some((u) => u.includes('/api/songs/cdn')), 'the proxy stays in the chain as the fallback');
const art = songs.songImageSrc({ image: 'https://c.saavncdn.com/art.jpg' });
check(art === 'https://c.saavncdn.com/art.jpg', 'album artwork is loaded from the CDN first');
check(songs.cdnProxy('https://c.saavncdn.com/art.jpg').includes('/api/songs/cdn'), 'the artwork proxy URL is available for the onError fallback');
ok('songs: direct CDN first, proxy as the fallback');

// ---------------------------------------------------------------- 4. live TV relay
const LiveTv = await imp('lib/liveTv.js');
check(LiveTv.tvRelayAllowed() === true, 'the TV relay is on by default');
process.env.NEXT_PUBLIC_TV_RELAY = 'off';
check(LiveTv.tvRelayAllowed() === false, 'NEXT_PUBLIC_TV_RELAY=off switches the TV relay off');
delete process.env.NEXT_PUBLIC_TV_RELAY;
check(typeof LiveTv.RELAY_BUDGET === 'number' && LiveTv.RELAY_BUDGET > 0, 'a tab has a bounded relay budget');
const player = read('components/LiveTvPlayer.js');
check(player.includes('RELAY_BUDGET') && player.includes('tvRelayAllowed'), 'the player respects the relay budget and the off switch');
const tvRoute = read('app/api/tv/p/route.js');
check(/s-maxage=/.test(tvRoute), 'relayed stream pieces are cacheable at the edge');
check(tvRoute.includes('tvRelayAllowed'), 'the relay route honours the off switch');
ok('live tv: budgeted relay, edge-cached pieces, off switch');

// ---------------------------------------------------------------- 5. middleware
const mw = read('middleware.js');
check(/matcher/.test(mw), 'middleware declares a matcher');
check(/_next\//.test(mw) && /icons\//.test(mw), 'the matcher skips the static asset folders');
check(/staticPath/.test(mw), 'file extensions are skipped before the blocklist is consulted');
ok('middleware no longer runs for static assets');

console.log(`\nAll v60 bandwidth-budget tests passed (${checks} checks).`);
