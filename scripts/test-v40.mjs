/*
 * Mizanora v40 tests — the reseller panel: price cap, credit, month maths, credentials,
 * stats, cycle, API safety, routes, rules, navigation and the new blog guides.
 *
 * Run: node scripts/test-v40.mjs   (also wired into `npm test`)
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

const {
  MIN_CLIENT_PRICE, MAX_CLIENT_PRICE, clientPrice, marginOf, clientTotal, nextClientPrice,
  addMonths, clientExpiry, credentials, cleanApply, cleanClient, canAddLine, resellerStats,
  cycleState, collectionPct, clientMessage,
} = await import('../lib/iptvReseller.js');
const { IPTV } = await import('../lib/iptv.js');

// ---------------------------------------------------------------- 1. price + margin
ok('price: floor is wholesale (Rs 100) and cap is Rs 200', MIN_CLIENT_PRICE === 100 && MAX_CLIENT_PRICE === 200);
ok('price: 150 stays 150', clientPrice(150) === 150);
ok('price: 250 is capped to 200', clientPrice(250) === 200);
ok('price: 50 is lifted to the floor 100', clientPrice(50) === 100);
ok('price: empty falls back to the cap', clientPrice('') === 200 && clientPrice(undefined) === 200);
ok('price: margin at cap is Rs 100', marginOf(200) === 100);
ok('price: margin at 150 is Rs 50', marginOf(150) === 50);
ok('price: 3 months at 200 = Rs 600', clientTotal(200, 3) === 600);
ok('price: a capped request is reported as capped', nextClientPrice(200, 260).capped === true && nextClientPrice(200, 260).price === 200);

// ---------------------------------------------------------------- 2. months
const jan31 = Date.UTC(2026, 0, 31);
const feb = new Date(addMonths(jan31, 1));
ok('months: 31 Jan + 1 month lands in February', feb.getUTCMonth() === 1);
ok('months: 31 Jan + 1 month is 28 Feb (not 3 March)', feb.getUTCDate() === 28);
const y = new Date(addMonths(Date.UTC(2026, 10, 2), 12));
ok('months: +12 months keeps the same day', y.getUTCFullYear() === 2027 && y.getUTCMonth() === 10);
ok('months: clientExpiry is in the future', clientExpiry(1) > Date.now());

// ---------------------------------------------------------------- 3. credentials
const cred = credentials();
ok('credentials: username is mz + 6 digits', /^mz\d{6}$/.test(cred.username));
ok('credentials: password is 8 characters', cred.password.length === 8);
ok('credentials: no confusing 0/O/1/l/I in the password', !/[0O1lI]/.test(cred.password));
const fixed = credentials(() => 0.5);
ok('credentials: deterministic with an injected random source', fixed.username === 'mz550000' && fixed.password.length === 8);

// ---------------------------------------------------------------- 4. application validation
ok('apply: short name is refused', cleanApply({ name: 'Al', phone: '03001234567', city: 'Kasur' }).ok === false);
ok('apply: bad phone is refused', cleanApply({ name: 'Ali Raza', phone: '12345', city: 'Kasur' }).ok === false);
ok('apply: good input passes and normalises the number', cleanApply({ name: 'Ali Raza', phone: '+92 300 1234567', city: 'Kasur' }).data.phone === '03001234567');
ok('apply: a 12-digit CNIC is refused', cleanApply({ name: 'Ali Raza', phone: '03001234567', city: 'Kasur', cnic: '352011234567' }).ok === false);
ok('apply: a 13-digit CNIC passes', cleanApply({ name: 'Ali Raza', phone: '03001234567', city: 'Kasur', cnic: '35201-1234567-1' }).ok === true);

// ---------------------------------------------------------------- 5. client validation
const client = (over = {}) => cleanClient({ name: 'Sana Malik', phone: '03219988776', plan: 'family', months: 3, price: 350, ...over });
ok('client: a good client passes', client().ok === true);
ok('client: plan price is capped at 200', client().data.price === 200);
ok('client: 3 months total uses the capped price', client().data.total === 600);
ok('client: the trial plan cannot be sold by a reseller', cleanClient({ name: 'Sana Malik', phone: '03219988776', plan: 'trial' }).ok === false);
ok('client: a bad phone is refused', client({ phone: '0345' }).ok === false);
ok('client: months 6 falls back to 1', client({ months: 6 }).data.months === 1);
ok('client: months 12 is kept', client({ months: 12 }).data.months === 12);
ok('client: a broken email is refused', client({ email: 'not-an-email' }).ok === false);
ok('client: an empty email is fine', client({ email: '' }).ok === true);
ok('client: Family plan gives 2 devices', client().data.devices === 2);

// ---------------------------------------------------------------- 6. credit
ok('credit: 10 allowed, 10 used = refused', canAddLine({ credit: 10 }, 10).ok === false);
ok('credit: 10 allowed, 3 used = 7 left', canAddLine({ credit: 10 }, 3).remaining === 7);
ok('credit: zero credit is refused', canAddLine({ credit: 0 }, 0).ok === false);
ok('credit: the message mentions the admin', /admin/i.test(canAddLine({ credit: 2 }, 2).error));

// ---------------------------------------------------------------- 7. stats
const now = Date.now();
const stats = resellerStats([
  { price: 200, expiresAt: now + 20 * 86400e3, status: 'active' },
  { price: 150, expiresAt: now + 2 * 86400e3, status: 'active' },
  { price: 200, expiresAt: now - 86400e3, status: 'active' },
  { price: 200, expiresAt: now + 40 * 86400e3, status: 'suspended' },
], now);
ok('stats: 4 clients counted', stats.clients === 4);
ok('stats: 2 lines are live', stats.active === 2);
ok('stats: 1 line is expiring soon', stats.expiring === 1);
ok('stats: 1 line is expired', stats.expired === 1);
ok('stats: suspended lines are not live', stats.suspended === 1);
ok('stats: MRR is the sum of live client prices', stats.mrr === 350);
ok('stats: wholesale due is Rs 100 per live line', stats.due === 200);
ok('stats: margin is MRR minus wholesale', stats.margin === 150);

// ---------------------------------------------------------------- 8. cycle
ok('cycle: day 5 is the payment window', cycleState(Date.UTC(2026, 10, 5)).stage === 'window');
ok('cycle: day 1 is inside the window', cycleState(Date.UTC(2026, 10, 1)).inWindow === true);
ok('cycle: day 11 is late', cycleState(Date.UTC(2026, 10, 11)).stage === 'late');
ok('cycle: day 12 is the suspend day', cycleState(Date.UTC(2026, 10, 12)).stage === 'suspend');
ok('cycle: the month key is YYYY-MM', cycleState(Date.UTC(2026, 10, 5)).month === '2026-11');
ok('cycle: collection % is 50 for half paid', collectionPct(1000, 500) === 50);
ok('cycle: collection % never goes over 100', collectionPct(1000, 5000) === 100);
ok('cycle: collection % is 0 when nothing is due', collectionPct(0, 500) === 0);

// ---------------------------------------------------------------- 9. client message
const msg = clientMessage({
  name: 'Ali', username: 'mz123456', password: 'abcd2345', server: 'http://dns.mizanora.tv:8080',
  plan: 'starter', months: 1, expiresAt: now + 30 * 86400e3, price: 200, resellerName: 'Ali Traders',
});
ok('message: carries the username and password', msg.includes('mz123456') && msg.includes('abcd2345'));
ok('message: carries the server', msg.includes('dns.mizanora.tv'));
ok('message: names the reseller for recharge', msg.includes('Ali Traders'));
ok('message: never mentions an upstream/source link', !/m3u|\.ts\b|xtream.*source/i.test(msg));

// ---------------------------------------------------------------- 10. API safety
ok('api: reseller route is behind verifyReseller', has('app/api/reseller/route.js', /verifyReseller/));
ok('api: every line action checks the owner', has('app/api/reseller/route.js', /line\.resellerId !== s\.uid/));
ok('api: credit is enforced on create', has('app/api/reseller/route.js', /canAddLine/));
ok('api: create writes a price lock on the line', has('app/api/reseller/route.js', /locked: true/));
ok('api: apply route validates and has a WhatsApp fallback', has('app/api/reseller/apply/route.js', /cleanApply/) && has('app/api/reseller/apply/route.js', /fallback/));
ok('api: apply route rate-limits per IP', has('app/api/reseller/apply/route.js', /iptvResellerApps.*ip|ip.*iptvResellerApps/s));
ok('api: admin route approves resellers', has('app/api/admin/iptv/route.js', /approveReseller/));
ok('api: admin route can add credit', has('app/api/admin/iptv/route.js', /addCredit/));
ok('api: admin route can record a payment', has('app/api/admin/iptv/route.js', /markPaid/));
ok('api: admin route can create a line directly', has('app/api/admin/iptv/route.js', /createLine/));
ok('api: reseller auth reads the reseller document by uid', has('lib/resellerAuth.js', /iptvResellers.*doc\(u\.uid\)/s));
ok('api: approval status is checked', has('lib/resellerAuth.js', /status !== 'approved'/));

// ---------------------------------------------------------------- 11. pages + nav
ok('page: /reseller exists', existsSync(join(root, 'app/reseller/page.js')));
ok('page: /reseller is noindex (private panel)', has('app/reseller/page.js', /noindex: true/));
ok('page: /reseller renders the panel', has('app/reseller/page.js', /ResellerPanel/));
ok('component: the panel has the new-client form', has('components/ResellerPanel.js', /Naya client/));
ok('component: the panel shows the margin', has('components/ResellerPanel.js', /marginOf/));
ok('component: the panel can renew a client', has('components/ResellerPanel.js', /action: 'renew'|'renew'/));
ok('component: the apply form exists', existsSync(join(root, 'components/ResellerApply.js')));
ok('page: /iptv/reseller includes the apply form', has('app/iptv/reseller/page.js', /ResellerApply/));
ok('page: /iptv/reseller links to the panel', has('app/iptv/reseller/page.js', /href="\/reseller"/));
ok('nav: footer links to the reseller panel', has('components/Footer.js', /'\/reseller', 'Reseller panel'/));
ok('seo: robots keeps the private panel out', has('app/robots.js', /'\/reseller'/));
ok('seo: sitemap does not publish the private panel', !/['"`]\/reseller['"`]/.test(read('app/sitemap.js')));

// ---------------------------------------------------------------- 12. rules
ok('rules: a reseller can read their own lines', has('firestore.rules', /resource\.data\.resellerId == request\.auth\.uid/));
ok('rules: reseller applications are server-only', has('firestore.rules', /match \/iptvResellerApps\/\{id\} \{ allow read, write: if false; \}/));
ok('rules: lines are never writable from a browser', has('firestore.rules', /match \/iptvLines\/\{id\} \{[\s\S]{0,400}allow write: if isAdmin\(\);/));

// ---------------------------------------------------------------- 13. blog
for (const slug of [
  'tivimate-playlist-setup-guide', 'smart-tv-iptv-setup-samsung-lg',
  'iptv-buffering-fix-pakistan', 'iptv-reseller-panel-guide',
]) {
  const p = `content/blog/${slug}.md`;
  ok(`blog: ${slug} exists with front matter`, existsSync(join(root, p)) && /^---[\s\S]*title:[\s\S]*---/.test(read(p)));
}
ok('blog: the panel guide links to /reseller', has('content/blog/iptv-reseller-panel-guide.md', /\(\/reseller\)/));

// ---------------------------------------------------------------- 14. honesty
ok('docs: v40 upgrade notes exist', existsSync(join(root, 'UPGRADE-v40.md')));
ok('docs: the plan document exists', existsSync(join(root, 'docs/IPTV-PLAN.md')));

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
