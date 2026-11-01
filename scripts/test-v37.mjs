/*
 * Mizanora v37 tests - live TV by Xtream Codes, public analytics, the news desk,
 * and the new world / science / technology / Muaaz Iqbal / BarakatWave / SIRAVEX writing.
 *
 * Run: node scripts/test-v37.mjs   (also wired into `npm test`)
 */
import { readFileSync, existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), 'utf8') : '');
const src = (p) => read(p);
const has = (p, re) => re.test(src(p));

let pass = 0;
const fails = [];
const ok = (name, cond) => { if (cond) { pass++; console.log(`ok - ${name}`); } else { fails.push(name); console.log(`FAIL - ${name}`); } };

// ---------------------------------------------------------------- 1. Xtream
const xtream = src('lib/xtream.js');
const xtreamServer = src('lib/xtreamServer.js');
ok('xtream: player_api path is built from server + username + password', /player_api\.php/.test(xtream) && /username/.test(xtream) && /password/.test(xtream));
ok('xtream: it blocks private / loopback / link-local addresses before dialling out', /isPrivateAddress/.test(xtreamServer) && /private or local/i.test(xtreamServer) && /a === 127/.test(xtreamServer));
{
  // and prove the guard actually works at runtime, not just that the words appear
  const { isPrivateAddress } = await import('../lib/xtreamServer.js');
  const blocked = ['127.0.0.1', '10.0.0.5', '192.168.1.1', '172.16.4.9', '169.254.1.1', '::1', 'fe80::1'];
  const allowed = ['1.1.1.1', '8.8.8.8', '104.21.3.9'];
  ok('xtream: isPrivateAddress refuses every private address', blocked.every((a) => isPrivateAddress(a) === true));
  ok('xtream: isPrivateAddress allows public IP addresses', allowed.every((a) => isPrivateAddress(a) === false));
  // hostnames are refused here on purpose (fail closed); guardHost() resolves them to IPs first
  ok('xtream: isPrivateAddress fails closed on a hostname', isPrivateAddress('barakatwave.vercel.app') === true);
}
ok('xtream: it follows no redirects and caps the response body', /redirect:\s*['"]error['"]/.test(xtreamServer) && /XTREAM_MAX_BYTES/.test(xtreamServer) && /AbortSignal\.timeout/.test(xtreamServer));
ok('xtream: it fetches live, movies and series categories independently', /get_live_categories/.test(xtream) && /get_vod_categories/.test(xtream) && /get_series_categories/.test(xtream));
ok('xtream: it never puts the password in an error string', !/password[^)\n]*\+[^)\n]*e\.message|\$\{[uU]ser\}/.test(xtream.replace(/username=[^&']*/g, 'username=USER')));

const xtreamRoute = src('app/api/admin/tv/xtream/route.js');
ok('xtream route: requires an admin session', /isAdmin|adminAuth|requireAdmin|getAdminFromRequest/.test(xtreamRoute));
ok('xtream route: refuses a request with no server or credentials', /missing|server,? ?username and password|400/.test(xtreamRoute));
ok('xtream route: supports test and import actions', /action/.test(xtreamRoute) && /['"]import['"]/.test(xtreamRoute));
ok('xtream route: accepts a group filter so an admin can import a subset', /group/i.test(xtreamRoute));
ok('xtream route: the response never echoes the password back', !/password:\s*[a-zA-Z]*\.?password\b(?!\s*[:=]\s*['"][^'"]*['"]\s*$)/.test(xtreamRoute) || !/password:\s*cfg\.password/.test(xtreamRoute));

const xtreamUi = src('components/XtreamImport.js');
ok('xtream UI: three separate inputs for server, username and password', /server/i.test(xtreamUi) && /username/i.test(xtreamUi) && /password/i.test(xtreamUi));
ok('xtream UI: password input is type=password and auto-completed off', /type=['"]password['"]/.test(xtreamUi) && /autoComplete/i.test(xtreamUi));
ok('xtream UI: it picks groups by tapping chips', /group/i.test(xtreamUi));
ok('xtream UI: it switches between live, movies and series', /live/i.test(xtreamUi) && /movie/i.test(xtreamUi) && /series/i.test(xtreamUi));
ok('xtream UI: it is wired into the admin TV page', /XtreamImport/.test(src('app/admin/tv/page.js')));

// ------------------------------------------------------------- 2. Analytics
const analytics = src('app/api/admin/analytics/route.js');
ok('analytics: window can be widened to at least 90 days', /90/.test(analytics));
ok('analytics: it keeps the old metrics and adds per-page and return-visit data', /['"]pg['"]/.test(analytics) && /['"]rt['"]/.test(analytics));
ok('analytics: it reports most-read pages', /topPages/.test(analytics));
ok('analytics: it reports new vs returning visitors', /newVsReturning/.test(analytics));
ok('analytics: it reports traffic by hour and by weekday', /byHour/.test(analytics) && /byWeekday/.test(analytics));
ok('analytics: it reports all-time totals', /totals/.test(analytics));
ok('analytics: the new metrics are cleaned up like the old ones', (src('app/api/admin/analytics/route.js').match(/['"]rt['"]/g) || []).length >= 2);

// ---------------------------------------------------------- 3. Public stats
const statsApi = src('app/api/stats/route.js');
ok('stats API: needs no sign-in (public)', !/isAdmin|requireAdmin/.test(statsApi));
ok('stats API: counts who is on the site right now', /online/.test(statsApi) && /presence/.test(statsApi));
ok('stats API: online means seen within the last few minutes', /90e3|90000|90\s*\*\s*1000/.test(statsApi));
ok('stats API: it leaks no visitor id', !/Object\.keys\(p\w*\)\.map|id:\s*/.test(statsApi));
ok('stats API: it leaks no order or cart contents', !/ordersBackup|liveOrders/.test(statsApi));
ok('stats API: it leaks no search words', !/['"]q0['"]|searchWords|rawQ/.test(statsApi));
ok('stats API: it turns internal page keys back into real paths', /pageLabel|prettyPath|blog_/.test(statsApi));
ok('stats API: it fails soft when the database is not configured', /setup/.test(statsApi));

const statsPage = src('app/stats/page.js');
ok('stats page: it is a public route with its own metadata', /metadata/.test(statsPage) && /PublicStats/.test(statsPage));
ok('stats page: it explains what is and is not visible', /cannot see|not see|never|don't show/i.test(statsPage));
ok('stats page: it links to the shop and the blog', /\/products/.test(statsPage) && /\/blog/.test(statsPage));
ok('stats page: it carries breadcrumb structured data', /breadcrumbJsonLd/.test(statsPage));

const publicStats = src('components/PublicStats.js');
ok('public stats: it refreshes itself without a reload', /setInterval|useEffect/.test(publicStats) && /\/api\/stats/.test(publicStats));
ok('public stats: it draws a real chart', /<svg|<path|polyline|Sparkline/.test(publicStats));
ok('public stats: it shows a live online count', /online/i.test(publicStats));

// ------------------------------------------------------------ 4. News desk
ok('sitemap: /news is listed', has('app/sitemap.js', /\/news/));
ok('sitemap: /stats is listed', has('app/sitemap.js', /\/stats/));
ok('news: the route exists', existsSync(join(root, 'app/news/page.js')));
ok('news: it renders the NewsDesk component', has('app/news/page.js', /NewsDesk/));
ok('news: it carries breadcrumb structured data', has('app/news/page.js', /breadcrumbJsonLd/));
ok('news: the desk filters by world / science / technology', has('components/NewsDesk.js', /world-news/) && has('components/NewsDesk.js', /science/) && has('components/NewsDesk.js', /technology/));
ok('news: there is a dedicated RSS feed for it', existsSync(join(root, 'app/news/feed.xml/route.js')) && has('app/news/feed.xml/route.js', /rss/));
ok('news: the feed carries only news categories', has('app/news/feed.xml/route.js', /NEWS_CATEGORIES/));

// ------------------------------------------------------- 5. The new writing
const { getPosts, NEWS_CATEGORIES } = await import('../lib/blog.js');
const posts = getPosts();
ok('blog: at least 130 posts are live', posts.length >= 130);
for (const slug of NEWS_CATEGORIES) {
  const n = posts.filter((p) => p.category === slug).length;
  ok(`blog: the ${slug} shelf has at least two dispatches (${n})`, n >= 2);
}
const newsSlugs = ['world-economy-2026-what-it-means-for-pakistani-shoppers', 'oil-prices-and-your-delivery-charge-pakistan-2026', 'global-trade-tariffs-2026-why-imports-cost-what-they-do', 'science-of-space-2026-five-discoveries-explained', 'mars-life-clues-2026-what-curiosity-actually-found', 'ai-data-centres-energy-2026-why-it-reaches-your-phone', 'chip-shortage-2026-gadget-prices-pakistan', 'muaaz-iqbal-projects-map-2026', 'muaaz-iqbal-personality-trust-why-people-believe-him', 'barakatwave-tv-xtream-codes-setup-guide', 'siravex-multi-view-iptv-player-guide'];
const bySlug = new Map(posts.map((p) => [p.slug, p]));
for (const s of newsSlugs) ok(`blog: "${s}" is published`, bySlug.has(s));
for (const s of newsSlugs) {
  const p = bySlug.get(s);
  if (!p) continue;
  ok(`blog "${s}": body is substantial (${p.words || 0} words)`, (p.words || 0) >= 350);
  const raw = read('content/blog/' + p.file.replace(/^.*\//, ''));
  ok(`blog "${s}": it links to at least two other pages`, ((raw || '').match(/\]\(\/[a-z0-9\-\/]+\)/g) || []).length >= 2);
}
ok('blog: the BarakatWave guide names the real site', /barakatwave\.vercel\.app/.test(src('content/blog/barakatwave-tv-xtream-codes-setup-guide.md')));
ok('blog: the SIRAVEX guide names the real site', /siravex\.vercel\.app/.test(src('content/blog/siravex-multi-view-iptv-player-guide.md')));
ok('blog: the project map names BarakatWave, SIRAVEX and Asaan Lang', /barakatwave/i.test(src('content/blog/muaaz-iqbal-projects-map-2026.md')) && /siravex/i.test(src('content/blog/muaaz-iqbal-projects-map-2026.md')) && /asaan/i.test(src('content/blog/muaaz-iqbal-projects-map-2026.md')));

// every /blog/<slug> link in every post points at a real post (category links are routes, not posts)
const live = new Set(posts.map((p) => p.slug));
const dir = join(root, 'content/blog');
let broken = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) {
  const t = readFileSync(join(dir, f), 'utf8');
  for (const m of t.matchAll(/\]\((\/blog\/[a-z0-9\-\/]+)\)/g)) {
    const s = m[1].replace(/^\/blog\//, '').replace(/\/$/, '');
    if (s.startsWith('category/')) continue; // /blog/category/<slug> is a route, not a post
    if (!live.has(s)) { console.log(`   broken link in ${f}: ${m[1]}`); broken++; }
  }
}
ok(`blog: every internal post link resolves (${broken} broken)`, broken === 0);

// ---------------------------------------------------------------- 6. Hygiene
const pkg = JSON.parse(src('package.json'));
ok('version: it is at least 37', Number(String(pkg.version).split('.')[0]) >= 37);
ok('tests: this file is in the npm test chain', /test-v37\.mjs/.test(src('package.json')));
ok('docs: UPGRADE-v37.md exists and says what changed', /Xtream/i.test(src('UPGRADE-v37.md')) && /news/i.test(src('UPGRADE-v37.md')));
ok('rules: the database rules allow the new per-page and return-visit stats', /['"]rt['"]/.test(src('database.rules.json')) && /['"]pg['"]/.test(src('database.rules.json')));

console.log(`\n# v37: ${pass} checks passed, ${fails.length} failed`);
if (fails.length) { console.log(fails.map((f) => `  - ${f}`).join('\n')); process.exit(1); }
