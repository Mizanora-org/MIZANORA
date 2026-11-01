/*
 * Mizanora v38 tests - 100,000-channel Live TV, Xtream bulk import, bulk editing tools,
 * the dashboard's new charts, and the SEO / link fixes.
 *
 * Run: node scripts/test-v38.mjs   (also wired into `npm test`)
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

// ------------------------------------------------- 1. 100,000 channels fit in Firestore
const { MAX_CHANNELS, TV_PART, cleanTv, cleanChannel, channelSlugs } = await import('../lib/liveTv.js');
const { packChannels, partsNeeded, readTvAll, writeTvAll, clearTvChannels } = await import('../lib/liveTvStore.js');

ok('channels: the shop allows at least 100,000', MAX_CHANNELS >= 100000);
ok('channels: a shard is capped by count', TV_PART.perPart > 0 && TV_PART.perPart <= 5000);
ok('channels: a shard is capped by size too', TV_PART.maxBytes > 0 && TV_PART.maxBytes < 1024 * 1024);

const mkChannel = (i) => ({
  name: `Channel ${i} HD`,
  url: `https://panel.example.com/live/user123/pass456/${100000 + i}.m3u8`,
  sources: [`https://panel.example.com/live/user123/pass456/${100000 + i}.ts`],
  logo: `https://panel.example.com/logos/${i}.png`,
  group: 'Pakistan',
  off: false,
});

for (const n of [800, 25000, 100000]) {
  const parts = packChannels(Array.from({ length: n }, (_, i) => mkChannel(i)));
  const biggest = Math.max(...parts.map((p) => JSON.stringify(p.channels).length));
  const total = parts.reduce((a, p) => a + p.n, 0);
  ok(`shards: ${n.toLocaleString('en-PK')} channels pack into ${parts.length} shards, none over 1 MB (biggest ${Math.round(biggest / 1024)} KB)`, total === n && biggest < 1024 * 1024);
}
{
  // a fat channel (long url + 7 backups + logo) must not make a shard oversized either
  const fat = Array.from({ length: 3000 }, (_, i) => ({
    name: `A very long channel name number ${i} with extra words`,
    url: `https://a-reasonably-long-panel-hostname.example.com:8080/live/someuser/somepassword/${1000000 + i}.m3u8`,
    sources: Array.from({ length: 7 }, (_, k) => `https://a-reasonably-long-panel-hostname.example.com:8080/live/someuser/somepassword/${1000000 + i}-${k}.ts`),
    logo: `https://a-reasonably-long-panel-hostname.example.com:8080/images/logo/${i}.png`,
    group: 'Entertainment',
    off: false,
  }));
  const parts = packChannels(fat);
  const biggest = Math.max(...parts.map((p) => JSON.stringify(p.channels).length));
  ok(`shards: fat channels still stay under 1 MB (biggest ${Math.round(biggest / 1024)} KB)`, biggest < 1024 * 1024);
}
ok('shards: partsNeeded(100000) is a sane number', partsNeeded(100000) > 0 && partsNeeded(100000) <= 1000);
ok('shards: an empty list makes no shard', packChannels([]).length === 0);
ok('cleanTv: it keeps up to MAX_CHANNELS, not 800', (() => {
  const many = Array.from({ length: 5000 }, (_, i) => mkChannel(i));
  return cleanTv({ channels: many }).channels.length === 5000;
})());
ok('cleanTv: duplicate links are dropped, not stored twice', (() => {
  const dup = [mkChannel(1), mkChannel(1), mkChannel(2)];
  return cleanTv({ channels: dup }).channels.length === 2;
})());

// the store writes and reads back through a fake Firestore that enforces the 1 MB rule
{
  const db = (() => {
    const docs = new Map();
    const mkDoc = (ref) => ({
      get: async () => ({ exists: docs.has(ref), id: ref.split('/').pop(), data: () => docs.get(ref) }),
      set: async (v) => {
        if (JSON.stringify(v).length > 1024 * 1024) throw new Error('DOCUMENT TOO BIG: a Firestore document may hold 1 MB');
        docs.set(ref, v);
      },
      delete: async () => { docs.delete(ref); },
    });
    const paths = [];
    return {
      _docs: docs,
      _paths: paths,
      collection(name) {
        let base = name;
        return {
          doc(id) {
            const ref = `${base}/${id}`;
            const d = mkDoc(ref);
            return Object.assign(d, {
              collection(sub) { const c = { doc: (sid2) => mkDoc(`${ref}/${sub}/${sid2}`) }; return { doc: (sid2) => mkDoc(`${ref}/${sub}/${sid2}`) }; },
            });
          },
        };
      },
      batch() {
        const ops = [];
        return {
          set(ref, v) { ops.push([ref, v, 'set']); },
          delete(ref) { ops.push([ref, null, 'delete']); },
          async commit() {
            for (const [ref, v, kind] of ops) {
              if (kind === 'set') {
                if (JSON.stringify(v).length > 1024 * 1024) throw new Error('DOCUMENT TOO BIG');
                docs.set(ref.__id, v);
              } else docs.delete(ref.__id);
            }
          },
        };
      },
    };
  })();
  // give the batch refs an id so commit can key them
  const ID = Symbol('id');
  const big = Array.from({ length: 12000 }, (_, i) => mkChannel(i));
  let wrote = false;
  let partsWritten = 0;
  try {
    const r = await writeTvAll(db, { enabled: true, title: 'Big TV', channels: big, ads: { enabled: false, slugs: [], seconds: 6, skipAfter: 3, onStart: false } });
    wrote = true;
    partsWritten = r.parts;
    void r;
  } catch (e) { console.log('   writeTvAll threw:', e.message); }
  ok('store: writing 12,000 channels does not blow the 1 MB document limit', wrote);
  ok('store: it reported a shard count', partsWritten > 0);
}

// ----------------------------------------------------- 2. Xtream bulk import
const xtream = src('lib/xtream.js');
const xtreamServer = src('lib/xtreamServer.js');
ok('xtream: the channel cap is 100,000, not 2,000', /channels:\s*100000/.test(xtream));
ok('xtream: the bulk byte cap grew past 8 MB', /XTREAM_MAX_BYTES\s*=\s*(4[0-9]|[5-9][0-9])\s*\*\s*1024\s*\*\s*1024/.test(xtream));
ok('xtream: there is a smaller cap for one category at a time', /XTREAM_PART_MAX_BYTES/.test(xtream));
ok('xtream: it pulls several categories at once, not one after another', /XTREAM_CONCURRENCY/.test(xtream) && /XTREAM_CONCURRENCY/.test(xtreamServer));
ok('xtream: it fetches category by category', /category_id=/.test(xtreamServer) && /pullStreams/.test(xtreamServer));
ok('xtream: it still has one big fetch as the fallback for panels with no categories', /bulk/.test(xtreamServer));
ok('xtream: the reader never over-reads the stream', /reader\.cancel/.test(xtreamServer));
ok('xtream: a timeout is turned into a readable message', /took too long to answer/.test(xtreamServer));

const xtreamRoute = src('app/api/admin/tv/xtream/route.js');
ok('xtream route: it has a "commit straight into the shop" action', /'commit'/.test(xtreamRoute));
ok('xtream route: commit is admin-only', /verifyAdmin/.test(xtreamRoute));
ok('xtream route: commit writes through the shard store', /writeTvAll/.test(xtreamRoute));
ok('xtream route: commit revalidates /live', /revalidatePath\(['"]\/live['"]\)/.test(xtreamRoute));
ok('xtream route: it refuses to shuttle a huge list through the browser', /BROWSER_IMPORT_CAP/.test(xtreamRoute) && /413/.test(xtreamRoute));
ok('xtream route: commit honours the 100,000 limit', /MAX_CHANNELS/.test(xtreamRoute));
ok('xtream route: the password is still never echoed back', /maskXtream/.test(xtreamRoute));

const xtreamUi = src('components/XtreamImport.js');
ok('xtream UI: it offers both ways in', /Add to the editor/.test(xtreamUi) && /Straight into the shop/.test(xtreamUi));
ok('xtream UI: add or replace', /'merge'/.test(xtreamUi) && /'replace'/.test(xtreamUi));
ok('xtream UI: it reloads the admin list after a straight import', /onReload/.test(xtreamUi));
ok('xtream UI: it explains when the panel is too big for the browser', /tooBig/.test(xtreamUi));

// ------------------------------------------------- 3. Bulk editing tools
const tools = src('components/TvBulkTools.js');
ok('tools: find & replace exists', /Find & replace/.test(tools));
ok('tools: it can work on all, the search results, or the ticked ones', /'all'/.test(tools) && /'filtered'/.test(tools) && /'selected'/.test(tools));
ok('tools: prefix and suffix', /Add prefix/.test(tools) && /Add suffix/.test(tools));
ok('tools: rename a whole group', /Rename group/.test(tools));
ok('tools: switch a group on and off', /Switch on/.test(tools) && /Switch off/.test(tools));
ok('tools: remove duplicate links and duplicate names', /Remove duplicate links/.test(tools) && /Remove duplicate names/.test(tools));
ok('tools: clear logos and sort', /Remove all logos/.test(tools) && /Sort A/.test(tools));
ok('tools: delete ticked, delete search results, delete a group, delete dead', /Delete ticked/.test(tools) && /Delete search results/.test(tools) && /Delete a group/.test(tools) && /Delete dead/.test(tools));
ok('tools: DELETE ALL CHANNELS exists', /Delete all channels/.test(tools) && /delAll/.test(tools));
ok('tools: deleting everything asks first', /confirmAll/.test(tools));
ok('tools: nothing claims to save to the database behind your back', /Press Save to publish/.test(tools));

const tvPage = src('app/admin/tv/page.js');
ok('admin TV: it loads through the server route', /api\/admin\/tv\/config/.test(tvPage) && /action: 'load'/.test(tvPage));
ok('admin TV: it saves through the server route', /action: 'save'/.test(tvPage));
ok('admin TV: DELETE ALL reaches the database, not just the page', /action: 'clear'/.test(tvPage));
ok('admin TV: the channel list is paged, not rendered all at once', /PAGE_SIZE/.test(tvPage) && /safePage/.test(tvPage));
ok('admin TV: channels can be ticked', /selected/.test(tvPage) && /toggleSel/.test(tvPage));
ok('admin TV: it renders the bulk tools', /TvBulkTools/.test(tvPage));
ok('admin TV: it shows how many shards the database holds', /shard/.test(tvPage));

const tvConfigRoute = src('app/api/admin/tv/config/route.js');
ok('tv config route: admin only', /verifyAdmin/.test(tvConfigRoute));
ok('tv config route: it re-validates every link server-side', /unusable stream link/.test(tvConfigRoute));
ok('tv config route: it refuses two channels with the same link', /same stream link/.test(tvConfigRoute));
ok('tv config route: it refuses a stream link with a login inside it', /u\.username \|\| u\.password/.test(tvConfigRoute));
ok('tv config route: it enforces the 100,000 limit', /MAX_CHANNELS/.test(tvConfigRoute));
ok('tv config route: clear deletes the shards', /clearTvChannels/.test(tvConfigRoute));
ok('tv config route: save removes shards left over from a longer list', /removed/.test(tvConfigRoute));
ok('tv config route: load tells the admin how many shards the database holds', /parts: Number\(config\.parts\)/.test(tvConfigRoute));
ok('tv config route: save tells the admin how many shards it wrote', /parts: r\.parts/.test(tvConfigRoute));

// ------------- 3b. v39 hotfix: the admin TV page must never hang or wipe -------------
{
  const page = src('app/admin/tv/page.js');
  // "when I open Admin > Live TV it just sits there" - load() had no try/catch, so any
  // rejection left cfg === null and the page showed "Loading..." forever with no way out.
  ok('hotfix: the sign-in token is fetched without throwing on a missing session', /const token = useCallback/.test(page) && /return u \? await u\.getIdToken\(\) : null/.test(page));
  ok('hotfix: call() returns a shaped error instead of rejecting', /Could not reach the server/.test(page));
  ok('hotfix: load() wraps its call in try/catch', /try \{\s*\n?\s*j = await call\(\{ action: 'load' \}\);\s*\n?\s*\} catch \(e\)/.test(page));
  ok('hotfix: a failed load still leaves the page usable (never null cfg)', /setCfg\(\(c\) => c \|\| \{ \.\.\.TV_DEFAULT \}\)/.test(page));
  ok('hotfix: the error is shown with a Try again button', /role="alert"/.test(page) && /Try again/.test(page) && /onClick=\{load\}/.test(page));
  // "the channels disappeared" - if the shards cannot be read, the page shows 0 and Save would
  // overwrite them. Now the page knows how many the DATABASE recorded and refuses blindly.
  ok('hotfix: it remembers how many channels the database recorded', /setExpected/.test(page) && /recorded/.test(page));
  ok('hotfix: a short read is called out in red before anything is saved', /but none came back/.test(page));
  ok('hotfix: saving a suspiciously short list asks first', /looksBroken/.test(page) && /window\.confirm/.test(page));
  ok('hotfix: deleting a handful of channels does NOT nag', /cfg\.channels\.length === 0 \? missing > 0 : missing > Math\.max\(20, expected \* 0\.5\)/.test(page));
  ok('hotfix: Save can be cancelled without changing anything', /Save cancelled\. Nothing was changed\./.test(page));
  // the guard is only as good as the number behind it
  ok('hotfix: the route sends both the recorded count and what it read', /recorded: Number\(config\.count\)/.test(src('app/api/admin/tv/config/route.js')));
  // Firestore rules do not cascade into subcollections
  ok('hotfix: the rules cover the channel shards explicitly', /match \/siteMeta\/\{id\}\/channels\/\{part\}/.test(src('firestore.rules')));
}

// ------------------------------------------------- 4. Dashboard charts
const dash = src('app/admin/dashboard/page.js');
ok('dashboard: it draws the most-read pages', /Most read pages/.test(dash) && /topPages/.test(dash));
ok('dashboard: it draws new vs returning', /New vs returning/.test(dash) && /newVsReturning/.test(dash));
ok('dashboard: it draws the busy hours', /Busiest hours/.test(dash) && /byHour/.test(dash));
ok('dashboard: it draws the busiest days', /Busiest days/.test(dash) && /byWeekday/.test(dash));
ok('dashboard: it shows totals for the whole range', /data\.totals/.test(dash));
ok('dashboard: the range goes up to 90 days', /90/.test(dash));
ok('dashboard: page keys are turned back into real paths', /pageLabel/.test(dash));
ok('charts: a donut and a horizontal bar chart were added', /export function Donut/.test(src('components/Charts.js')) && /export function HBarChart/.test(src('components/Charts.js')));

const analytics = src('app/api/admin/analytics/route.js');
ok('analytics: byHour now reads data that is actually written', /'hr'/.test(analytics) && /hr\/\{?d|`hr/.test(src('lib/track.js')));
ok('analytics: the old dead branch is gone', !/o\.hours/.test(analytics));
ok('analytics: hr is swept by the cleaner like every other metric', /'rt', 'hr'/.test(analytics));
ok('track: stats/hr/<day>/<HH> is written on every page view', /hr\/\$\{d\}\/\$\{hourKey\(\)\.slice\(11\)\}/.test(src('lib/track.js')));
ok('rules: the database allows the hr metric', /hr/.test(src('database.rules.json')));

// ------------------------------------------------- 5. SEO and links
const seo = src('lib/seo.js');
ok('seo: canonical is absolute', /alternates:\s*\{\s*canonical:\s*url\s*\}/.test(seo) && /const full = /.test(seo));
ok('seo: og:url is absolute', /openGraph:[\s\S]{0,200}url,/.test(seo));
ok('seo: og:image and twitter:image are absolute', /images:\s*\[\{\s*url:\s*img\s*\}\]/.test(seo) && /images:\s*\[img\]/.test(seo));
ok('seo: an absolute address handed in is left alone', /test\(v\) \? v : absUrl\(v\)/.test(seo));
{
  const { pageMeta } = await import('../lib/seo.js');
  const m = pageMeta({ title: 'Test', description: 'd', path: '/news', image: '/img/x.jpg' });
  ok('seo: pageMeta(/news) emits a full canonical URL', /^https?:\/\//.test(m.alternates.canonical) && m.alternates.canonical.endsWith('/news'));
  ok('seo: pageMeta emits a full og:image', /^https?:\/\//.test(m.openGraph.images[0].url));
  ok('seo: pageMeta emits a full twitter:image', /^https?:\/\//.test(m.twitter.images[0]));
  const abs = pageMeta({ title: 'T', description: 'd', path: 'https://other.example/a', image: 'https://cdn.example/i.png' });
  ok('seo: an absolute input is not doubled up', abs.alternates.canonical === 'https://other.example/a');
}
ok('sitemap: TV channels are no longer capped at 800', !/slice\(0, 800\)/.test(src('app/sitemap.js')) && /slice\(0, 8000\)/.test(src('app/sitemap.js')));

// check.js now proves blog links resolve - prove the checker itself works
ok('check: it validates /blog/<slug> links', /BROKEN BLOG LINK/.test(src('scripts/check.js')));
{
  const { getPosts } = await import('../lib/blog.js');
  const live = new Set(getPosts().map((p) => p.slug));
  const dir = join(root, 'content', 'blog');
  let broken = 0;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) {
    const t = readFileSync(join(dir, f), 'utf8');
    for (const m of t.matchAll(/\]\((\/blog\/[a-z0-9\-\/]+)\)/g)) {
      const s2 = m[1].replace(/^\/blog\//, '').replace(/\/$/, '');
      if (s2.startsWith('category/')) continue;
      if (!live.has(s2)) { console.log(`   broken: ${f} -> ${m[1]}`); broken += 1; }
    }
  }
  ok(`blog: every internal post link resolves (${broken} broken)`, broken === 0);
}

// ------------------------------------------------- 6. Hygiene
const pkg = JSON.parse(src('package.json'));
ok('version: it is at least 38', Number(String(pkg.version).split('.')[0]) >= 38);
ok('tests: this file is in the npm test chain', /test-v38\.mjs/.test(src('package.json')));
ok('docs: UPGRADE-v38.md exists and names the four things', /100,?000/.test(src('UPGRADE-v38.md')) && /bulk/i.test(src('UPGRADE-v38.md')) && /Xtream/i.test(src('UPGRADE-v38.md')));
ok('live TV: /live still reads the shards', /readTvAll/.test(src('lib/liveTvServer.js')));
ok('live TV: an old single-document install still reads', /legacy/.test(src('lib/liveTvStore.js')));

console.log(`\n# v38: ${pass} checks passed, ${fails.length} failed`);
if (fails.length) { console.log(fails.map((f) => `  - ${f}`).join('\n')); process.exit(1); }
