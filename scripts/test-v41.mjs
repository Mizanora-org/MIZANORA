/*
 * Mizanora v41 tests — self-service IPTV:
 *   Google sign in -> free Xtream key (one trial per account)
 *   reseller application -> AUTO approved (signed in only)
 *   IPTV ka apna channel catalogue, free Live TV se alag
 *
 * Run: node scripts/test-v41.mjs   (also wired into `npm test`)
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

const { canClaim, trialLine, publicLine, TRIAL_HOURS, SETUP_STEPS, DEVICE_HELP } = await import('../lib/iptvAccount.js');
const { cleanCatalogue, catalogueGroups, catalogueStats, fromM3U, MAX_IPTV_CHANNELS } = await import('../lib/iptvCatalogue.js');
const { IPTV } = await import('../lib/iptv.js');

const now = Date.UTC(2026, 10, 2, 12, 0, 0);

// ---------------------------------------------------------------- 1. trial eligibility
ok('trial: a brand new account can claim', canClaim([]).ok === true);
ok('trial: trial is one per account', canClaim([{ trial: true, expiresAt: now - 1 }], now).code === 'trial_used');
ok('trial: a live paid line blocks a new trial', canClaim([{ trial: false, expiresAt: now + 5 * 86400e3, status: 'active' }], now).code === 'has_line');
ok('trial: an expired paid line does NOT block', canClaim([{ trial: false, expiresAt: now - 86400e3, status: 'active' }], now).ok === true);
ok('trial: 3+ lines on the account is blocked', canClaim([{ expiresAt: now - 1 }, { expiresAt: now - 1 }, { expiresAt: now - 1 }], now).code === 'too_many');
ok('trial: the refusal message is in Roman Urdu', /trial|WhatsApp/i.test(canClaim([{ trial: true }]).error));

// ---------------------------------------------------------------- 2. the line that gets created
const line = trialLine({ uid: 'u1', email: 'Ali@Example.com', name: 'Ali Raza', phone: '0300 1234567' }, now, () => 0.42);
ok('line: 24 hour trial', line.expiresAt - now === TRIAL_HOURS * 3600e3 && TRIAL_HOURS === 24);
ok('line: plan is trial, one device', line.plan === 'trial' && line.maxDevices === 1 && line.trial === true);
ok('line: belongs to the signed-in uid', line.uid === 'u1');
ok('line: email is lower-cased', line.email === 'ali@example.com');
ok('line: phone is normalised', line.phone === '03001234567');
ok('line: username looks like a Mizanora key', /^mz\d{6}$/.test(line.username));
ok('line: password is 8 characters', line.password.length === 8);
ok('line: name is cleaned (no angle brackets)', !/[<>]/.test(trialLine({ uid: 'u', name: '<b>Ali</b>' }, now).name));
ok('line: no name falls back to the email prefix', trialLine({ uid: 'u', email: 'sana@x.com' }, now).name === 'sana');
ok('line: server is set', /^https?:\/\//.test(line.server));
ok('line: status active, price 0', line.status === 'active' && line.price === 0);

// ---------------------------------------------------------------- 3. what the browser sees
const pub = publicLine({ id: 'L1', username: 'mz123456', password: 'abcdefgh', server: 'http://s:8080', plan: 'trial', expiresAt: now, trial: true });
ok('public: includes the credentials (it is the owner)', pub.username === 'mz123456' && pub.password === 'abcdefgh');
ok('public: no internal fields leak (resellerId/uid/price)', !('resellerId' in pub) && !('uid' in pub) && !('price' in pub));
ok('public: setup steps exist', SETUP_STEPS.length === 3 && DEVICE_HELP.length === 3);

// ---------------------------------------------------------------- 4. catalogue
const raw = [
  { name: 'Geo News', url: 'http://a/1.m3u8', group: 'News' },
  { name: 'Geo News copy', url: 'http://a/1.m3u8', group: 'News' },
  { name: 'PTV Sports', url: 'http://a/2.m3u8', group: 'Sports' },
  { name: 'Broken', url: 'javascript:alert(1)', group: 'News' },
  { name: 'No url', group: 'News' },
];
const cat = cleanCatalogue({ channels: raw, enabled: true, title: 'IPTV' });
ok('catalogue: duplicates by url are removed', cat.channels.length === 2);
ok('catalogue: unusable urls are dropped', !cat.channels.some((c) => /javascript/i.test(c.url)));
ok('catalogue: enabled flag is kept', cat.enabled === true);
ok('catalogue: groups are counted', catalogueGroups(cat.channels).length === 2);
ok('catalogue: stats count the live channels', catalogueStats(cat).live === 2);
ok('catalogue: an empty group becomes "Other"', cleanCatalogue({ channels: [{ name: 'X', url: 'http://a/x.m3u8' }] }).channels[0].group === 'Other');
ok('catalogue: size is capped', MAX_IPTV_CHANNELS === 5000);

const m3u = '#EXTM3U\n#EXTINF:-1 tvg-logo="http://l/1.png" group-title="News",Geo News\nhttp://a/1.m3u8\n#EXTINF:-1 group-title="Kids",Cartoon\nhttp://a/2.m3u8\n';
const parsed = fromM3U(m3u);
ok('m3u: both channels are read', parsed.channels.length === 2);
ok('m3u: group is kept', parsed.channels[0].group === 'News');
ok('m3u: logo is kept', parsed.channels[0].logo === 'http://l/1.png');
ok('m3u: a non-http line is skipped', fromM3U('#EXTM3U\n#EXTINF:-1,X\nnot-a-url').channels.length === 0);

// ---------------------------------------------------------------- 5. APIs
ok('api: account route requires a signed-in user', has('app/api/iptv/account/route.js', /verifyUser/));
ok('api: account route only reads the caller\'s lines', has("app/api/iptv/account/route.js", /where\('uid', '==', u\.uid\)/));
ok('api: claim goes through canClaim', has('app/api/iptv/account/route.js', /canClaim\(lines\)/));
ok('api: rotate refuses a line that is not yours', has('app/api/iptv/account/route.js', /lines\.find\(\(l\) => l\.id === id\)/));
ok('api: apply auto-approves only a verified token', has('app/api/reseller/apply/route.js', /verifyIdToken/) && has('app/api/reseller/apply/route.js', /auto && uid/));
ok('api: auto-approve writes an approved reseller doc', has('app/api/reseller/apply/route.js', /status: 'approved'/));
ok('api: auto-approve can be switched off with an env', has('app/api/reseller/apply/route.js', /IPTV_AUTO_APPROVE/));
ok('api: the credit comes from the env with a safe default', has('app/api/reseller/apply/route.js', /IPTV_RESELLER_CREDIT/));
ok('api: catalogue route is admin-only', has('app/api/admin/iptv/channels/route.js', /verifyAdmin/));
ok('api: catalogue save clears the cache tag', has('app/api/admin/iptv/channels/route.js', /revalidateTag\('iptv'\)/));
ok('api: catalogue import refuses a non-http link', has('app/api/admin/iptv/channels/route.js', /http\(s\)/));
ok('api: catalogue import is size limited', has('app/api/admin/iptv/channels/route.js', /MAX_BYTES/));
ok('server: catalogue cache uses the iptv tag', has('lib/iptvCatalogueServer.js', /tags: \['iptv'\]/));
ok('api: admin list aggregates self-service users', has('app/api/admin/iptv/route.js', /usersMap/));

// ---------------------------------------------------------------- 6. pages + nav
ok('page: /iptv/start exists', existsSync(join(root, 'app/iptv/start/page.js')));
ok('page: /iptv/start is indexable and has metadata', has('app/iptv/start/page.js', /pageMeta/) && !has('app/iptv/start/page.js', /noindex: true/));
ok('page: /iptv/start renders the key widget', has('app/iptv/start/page.js', /IptvClaim/));
ok('page: the widget offers Google sign in', has('components/IptvClaim.js', /GoogleAuthProvider/));
ok('page: the widget can claim a key', has('components/IptvClaim.js', /action: 'claim'|'claim'/));
ok('page: /iptv links to the instant key', has('app/iptv/page.js', /href="\/iptv\/start"/));
ok('page: /iptv/trial links to the instant key', has('app/iptv/trial/page.js', /href="\/iptv\/start"/));
ok('page: the reseller form promises instant approval', has('components/ResellerApply.js', /foran approve|Foran approve/i));
ok('page: /iptv/channels reads the IPTV catalogue first', has('app/iptv/channels/page.js', /getIptvCatalogue/));
ok('page: /iptv/channels falls back to Live TV when empty', has('app/iptv/channels/page.js', /getTvConfig/));
ok('admin: catalogue manager component exists', existsSync(join(root, 'components/IptvCatalogueAdmin.js')));
ok('admin: the IPTV page shows the catalogue manager', has('components/AdminIptv.js', /IptvCatalogueAdmin/));
ok('admin: the IPTV page shows self-service users', has('components/AdminIptv.js', /IPTV users/));
ok('nav: footer links to the free key page', has('components/Footer.js', /'\/iptv\/start'/));
ok('seo: sitemap includes /iptv/start', /'\/iptv\/start'/.test(read('app/sitemap.js')));

// ---------------------------------------------------------------- 7. docs
ok('docs: v41 upgrade notes exist', existsSync(join(root, 'UPGRADE-v41.md')));
ok('docs: the plan document is still there', existsSync(join(root, 'docs/IPTV-PLAN.md')));
ok('docs: v41 notes say what is still missing', /gateway|baqi|NAHI/i.test(read('UPGRADE-v41.md')));

// ---------------------------------------------------------------- 8. pricing unchanged
ok('money: fee 50 / wholesale 100 / cap 200 still match the plan', IPTV.fee.total === 50 && IPTV.wholesale === 100 && IPTV.cap === 200);

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
