/*
 * Mizanora v39 tests — the IPTV section: fee split, cap, plan prices, trial validation,
 * line states, pages, sitemap/robots, navigation links, blog guides and Firestore rules.
 *
 * Run: node scripts/test-v39.mjs   (also wired into `npm test`)
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

// ---------------------------------------------------------------- 1. money rules
const {
  IPTV, PLANS, MONTHS, planPrice, monthlyEquivalent, cleanPhone, cleanMac, randomMac,
  cleanTrial, lineState, planById, renewMessage,
} = await import('../lib/iptv.js');

ok('fee: Rs 50 total and it splits 20 admin + 30 reseller', IPTV.fee.total === 50 && IPTV.fee.admin === 20 && IPTV.fee.reseller === 30);
ok('fee: the split adds up to the fee', IPTV.fee.admin + IPTV.fee.reseller === IPTV.fee.total);
ok('money: wholesale is Rs 100 and the client cap is Rs 200', IPTV.wholesale === 100 && IPTV.cap === 200);
ok('money: reseller margin is cap minus wholesale (Rs 100)', IPTV.resellerMargin === 100);
ok('money: collection window is 1 to 10', IPTV.cycle.from === 1 && IPTV.cycle.to === 10);
ok('money: auto-suspend is after the window', IPTV.suspendDay > IPTV.cycle.to);

// ---------------------------------------------------------------- 2. plans
ok('plans: trial + starter + family + premium', PLANS.length === 4 && PLANS.map((p) => p.id).join(',') === 'trial,starter,family,premium');
ok('plans: only the starter plan sits at the cap', planById('starter').priced[1] === IPTV.cap);
ok('plans: nobody prices above the cap', PLANS.filter((p) => !p.trial).every((p) => p.priced[1] >= IPTV.cap));
ok('plans: longer terms are cheaper per month', MONTHS.every((m) => monthlyEquivalent('starter', m.months) <= planPrice('starter', 1)));
ok('plans: 12 months is the best monthly rate', monthlyEquivalent('starter', 12) < monthlyEquivalent('starter', 1));
ok('plans: devices grow with the plan', planById('starter').devices === 1 && planById('family').devices === 2 && planById('premium').devices === 3);

// ---------------------------------------------------------------- 3. cleaning
ok('phone: 0300-1122334 is accepted', cleanPhone('0300-1122334') === '03001122334');
ok('phone: +92 300 1122334 is accepted and normalised', cleanPhone('+92 300 1122334') === '03001122334');
ok('phone: 0092 form is accepted', cleanPhone('0092 300 1122334') === '03001122334');
ok('phone: junk is refused', cleanPhone('12345') === '' && cleanPhone('') === '');
ok('mac: a full MAC is kept', cleanMac('00:1A:79:4B:22:9F') === '00:1A:79:4B:22:9F');
ok('mac: a bare 12-digit value gets the MAG prefix', cleanMac('4B229F112233').startsWith('00:1A:79:'));
ok('mac: random MACs are valid and different', randomMac() !== randomMac() && /^00:1A:79(:[0-9A-F]{2}){3}$/.test(randomMac()));

// ---------------------------------------------------------------- 4. trial validation
const good = cleanTrial({ name: 'Ali Raza', phone: '03001122334', city: 'Kasur', device: 'mag', plan: 'family' });
ok('trial: a good request passes', good.ok && good.data.phone === '03001122334' && good.data.device === 'mag');
ok('trial: a short name is refused', cleanTrial({ name: 'A', phone: '03001122334', city: 'Kasur' }).ok === false);
ok('trial: a bad phone is refused', cleanTrial({ name: 'Ali Raza', phone: '123', city: 'Kasur' }).ok === false);
ok('trial: missing city is refused', cleanTrial({ name: 'Ali Raza', phone: '03001122334', city: '' }).ok === false);
ok('trial: unknown device falls back to xtream', cleanTrial({ name: 'Ali Raza', phone: '03001122334', city: 'Kasur', device: 'xbox' }).data.device === 'xtream');
ok('trial: html is stripped from the name', !cleanTrial({ name: '<b>Ali</b> Raza', phone: '03001122334', city: 'Kasur' }).data.name.includes('<'));

// ---------------------------------------------------------------- 5. line states
const day = 86400e3;
ok('line: no expiry reads as none', lineState(0).state === 'none');
ok('line: 20 days is active', lineState(Date.now() + 20 * day).state === 'active');
ok('line: 2 days is expiring', lineState(Date.now() + 2 * day).state === 'expiring');
ok('line: yesterday is expired', lineState(Date.now() - day).state === 'expired');
ok('line: renew message carries the username', renewMessage({ username: 'mz1', plan: 'starter' }).includes('mz1'));

// ---------------------------------------------------------------- 6. pages exist
for (const p of [
  'app/iptv/page.js', 'app/iptv/channels/page.js', 'app/iptv/trial/page.js', 'app/iptv/reseller/page.js',
  'app/account/iptv/page.js', 'app/admin/iptv/page.js',
  'app/api/iptv/trial/route.js', 'app/api/admin/iptv/route.js',
  'components/IptvPlans.js', 'components/IptvTrialForm.js', 'components/IptvResellerCalc.js',
  'components/AccountIptv.js', 'components/AdminIptv.js',
]) ok(`page: ${p} exists`, existsSync(join(root, p)));

// ---------------------------------------------------------------- 7. SEO + links
ok('seo: sitemap lists the IPTV pages', has('app/sitemap.js', /'\/iptv'/) && has('app/sitemap.js', /'\/iptv\/channels'/));
ok('seo: robots keeps /account/iptv private', has('app/robots.js', /\/account\/iptv/));
ok('seo: landing page has Product structured data', has('app/iptv/page.js', /'@type': 'Product'/));
ok('seo: landing page has FAQ structured data', has('app/iptv/page.js', /faqJsonLd/));
ok('nav: header links to /iptv', has('components/Header.js', /href="\/iptv"/));
ok('nav: footer links to /iptv', has('components/Footer.js', /'\/iptv', 'Mizanora IPTV'/));
ok('nav: admin sidebar has the IPTV page', has('components/AdminNav.js', /\/admin\/iptv/));

// ---------------------------------------------------------------- 8. blog
for (const slug of [
  'mizanora-iptv-guide-roman-urdu', 'iptv-xtream-codes-setup-tivimate-smarters',
  'stalker-portal-mac-setup-mag-box', 'iptv-reseller-pakistan-guide',
  'iptv-channels-legal-pakistan',
]) {
  const p = `content/blog/${slug}.md`;
  ok(`blog: ${slug} exists with front matter`, existsSync(join(root, p)) && /^---[\s\S]*title:[\s\S]*---/.test(read(p)));
}

// ---------------------------------------------------------------- 9. rules + api safety
ok('rules: iptvLines readable by owner, writable by admin', has('firestore.rules', /match \/iptvLines\/\{id\} \{[\s\S]{0,220}resource\.data\.uid == request\.auth\.uid/));
ok('rules: trial requests are server-only', has('firestore.rules', /match \/iptvTrials\/\{id\} \{ allow read, write: if false; \}/));
ok('api: admin IPTV route is behind verifyAdmin', has('app/api/admin/iptv/route.js', /verifyAdmin/));
ok('api: trial route validates and rate-limits', has('app/api/iptv/trial/route.js', /cleanTrial/) && has('app/api/iptv/trial/route.js', /ipLimited/));
ok('api: trial route never trusts the browser plan', has('app/api/iptv/trial/route.js', /cleanTrial\(body\)/));

// ---------------------------------------------------------------- 10. honesty
ok('admin: panel says when it is showing demo rows', has('components/AdminIptv.js', /demo/));
ok('upgrade notes explain what is still missing', /NAHI|gateway/i.test(read('UPGRADE-v39.md')));

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
