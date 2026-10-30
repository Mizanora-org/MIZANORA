// v33 tests: the pure-live badges (every surface) and the live GitHub section.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const exists = (f) => fs.existsSync(path.join(root, f));
const imp = (f) => import(pathToFileURL(path.join(root, f)).href);
let n = 0;
const ok = (msg) => { n++; console.log('ok    ' + msg); };

// ---------------------------------------------------------------------------
// 1. Badge tones and labels - one model, no fake numbers
// ---------------------------------------------------------------------------
const B = await imp('lib/liveBadges.js');
assert.deepEqual(B.BADGE_STATES, ['live', 'soon', 'fresh', 'idle', 'warn']);
assert.equal(B.badgeTone('LIVE'), 'live');
assert.equal(B.badgeTone('on-air'), 'live');
assert.equal(B.badgeTone('next'), 'soon');
assert.equal(B.badgeTone('new'), 'fresh');
assert.equal(B.badgeTone('error'), 'warn');
assert.equal(B.badgeTone('something'), 'idle');
assert.equal(B.badgeTone(undefined), 'idle');
assert.equal(B.STATE_LABEL.live, 'LIVE');
ok('badge tones: live / soon / fresh / idle / warn from any word');

// ---------------------------------------------------------------------------
// 2. Pakistan clock - Asia/Karachi, ticking, never throws
// ---------------------------------------------------------------------------
const fixed = Date.UTC(2026, 9, 30, 12, 0, 0); // 17:00 PKT
const c = B.liveClock(fixed);
assert.equal(c.hms, '17:00:00');
assert.equal(c.hm, '17:00');
assert.equal(c.tz, 'PKT');
assert.equal(c.day, 'Fri');
assert.match(c.date, /2026/);
assert.equal(B.liveClock(0).hms.length, 8, 'a bad number still gives a clock');
assert.match(B.liveClock(NaN).hms, /^\d\d:\d\d:\d\d$/);
ok('clock: PKT time, day and date are computed from any timestamp');

// ---------------------------------------------------------------------------
// 3. "how long ago" in Roman Urdu + fresh/format helpers
// ---------------------------------------------------------------------------
const now = Date.UTC(2026, 9, 30, 12, 0, 0);
assert.equal(B.timeAgo(now - 30 * 1000, now).text, 'abhi abhi');
assert.equal(B.timeAgo(now - 5 * 60000, now).text, '5 minute pehle');
assert.equal(B.timeAgo(now - 3 * 3600000, now).text, '3 ghante pehle');
assert.equal(B.timeAgo(now - 2 * 86400000, now).text, '2 din pehle');
assert.equal(B.timeAgo(now - 90 * 86400000, now).text, '3 mahine pehle');
assert.equal(B.timeAgo(0, now).text, 'kabhi nahi');
assert.equal(B.timeAgo(now + 3600000, now).text, 'abhi abhi', 'a clock a little ahead never says "in the future"');
assert.equal(B.isFresh(now - 3600000, now), true);
assert.equal(B.isFresh(now - 30 * 86400000, now), false);
assert.equal(B.isFresh(now + 86400000, now), false, 'a future date is not "new"');
assert.equal(B.isFresh(0, now), false);
assert.equal(B.formatCount(999), '999');
assert.equal(B.formatCount(1234), '1.2k');
assert.equal(B.formatCount(12000), '12k');
assert.equal(B.formatCount(1500000), '1.5m');
assert.equal(B.formatCount(-5), '0');
ok('timeAgo: "abhi abhi", minutes, hours, days in Roman Urdu; formatCount: 1.2k / 1.5m');

// ---------------------------------------------------------------------------
// 4. What is playing right now (the channel segments)
// ---------------------------------------------------------------------------
const quran = { kind: 'quran', surah: 2, ayah: 255, surahName: 'Al-Baqarah' };
const t = B.segmentTitle(quran);
assert.equal(t.title, 'Quran Tilawat');
assert.equal(t.sub, 'Al-Baqarah 2:255');
assert.equal(B.segmentTitle({ kind: 'hadith', book: 'bukhari', section: 3 }).sub, 'bukhari · hissa 3');
assert.equal(B.segmentTitle({ kind: 'ad', slug: 'gold-ring' }).sub, 'gold ring');
assert.equal(B.segmentTitle(null).title, 'Kuch nahi chal raha');
ok('now playing: Quran / hadees / product ad all get a clean title');

// ---------------------------------------------------------------------------
// 5. The live bar model - on air and off air
// ---------------------------------------------------------------------------
const onAir = B.channelBanner({
  onAir: true, why: 'on', progress: 0.4,
  seg: { kind: 'quran', surah: 2, ayah: 255, surahName: 'Al-Baqarah', endMs: now + 5 * 60000 },
  next: [{ kind: 'hadith', book: 'bukhari', section: 2 }],
}, now);
assert.equal(onAir.onAir, true);
assert.equal(onAir.tone, 'live');
assert.equal(onAir.label, 'LIVE');
assert.equal(onAir.progress, 0.4);
assert.equal(onAir.nextInMs, 5 * 60000);
assert.match(onAir.nextTitle, /Hadees/);
const offAir = B.channelBanner({ onAir: false, why: 'off' }, now);
assert.equal(offAir.onAir, false);
assert.equal(offAir.label, 'OFF AIR');
assert.equal(offAir.progress, 0);
const scheduled = B.channelBanner({ onAir: false, why: 'waiting' }, now);
assert.equal(scheduled.label, 'SCHEDULED');
assert.equal(B.channelBanner(null, now).onAir, false);
ok('live bar: LIVE with progress + "next", OFF AIR and SCHEDULED when it is not running');

// The strip never invents numbers: with no config there is nothing on air.
const empty = B.stripModel({ playing: null, tv: null, now });
assert.equal(empty.liveNow, false);
assert.equal(empty.tvCount, 0);
assert.deepEqual(empty.channels, []);
const full = B.stripModel({
  playing: { onAir: true, progress: 0.5, seg: { kind: 'quran', surah: 1, ayah: 1, surahName: 'Al-Fatihah', endMs: now + 60000 } },
  tv: { count: 2, channels: [{ name: 'Geo News', slug: 'geo' }, { name: 'Hum TV', slug: 'hum' }, { name: 'Off', slug: 'x', off: true }] },
  now, tickers: ['Quran 24/7', 'x'.repeat(400)],
});
assert.equal(full.liveNow, true);
assert.equal(full.tvCount, 2, 'a channel switched off is not counted');
assert.equal(full.channels[0].badge.label, 'LIVE NEWS');
assert.equal(full.channels[1].badge.label, 'LIVE');
assert.equal(full.tickers.length, 2);
assert.ok(full.tickers[1].length <= 140, 'a ticker line is trimmed');
ok('strip model: real channel state only, off-air channels dropped, tickers trimmed');

// ---------------------------------------------------------------------------
// 6. Reel badges: trending / new / real discount
// ---------------------------------------------------------------------------
assert.equal(B.reelBadges({}, 0, now)[0].label, 'TRENDING');
assert.equal(B.reelBadges({ createdAt: now - 86400000 }, 3, now)[0].label, 'NEW');
const deal = B.reelBadges({ price: 800, comparePrice: 1000 }, 3, now);
assert.ok(deal.some((b) => b.label === '20% OFF'), 'a real comparePrice gives a real % badge');
assert.deepEqual(B.reelBadges({ price: 100, comparePrice: 100 }, 2, now), [], 'no fake discount');
assert.ok(B.reelBadges({}, 0, now).length <= 2, 'at most two badges on a card');
// getReels has to carry the two fields the badge needs.
const products = read('lib/products.js');
assert.match(products, /comparePrice: p \? Number\(p\.comparePrice\)/, 'reels carry comparePrice');
assert.match(products, /createdAt: Number\(r\.createdAt\)/, 'curated reels carry createdAt');
ok('reel badges: TRENDING / NEW / real % off only');

// ---------------------------------------------------------------------------
// 7. GitHub: the model, the fallbacks and the safety rules
// ---------------------------------------------------------------------------
const G = await imp('lib/githubRepos.js');
const p = G.normaliseProfile({ login: 'muaaziqbalvip', name: 'MUAAZ IQBAL', followers: 6, public_repos: 92, avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4', html_url: 'https://github.com/muaaziqbalvip', created_at: '2025-11-28T00:00:00Z' });
assert.equal(p.login, 'muaaziqbalvip');
assert.equal(p.repos, 92);
assert.equal(p.followers, 6);
assert.equal(p.fallback, false);
assert.equal(G.normaliseProfile(null).fallback, true, 'no GitHub answer -> the code fallback');
// Only https links reach the page.
assert.equal(G.normaliseProfile({ login: 'x', avatar_url: 'javascript:alert(1)', html_url: 'http://evil.test' }).avatar, '');
assert.match(G.normaliseProfile({ login: 'x', html_url: 'http://evil.test' }).url, /^https:\/\/github\.com\//);
assert.ok(G.normaliseProfile({ login: 'x', bio: 'a'.repeat(900) }).bio.length <= 240);

const repo = G.shapeRepo({ name: 'MIZANORA', full_name: 'muaaziqbalvip/MIZANORA', description: 'Shop', language: 'JavaScript', stargazers_count: 5, forks_count: 2, homepage: 'https://mizanora.vercel.app', topics: ['shop', 'nextjs'], license: { spdx_id: 'MIT' }, created_at: '2025-12-01T00:00:00Z', pushed_at: '2026-10-25T00:00:00Z', fork: false });
assert.equal(repo.url, 'https://github.com/muaaziqbalvip/MIZANORA');
assert.equal(repo.stars, 5);
assert.equal(repo.licence, 'MIT');
assert.equal(repo.homepage, 'https://mizanora.vercel.app');
assert.equal(G.shapeRepo({}), null, 'a repo without a name is dropped');
assert.equal(G.shapeRepo({ name: 'x', homepage: 'javascript:alert(1)' }).homepage, '', 'only http(s) demo links');

const clean = G.cleanRepos([
  repo,
  G.shapeRepo({ name: 'forked', fork: true, pushed_at: '2026-10-29T00:00:00Z' }),
  G.shapeRepo({ name: 'Hidden' }),
  G.shapeRepo({ name: 'old', pushed_at: '2020-01-01T00:00:00Z' }),
], { hide: ['hidden'] });
assert.deepEqual(clean.map((r) => r.name), ['MIZANORA', 'old'], 'forks and hidden repos are out, newest push first');

const langs = G.languageStats([repo, G.shapeRepo({ name: 'a', language: 'JavaScript' }), G.shapeRepo({ name: 'b', language: 'Python' })], 5);
assert.equal(langs[0].name, 'JavaScript');
assert.equal(langs[0].count, 2);
assert.equal(langs[0].color, '#f1e05a');
assert.equal(langs.reduce((s, l) => s + l.count, 0), 3);
assert.deepEqual(G.languageStats([]), []);
assert.equal(G.langColor('Nope'), '#8b949e');

const summary = G.repoSummary(p, G.cleanRepos([repo]));
assert.equal(summary.stars, 5);
assert.equal(summary.publicRepos, 92);
assert.equal(summary.topLanguage, 'JavaScript');
assert.equal(summary.repos, 1);
assert.ok(summary.lastPushMs > 0);

const featured = G.pickFeatured([G.shapeRepo({ name: 'a', pushed_at: '2026-10-01T00:00:00Z' }), G.shapeRepo({ name: 'b', pushed_at: '2026-10-02T00:00:00Z' })], ['b'], 2);
assert.equal(featured[0].name, 'b', 'the owner\'s pinned repos come first');
assert.equal(featured.length, 2);
assert.equal(G.pickFeatured([], ['none'], 3).length, 0);

const badges = G.githubBadges({ createdMs: now - 86400000, pushedMs: now - 3600000, homepage: 'https://x.test', archived: true }, now);
const labels = badges.map((b) => b.label);
assert.ok(labels.includes('NEW') && labels.includes('ACTIVE') && labels.includes('LIVE DEMO') && labels.includes('ARCHIVED'));
assert.ok(badges.length <= 4);
assert.ok(G.githubBadges({ licence: 'MIT' }, now).some((b) => b.label === 'MIT'));
assert.deepEqual(G.githubBadges({ pushedMs: now - 400 * 86400000 }, now), [], 'an idle repo gets no badge');

// No answer from GitHub: the same layout renders from the code fallback.
const fb = G.githubModel({ at: now, error: 'GitHub 403' });
assert.equal(fb.fallback, true);
assert.ok(fb.repos.length >= 4, 'the fallback list is never empty');
assert.ok(fb.featured.length > 0);
assert.equal(fb.ok, false);
assert.equal(fb.error, 'GitHub 403');
const live = G.githubModel({ profile: { login: 'muaaziqbalvip', public_repos: 1 }, repos: [{ name: 'MIZANORA', pushed_at: '2026-10-25T00:00:00Z' }], at: now });
assert.equal(live.ok, true);
assert.equal(live.fallback, false);
assert.equal(live.featured[0].name, 'MIZANORA');
ok('github: profile/repos/languages/badges, https-only links, code fallback when GitHub is down');

// ---------------------------------------------------------------------------
// 8. The files that make it live (route, cache, pages, footer)
// ---------------------------------------------------------------------------
assert.ok(exists('app/api/github/route.js'), 'the public GitHub JSON route exists');
const route = read('app/api/github/route.js');
assert.match(route, /getGitHub/);
assert.match(route, /s-maxage=1800/);
assert.match(route, /Access-Control-Allow-Origin/);
assert.doesNotMatch(route, /GITHUB_TOKEN|Authorization/, 'the public route never touches the token');

const server = read('lib/githubLive.js');
assert.match(server, /unstable_cache/);
assert.match(server, /tags: \['github'\]/);
assert.match(server, /try \{[\s\S]*catch/, 'a GitHub failure can never break a page');
assert.match(server, /failedAt/, 'a failed GitHub read is retried in a minute, not cached for half an hour');
assert.match(server, /if \(d\.fallback\) throw/, 'only a successful read goes into the cache');
assert.match(read('app/api/revalidate/route.js'), /'github'/, 'the admin can refresh GitHub immediately');

const page = read('app/muaaz-iqbal/page.js');
assert.match(page, /GitHubLive/);
assert.match(page, /getGitHub/);
assert.match(read('app/team/page.js'), /GitHubLive/);
ok('routes: /api/github cached + public, tag "github", profile and team pages show it');

// Every live surface gets the animated badge / bar.
const strip = read('components/LiveStrip.js');
assert.match(strip, /prefers-reduced-motion|is-onair/);
assert.match(read('components/LiveBadge.js'), /mz-lb/);
assert.match(read('app/live/page.js'), /LiveStrip/, '/live has the bar');
assert.match(read('app/page.js'), /LiveStrip/, 'the home page has the bar');
assert.match(read('app/reels/page.js'), /LiveBadge/, '/reels has live badges');
assert.match(read('components/ReelsRail.js'), /reelBadges/, 'reel cards carry the badges');
assert.match(read('app/globals.css'), /\.mz-lb \{/, 'badge styles exist');
assert.match(read('app/globals.css'), /prefers-reduced-motion/, 'animations respect reduced motion');
ok('surfaces wired: home, /live, /reels, reel cards, GitHub section');

// ---------------------------------------------------------------------------
// 9. Hydration safety: the first paint is the same on the server and browser
// ---------------------------------------------------------------------------
assert.match(strip, /initialAt/, 'the server timestamp is the first frame');
assert.match(strip, /useState\(0\)/, 'the clock starts stopped, then ticks after mount');
assert.doesNotMatch(strip, /useState\(\(\) => Date\.now\(\)\)/, 'no Date.now() in the first render (no hydration mismatch)');
const gh = read('components/GitHubLive.js');
assert.match(gh, /referrerPolicy="no-referrer"/);
assert.match(gh, /alt=""/, 'the avatar is decorative');
ok('hydration: server and browser draw the same first frame');

console.log(`\n${n} checks passed (v33: live badges + GitHub)`);
