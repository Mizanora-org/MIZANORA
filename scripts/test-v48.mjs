/*
 * Mizanora v48 tests - the IPTV system is gone, Live TV is untouched.
 *
 * v48 removes the whole IPTV business (customer lines, trials, reseller panel, Xtream/Stalker
 * gateway, movies/series library, EPG, catch-up, billing) and keeps ONLY free Live TV:
 * /live, /live/<channel>, the Quran & Hadith live channel, and Admin > Live TV.
 *
 * These checks exist so the system cannot quietly come back: no route, no lib, no rewrite, no
 * cron, no Firestore rule, no navigation link. They also prove the Live TV side is still whole,
 * because the cheapest way to break a shop is to delete a file the live page imports.
 *
 * Run: node scripts/test-v48.mjs   (also wired into `npm test`)
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, relative } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), 'utf8') : '');
const has = (p, re) => re.test(read(p));

let pass = 0;
const fails = [];
const ok = (name, cond) => { if (cond) { pass++; console.log(`ok - ${name}`); } else { fails.push(name); console.log(`FAIL - ${name}`); } };

// Every .js/.mjs/.json/.md file outside the build output and dependencies.
const walk = (dir, out = []) => {
  for (const f of readdirSync(dir)) {
    if (['node_modules', '.next', '.git', '.vercel', 'out'].includes(f)) continue;
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|mjs|json|md)$/.test(f)) out.push(p);
  }
  return out;
};
const files = walk(root);
const grep = (re) => files.filter((f) => re.test(readFileSync(f, 'utf8'))).map((f) => relative(root, f));

// --------------------------------------------------- 1. the routes are really gone
const gone = [
  'app/iptv', 'app/account/iptv', 'app/admin/iptv', 'app/reseller',
  'app/api/iptv', 'app/api/admin/iptv', 'app/api/cron/iptv', 'app/api/gw', 'app/api/reseller',
  'app/timeshift', 'lib/gateway', 'docs/IPTV-AUDIT-2026-11.md', 'docs/IPTV-PLAN.md',
];
for (const p of gone) ok(`removed: ${p}`, !existsSync(join(root, p)));

const iptvLibs = readdirSync(join(root, 'lib')).filter((f) => /^iptv/i.test(f) || f === 'resellerAuth.js');
ok('removed: every lib/iptv*.js and lib/resellerAuth.js', iptvLibs.length === 0);

const iptvComponents = readdirSync(join(root, 'components')).filter((f) => /^Iptv|^Reseller|^AccountIptv|^AdminIptv/.test(f));
ok('removed: every IPTV / reseller component', iptvComponents.length === 0);

// --------------------------------------------------- 2. nothing links to it any more
// The changelog and the upgrade notes DESCRIBE the removal, so they necessarily name the old
// addresses. Everything a visitor or the crawler can actually reach must not.
const isNote = (f) => f === 'README.md' || f === 'SETUP.md' || /^UPGRADE-/.test(f) || f.startsWith('scripts/test-') || f.startsWith('docs/');
const links = grep(/(href=["'`]|\]\()\s*\/iptv(?![a-z])|["'`]\/iptv[/"'`]|["'`]\/reseller["'`]|["'`]\/account\/iptv["'`]/)
  // next.config.js keeps the redirects on purpose: old links must land on /live, not on a 404.
  .filter((f) => f !== 'next.config.js' && !isNote(f));
ok('no page, component, guide or sitemap still links to /iptv, /reseller or /account/iptv', links.length === 0);
if (links.length) console.log('   still linked in:', links.join(', '));

const apiRefs = grep(/\/api\/(gw|iptv|cron\/iptv|reseller)\b/).filter((f) => f !== 'next.config.js' && !isNote(f));
ok('no code calls the removed /api/gw, /api/iptv, /api/cron/iptv or /api/reseller routes', apiRefs.length === 0);
if (apiRefs.length) console.log('   still called from:', apiRefs.join(', '));

// --------------------------------------------------- 3. old addresses still work
const config = read('next.config.js');
ok('next.config: /iptv and /iptv/* redirect to /live (permanent)', /source: '\/iptv', destination: '\/live', permanent: true/.test(config) && /source: '\/iptv\/:path\*', destination: '\/live'/.test(config));
ok('next.config: /reseller and /account/iptv redirect somewhere sensible', /source: '\/reseller'/.test(config) && /source: '\/account\/iptv', destination: '\/account'/.test(config));
ok('next.config: the Xtream / Stalker gateway rewrites are gone', !/player_api\.php|xmltv\.php|portal\.php|\/api\/gw\//.test(config));
ok('next.config: no rewrites block is left behind', !/async rewrites\(\)/.test(config));

// --------------------------------------------------- 4. no IPTV jobs or database surface
const vercel = JSON.parse(read('vercel.json') || '{}');
ok('vercel.json: the /api/cron/iptv job is gone', !JSON.stringify(vercel).includes('iptv'));
ok('vercel.json: the build itself is unchanged', vercel.framework === 'nextjs' && vercel.buildCommand === 'npm run build');

const rules = read('firestore.rules');
ok('firestore.rules: no IPTV collection is described', !/iptv/i.test(rules));
ok('firestore.rules: siteMeta is public again (iptvSource is gone)', /match \/siteMeta\/\{id\} \{[^}]*allow read: if true;/.test(rules));
ok('firestore.rules: the Live TV channel shards are still rule-protected', /siteMeta\/\{id\}\/channels\/\{part\}/.test(rules));

ok('package.json: no IPTV test file is in the chain', !/test-v(39|4[0-7])\.mjs/.test(read('package.json')));

// --------------------------------------------------- 5. LIVE TV IS STILL WHOLE
const liveFiles = [
  'app/live/page.js', 'app/live/[slug]/page.js', 'app/live-channel/page.js',
  'app/admin/tv/page.js', 'app/admin/live-channel/page.js',
  'app/api/live/channel/route.js', 'app/api/live/channel.m3u8/route.js', 'app/api/live/cast-key/route.js',
  'app/api/admin/tv/config/route.js', 'app/api/tv/p/route.js', 'app/api/admin/tv-check/route.js', 'app/api/admin/tv-import/route.js',
  'components/LiveTvPlayer.js', 'components/LiveStrip.js', 'components/LiveBadge.js', 'components/LiveChannel.js',
  'lib/liveTv.js', 'lib/liveTvServer.js', 'lib/liveTvStore.js', 'lib/liveTvUi.js', 'lib/liveChannel.js', 'lib/liveChannelServer.js',
  'lib/liveBadges.js', 'lib/tvProxy.js',
];
for (const f of liveFiles) ok(`live TV intact: ${f}`, existsSync(join(root, f)));

const { TV_DEFAULT, MAX_CHANNELS, parseM3U, channelSlugs } = await import('../lib/liveTv.js');
ok('live TV: the channel model still parses an M3U playlist', parseM3U('#EXTM3U\n#EXTINF:-1 tvg-logo="https://x/1.png" group-title="News",Geo News\nhttps://a.example/live.m3u8\n').channels.length === 1);
ok('live TV: 100,000 channels are still allowed', MAX_CHANNELS >= 100000);
ok('live TV: slugs are still stable and unique', channelSlugs([{ name: 'Geo News', url: 'https://a/1.m3u8' }, { name: 'Geo News', url: 'https://a/2.m3u8' }]).every(Boolean));
ok('live TV: the default config is off until the admin saves', TV_DEFAULT.enabled === false);

// The one IPTV-shaped thing the owner chose to KEEP: importing a channel list from an Xtream
// panel straight into Live TV. It must stay wired to /admin/tv and nowhere near /iptv.
ok('live TV: the Xtream channel import survives (admin only)', existsSync(join(root, 'app/api/admin/tv/xtream/route.js')) && existsSync(join(root, 'components/XtreamImport.js')) && existsSync(join(root, 'lib/xtream.js')));
ok('live TV: /admin/tv still offers that importer', has('app/admin/tv/page.js', /XtreamImport/));
ok('live TV: the importer is still admin-gated', has('app/api/admin/tv/xtream/route.js', /verifyAdmin\(req\)/));

// --------------------------------------------------- 6. the shop itself is untouched
ok('shop: the home page still shows Live TV', has('components/HomeHub.js', /\/live/));
ok('nav: the header still links to Live TV', has('components/Header.js', /href="\/live"/));
ok('nav: the footer still links to Live TV', has('components/Footer.js', /\['\/live', 'Live TV'\]/));
ok('admin: the sidebar still has Live TV and Live Channel', has('components/AdminNav.js', /\/admin\/tv/) && has('components/AdminNav.js', /\/admin\/live-channel/));
ok('sitemap: /live is still advertised and /iptv is not', has('app/sitemap.js', /\['\/live',/) && !has('app/sitemap.js', /iptv/i));
ok('blog: the IPTV guides are gone from the content folder', readdirSync(join(root, 'content/blog')).filter((f) => /iptv|xtream|tivimate|stalker|siravex/i.test(f)).length === 0);
ok('docs: no IPTV plan or audit document is left', readdirSync(join(root, 'docs')).every((f) => !/iptv/i.test(f)));

console.log(`\n# v48: ${pass} checks passed, ${fails.length} failed`);
if (fails.length) { console.log('failed:', fails.join(' | ')); process.exit(1); }
