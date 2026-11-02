/*
 * Mizanora v47 tests — blacklist/whitelist, brute-force lockout, admin audit log,
 * bulk line editing, billing engine (cycle + cron auto-suspend), aur admin auth ka fix.
 *
 * Run: node scripts/test-v47.mjs   (also wired into `npm test`)
 */
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), 'utf8') : '');
const has = (p, needle) => read(p).includes(needle);

let pass = 0;
const fails = [];
const ok = (name, cond) => { if (cond) { pass++; console.log(`ok - ${name}`); } else { fails.push(name); console.log(`FAIL - ${name}`); } };

const A = await import('../lib/iptvAccess.js');
const B = await import('../lib/iptvBilling.js');
const { IPTV } = await import('../lib/iptv.js');

// ---------------------------------------------------------------- 1. access rules (pure)
ok('ip: exact normalised', A.normalizeIp(' 1.2.3.4 ') === '1.2.3.4');
ok('ip: cidr kept', A.normalizeIp('10.0.0.0/24') === '10.0.0.0/24');
ok('ip: wildcard kept', A.normalizeIp('10.0.*') === '10.0.*');
ok('ip: bad rejected', A.normalizeIp('1.2.3.999') === '' && A.normalizeIp('hello') === '' && A.normalizeIp('') === '');
ok('ip: ipv6 accepted', A.normalizeIp('2001:DB8::1') === '2001:db8::1');
ok('ip: cidr /0 allowed', A.normalizeIp('0.0.0.0/0') === '0.0.0.0/0' && A.ipMatches('0.0.0.0/0', '9.9.9.9') === true);
ok('ip: cidr match', A.ipMatches('192.168.1.0/24', '192.168.1.55') && !A.ipMatches('192.168.1.0/24', '192.168.2.1'));
ok('ip: cidr /32 is exact', A.ipMatches('1.1.1.1/32', '1.1.1.1') && !A.ipMatches('1.1.1.1/32', '1.1.1.2'));
ok('ip: wildcard match', A.ipMatches('39.50.*', '39.50.1.9') && !A.ipMatches('39.50.*', '39.51.1.9'));
ok('ip: exact mismatch', !A.ipMatches('1.2.3.4', '1.2.3.5'));
ok('ip: empty never matches', !A.ipMatches('', '1.2.3.4') && !A.ipMatches('1.2.3.4', ''));

ok('user: lowercased + stripped', A.normalizeUser('  MZ12-AB ') === 'mz12-ab');
ok('mac: normalised', A.normalizeMac('001a79aabbcc') === '00:1A:79:AA:BB:CC');
ok('mac: bad rejected', A.normalizeMac('12345') === '' && A.normalizeMac('zz:zz:zz:zz:zz:zz') === '');

const doc = A.cleanAccess({
  mode: 'nonsense',
  block: { ip: ['1.2.3.4', '1.2.3.4', 'bad'], user: ['MZ1'], mac: ['001a79aabbcc'] },
  allow: { ip: ['10.0.0.0/8'], user: [], mac: [] },
  note: 'x'.repeat(400),
});
ok('clean: invalid mode falls back', doc.mode === 'blocklist');
ok('clean: duplicates removed', doc.block.ip.length === 1);
ok('clean: bad entries dropped', doc.block.ip[0] === '1.2.3.4');
ok('clean: user + mac kept', doc.block.user[0] === 'mz1' && doc.block.mac[0] === '00:1A:79:AA:BB:CC');
ok('clean: note capped', doc.note.length === A.ACCESS_NOTE_MAX);
ok('clean: never throws on garbage', (() => { try { A.cleanAccess(null); A.cleanAccess('x'); return true; } catch { return false; } })());

ok('verdict: open by default', A.accessVerdict(A.EMPTY_ACCESS, { ip: '1.2.3.4', user: 'mz1' }).blocked === false);
ok('verdict: blocked ip', A.accessVerdict({ block: { ip: ['1.2.3.4'] } }, { ip: '1.2.3.4' }).blocked === true);
ok('verdict: blocked user', A.accessVerdict({ block: { user: ['MZ1'] } }, { user: 'mz1' }).blocked === true);
ok('verdict: blocked mac', A.accessVerdict({ block: { mac: ['00:1A:79:AA:BB:CC'] } }, { mac: '001a79aabbcc' }).blocked === true);
ok('verdict: cidr block', A.accessVerdict({ block: { ip: ['10.0.0.0/8'] } }, { ip: '10.9.8.7' }).blocked === true);
ok('verdict: allowlist blocks stranger', A.accessVerdict({ mode: 'allowlist', allow: { user: ['mz1'] } }, { user: 'mz2' }).blocked === true);
ok('verdict: allowlist lets listed user', A.accessVerdict({ mode: 'allowlist', allow: { user: ['mz1'] } }, { user: 'mz1' }).blocked === false);
ok('verdict: allowlist lets listed ip', A.accessVerdict({ mode: 'allowlist', allow: { ip: ['39.50.*'] } }, { ip: '39.50.7.7' }).blocked === false);
ok('verdict: empty allowlist stays open', A.accessVerdict({ mode: 'allowlist' }, { ip: '8.8.8.8' }).blocked === false);
ok('verdict: block beats allow', A.accessVerdict({ mode: 'allowlist', block: { ip: ['1.1.1.1'] }, allow: { ip: ['1.1.1.0/24'] } }, { ip: '1.1.1.1' }).blocked === true);
ok('verdict: reason mentions entry', String(A.accessVerdict({ block: { ip: ['1.1.1.1'] } }, { ip: '1.1.1.1' }).reason).includes('1.1.1.1'));

const counts = A.accessCounts({ mode: 'allowlist', block: { ip: ['1.1.1.1'] }, allow: { user: ['a', 'b'] } });
ok('counts: totals', counts.block === 1 && counts.allow === 2);
ok('counts: open warning for empty allowlist', A.accessCounts({ mode: 'allowlist' }).open === true);
ok('counts: no warning in blocklist', A.accessCounts({ mode: 'blocklist' }).open === false);

let r = A.EMPTY_ACCESS;
let step = A.applyAccessChange(r, { action: 'add', list: 'block', kind: 'ip', value: '1.2.3.4' });
ok('change: add works', step.ok && step.rules.block.ip.includes('1.2.3.4'));
step = A.applyAccessChange(step.rules, { action: 'add', list: 'allow', kind: 'ip', value: '1.2.3.4' });
ok('change: allow overrides block entry', step.ok && step.rules.allow.ip.includes('1.2.3.4') && !step.rules.block.ip.includes('1.2.3.4'));
step = A.applyAccessChange(step.rules, { action: 'remove', list: 'allow', kind: 'ip', value: '1.2.3.4' });
ok('change: remove works', step.ok && step.rules.allow.ip.length === 0);
ok('change: duplicate add is a no-op', (() => { const one = A.applyAccessChange(A.EMPTY_ACCESS, { action: 'add', list: 'block', kind: 'user', value: 'mz1' }); const two = A.applyAccessChange(one.rules, { action: 'add', list: 'block', kind: 'user', value: 'MZ1' }); return two.ok && two.rules.block.user.length === 1; })());
ok('change: bad value rejected', A.applyAccessChange(A.EMPTY_ACCESS, { action: 'add', kind: 'ip', value: 'nope' }).ok === false);
ok('change: bad kind rejected', A.applyAccessChange(A.EMPTY_ACCESS, { action: 'add', kind: 'email', value: 'x' }).ok === false);
ok('change: mode switch', A.applyAccessChange(A.EMPTY_ACCESS, { action: 'mode', mode: 'allowlist' }).rules.mode === 'allowlist');
ok('change: clear empties a list', (() => { const one = A.applyAccessChange(A.EMPTY_ACCESS, { action: 'add', list: 'block', kind: 'ip', value: '9.9.9.9' }); return A.applyAccessChange(one.rules, { action: 'clear', list: 'block' }).rules.block.ip.length === 0; })());
ok('summary text readable', A.accessSummaryText({ block: { ip: ['1.1.1.1'] } }).includes('1'));

// ---------------------------------------------------------------- 2. billing rules (pure)
const T = Date.parse('2026-11-14T10:00:00Z');
ok('billing: pkParts uses UTC+5', B.pkParts(Date.parse('2026-11-30T20:00:00Z')).d === 1);
ok('billing: month key', B.monthKey(T) === '2026-11');
const period = B.periodOf(T);
ok('billing: period is one month', period.key === '2026-11' && period.to > period.from);
ok('billing: due date is 10th', new Date(B.dueAtFor(T)).toISOString().startsWith('2026-11-10'));
ok('billing: cycle matches IPTV', B.BILLING.cycle.from === IPTV.cycle.from && B.BILLING.cycle.to === IPTV.cycle.to);
ok('billing: suspend day matches IPTV', B.BILLING.suspendDay === IPTV.suspendDay);
ok('billing: wholesale matches IPTV', IPTV.wholesale === 100 && IPTV.cap === 200);

const inv = B.invoiceFor({ id: 'l1', username: 'mz1', price: 200, clientName: 'Ali' }, T, { months: 3 });
ok('invoice: id has username + month', inv.id === 'mz1-2026-11');
ok('invoice: amount x months', inv.amount === 600);
ok('invoice: wholesale x months', inv.wholesale === 300);
ok('invoice: currency PKR', inv.currency === 'PKR');
ok('invoice: free line marked free', B.invoiceFor({ username: 'mz2', price: 0 }, T).status === 'free');

ok('state: no expiry = none', B.billingState({}, T).state === 'none');
ok('state: healthy line = ok', B.billingState({ expiresAt: T + 20 * 86400e3 }, T).state === 'ok');
ok('state: 3 din baaqi = due', B.billingState({ expiresAt: T + 2 * 86400e3 }, T).state === 'due');
ok('state: expired 1 din = overdue', B.billingState({ expiresAt: T - 86400e3 }, T).state === 'overdue');
ok('state: expired 4 din = suspend', B.billingState({ expiresAt: T - 4 * 86400e3 }, T).state === 'suspend');
ok('state: suspended line = off', B.billingState({ status: 'suspended', expiresAt: T - 9 * 86400e3 }, T).state === 'off');
ok('state: daysLate counted', B.billingState({ expiresAt: T - 5 * 86400e3 }, T).daysLate === 5);

const rem = B.reminderText({ clientName: 'Ali', price: 200, expiresAt: T + 2 * 86400e3 }, T);
ok('reminder: names the client', rem.includes('Ali'));
ok('reminder: names the amount', rem.includes('200'));
ok('reminder: names jazzcash', rem.includes('0306'));
ok('reminder: expiry reminder wording', rem.toLowerCase().includes('khatam'));
const rem2 = B.reminderText({ clientName: 'Ali', price: 200, expiresAt: T - 5 * 86400e3 }, T);
ok('reminder: overdue wording', rem2.toLowerCase().includes('recharge'));

const summary = B.billingSummary([
  { id: 'a', price: 200, expiresAt: T + 30 * 86400e3 },
  { id: 'b', price: 200, expiresAt: T + 2 * 86400e3 },
  { id: 'c', price: 150, expiresAt: T - 5 * 86400e3 },
  { id: 'd', status: 'suspended', expiresAt: T - 5 * 86400e3 },
], T);
ok('summary: counts ok/due/suspend/off', summary.ok === 1 && summary.due === 1 && summary.suspend === 1 && summary.off === 1);
ok('summary: amount at risk', summary.amountAtRisk === 350);
ok('summary: sorted worst first', summary.lines[0].id === 'c');
ok('summary: only suspend lines to act on', B.linesToSuspend([{ id: 'x', expiresAt: T - 9 * 86400e3 }, { id: 'y', expiresAt: T + 86400e3 }], T).length === 1);

// ---------------------------------------------------------------- 3. gateway wiring
const lines = read('lib/gateway/lines.js');
ok('gateway: access rules checked on login', lines.includes('accessDenied'));
ok('gateway: per-username lockout', lines.includes('MAX_FAILS') && lines.includes('lockedUntil'));
ok('gateway: failures recorded', lines.includes('registerFailure'));
ok('gateway: lockout cleared on success', lines.includes('clearFailures'));
ok('gateway: device path checks ip+mac', lines.includes('mac: line && line.mac'));
ok('playlist: ip guard', has('app/api/gw/playlist/route.js', 'accessDenied'));
ok('epg: ip guard', has('app/api/gw/epg/route.js', 'accessDenied'));
ok('access lib primes cache', has('lib/gateway/access.js', 'primeAccessRules'));
ok('access lib caches (stream par bojh nahi)', has('lib/gateway/access.js', 'TTL'));

// ---------------------------------------------------------------- 4. admin: access, billing, bulk, audit
const api = read('app/api/admin/iptv/access/route.js');
ok('api: access GET + POST', api.includes('export async function GET') && api.includes('export async function POST'));
ok('api: admin only', api.includes('verifyAdmin'));
['add', 'remove', 'mode', 'clear', 'note', 'test', 'replace'].forEach((act) => {
  ok(`api: access action ${act}`, api.includes(`'${act}'`));
});
ok('api: audit on change', api.includes('logAdmin'));
ok('ui: access component exists', read('components/IptvAccessAdmin.js').length > 1500);
ok('ui: access tab wired', has('components/AdminIptv.js', "tab === 'access'") && has('components/IptvAccessAdmin.js', 'Blocklist'));
ok('ui: tester included', has('components/IptvAccessAdmin.js', "'test'"));
ok('ui: audit list included', has('components/IptvAccessAdmin.js', 'Aakhri admin actions'));

const billingApi = read('app/api/admin/iptv/billing/route.js');
ok('api: billing GET + POST', billingApi.includes('export async function GET') && billingApi.includes('export async function POST'));
ok('api: billing markPaid', billingApi.includes("action === 'markPaid'"));
ok('api: billing suspend', billingApi.includes("action === 'suspend'"));
ok('api: billing payment log', billingApi.includes('iptvPayments'));
ok('ui: billing tab wired', has('components/AdminIptv.js', "tab === 'billing'") && read('components/IptvBillingAdmin.js').length > 1200);
ok('ui: billing warning when cron missing', has('components/IptvBillingAdmin.js', 'CRON_SECRET'));

ok('api: bulk lines action', has('app/api/admin/iptv/lines/route.js', "action === 'bulk'"));
['suspend', 'resume', 'delete', 'extend', 'plan'].forEach((m) => {
  ok(`bulk: mode ${m}`, has('app/api/admin/iptv/lines/route.js', `'${m}'`));
});
ok('ui: bulk toolbar', has('components/IptvLinesAdmin.js', 'bulk-extend'));
ok('ui: bulk selection', has('components/IptvLinesAdmin.js', 'toggleSel'));
ok('audit: helper exists', has('lib/gateway/audit.js', 'export async function logAdmin'));
ok('audit: recent list', has('lib/gateway/audit.js', 'recentAudit'));
ok('audit: line edit logged', has('app/api/admin/iptv/lines/route.js', "'line_edit'"));
ok('audit: renew logged', has('app/api/admin/iptv/lines/route.js', "'line_renew'"));

// ---------------------------------------------------------------- 5. cron + security
const cron = read('app/api/cron/iptv/route.js');
ok('cron: route exists', cron.length > 900);
ok('cron: secret required', cron.includes('CRON_SECRET'));
ok('cron: dry run supported', cron.includes('dry'));
ok('cron: auto suspend', cron.includes("status: 'suspended'"));
ok('cron: reminders built', cron.includes('reminderText'));
ok('cron: logged', cron.includes('logAdmin'));
ok('vercel.json: daily cron', has('vercel.json', '/api/cron/iptv') && has('vercel.json', '"crons"'));
ok('rules: access doc private', has('firestore.rules', "id != 'iptvAccess'"));
ok('rules: lockouts private', has('firestore.rules', 'iptvLockouts'));
ok('rules: payments private', has('firestore.rules', 'iptvPayments'));
const auth = read('lib/adminAuth.js');
ok('auth: probe is an admin-only collection', auth.includes("ADMIN_PROBE = 'productCosts'"));
ok('auth: orders probe removed', !auth.includes('/documents/orders'));
ok('auth: admin sdk path first', auth.indexOf('verifyIdToken') < auth.indexOf('documents/${ADMIN_PROBE}'));
ok('auth: explains itself', auth.includes('v47'));

// ---------------------------------------------------------------- 6. version + docs
const pkg = JSON.parse(read('package.json'));
ok('version is 47.0.0', pkg.version === '47.0.0');
ok('test chain includes v47', String(pkg.scripts.test).includes('test-v47.mjs'));
ok('upgrade notes v47', read('UPGRADE-v47.md').length > 800);
ok('plan doc mentions v47', has('docs/IPTV-PLAN.md', 'v47'));

console.log(`\nv47: ${pass} passed, ${fails.length} failed`);
if (fails.length) { console.log('\nFAILED:'); for (const f of fails) console.log(' - ' + f); process.exit(1); }
