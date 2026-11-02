/*
 * Mizanora v45 tests — EPG guide, bulk channel management, ads played IN PLACE of the stream,
 * in-app player (/iptv/player), and the tabbed admin panel.
 *
 * Run: node scripts/test-v45.mjs   (also wired into `npm test`)
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

const epg = await import('../lib/iptvEpg.js');

// ---------------------------------------------------------------- 1. XMLTV parsing
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="geo.pk"><display-name>Geo News</display-name><icon src="https://img/geo.png" /></channel>
  <channel id="ptv.sports"><display-name>PTV Sports</display-name></channel>
  <programme start="20261102120000 +0500" stop="20261102130000 +0500" channel="geo.pk"><title>News &amp; Views</title><desc>Subah ki khabrein</desc><category>News</category></programme>
  <programme start="20261102130000 +0500" stop="20261102140000 +0500" channel="geo.pk"><title>Bulletin</title></programme>
</tv>`;
const parsed = epg.parseXmltv(XML);
ok('epg: two channels parsed', parsed.channels.length === 2);
ok('epg: logo is kept', parsed.channels[0].logo === 'https://img/geo.png');
ok('epg: two programmes parsed', parsed.programmes.length === 2);
ok('epg: title is unescaped', parsed.programmes[0].title === 'News & Views');
ok('epg: +0500 offset is applied', new Date(parsed.programmes[0].start).toISOString() === '2026-11-02T07:00:00.000Z');
ok('epg: desc and category kept', parsed.programmes[0].desc === 'Subah ki khabrein' && parsed.programmes[0].category === 'News');
ok('epg: programmes sorted by start', parsed.programmes[0].start <= parsed.programmes[1].start);
ok('epg: garbage returns empty', epg.parseXmltv('not xml').programmes.length === 0);

// ---------------------------------------------------------------- 2. dates + build
ok('epg: xmltvDate writes UTC', epg.xmltvDate(Date.UTC(2026, 10, 2, 14, 30, 5)) === '20261102143005 +0000');
ok('epg: date round-trip', epg.parseXmltvDate(epg.xmltvDate(1_700_000_000_000)) === 1_700_000_000_000);
ok('epg: bad date is 0', epg.parseXmltvDate('hello') === 0);

const channels = [
  { id: '1', name: 'Geo News', group: 'News', logo: 'https://img/geo.png' },
  { id: '2', name: 'PTV Sports', group: 'Sports' },
  { id: '3', name: 'Cartoon', group: 'Kids' },
];
const now = Date.parse('2026-11-02T10:00:00Z');
const gen = epg.generatedGuide(channels, { now, hours: 6, slotMinutes: 120 });
ok('epg: generated guide fills every live channel', gen.filter((p) => p.channel.startsWith('mz-1')).length >= 4);
ok('epg: generated slots are 2 hours', gen[0].stop - gen[0].start === 2 * 3600_000);
ok('epg: generated guide skips OFF channels', epg.generatedGuide([{ id: '9', name: 'Off', off: true }], { now }).length === 0);

const map = epg.autoMap(channels, parsed.channels);
ok('epg: autoMap matches by name', map.map['1'] === 'geo.pk' && map.map['2'] === 'ptv.sports');
ok('epg: autoMap reports what is left', map.unmatched.join(',') === '3');

const scoped = epg.scopedGuide([{ ...channels[0], epg: 'geo.pk' }], parsed, { now: Date.parse('2026-11-02T12:30:00Z'), hours: 12 });
ok('epg: scoped guide keeps only our channels', scoped.programmes.every((p) => p.channel === 'geo.pk'));
ok('epg: scoped guide keeps the programmes', scoped.programmes.length === 2);

const xml = epg.toXmltv(scoped.channels, scoped.programmes);
ok('epg: xml has a tv root', xml.startsWith('<?xml') && xml.includes('<tv '));
ok('epg: xml has channel tags', (xml.match(/<channel /g) || []).length === 1);
ok('epg: xml has programme tags', (xml.match(/<programme /g) || []).length === 2);
ok('epg: xml escapes text', epg.toXmltv([{ id: 'a&b', name: 'X<Y' }], []).includes('a&amp;b'));

const nn = epg.nowNext({ programmes: parsed.programmes }, 'geo.pk', Date.parse('2026-11-02T07:30:00Z'));
ok('epg: nowNext finds the running show', nn.now && nn.now.title === 'News & Views');
ok('epg: nowNext gives the next one', nn.next && nn.next.title === 'Bulletin');
ok('epg: nowNext handles an empty guide', epg.nowNext({ programmes: [] }, 'x', now).now === null);
ok('epg: mergeGuides dedupes', epg.mergeGuides([parsed, parsed]).programmes.length === 2);
ok('epg: epgIdFor falls back to mz-<id>', epg.epgIdFor({ id: '7' }) === 'mz-7.tv');
ok('epg: epgIdFor respects a mapping', epg.epgIdFor({ id: '7', epg: 'geo.pk' }) === 'geo.pk');

// ---------------------------------------------------------------- 3. gateway guide
ok('guide: gateway module exists', existsSync(join(root, 'lib/gateway/epg.js')));
ok('guide: gateway fetches XMLTV sources', has('lib/gateway/epg.js', /fetchGuideSource/));
ok('guide: SSRF guard is used (fetchPublic)', has('lib/gateway/epg.js', /fetchPublic/));
ok('guide: cached with a tag', has('lib/gateway/epg.js', /tags: \['iptv', 'iptv-epg'\]/));
ok('guide: falls back to generated slots', has('lib/gateway/epg.js', /generatedGuide/));
ok('guide: xmltv.php is line-protected', has('app/api/gw/epg/route.js', /verifyLine/));
ok('guide: xmltv.php serves our guide', has('app/api/gw/epg/route.js', /toXmltv/));
ok('guide: admin api exists', existsSync(join(root, 'app/api/admin/iptv/epg/route.js')));
ok('guide: admin api is admin only', has('app/api/admin/iptv/epg/route.js', /verifyAdmin/));
ok('guide: admin api can test a source', has('app/api/admin/iptv/epg/route.js', /action === 'test'/));
ok('guide: admin api auto-maps after adding', has('app/api/admin/iptv/epg/route.js', /autoMap/));
ok('guide: admin card exists', existsSync(join(root, 'components/IptvEpgAdmin.js')));

// ---------------------------------------------------------------- 4. ads IN the stream
ok('ads: due check exists', has('lib/gateway/track.js', /export async function adDue/));
ok('ads: shown is recorded', has('lib/gateway/track.js', /export async function markAd/));
ok('ads: 6 hour cooldown', has('lib/gateway/track.js', /AD_COOLDOWN = 6/));
ok('ads: stream handler serves the ad instead of the channel', has('lib/gateway/handleStream.js', /serveAd/));
ok('ads: ad phase runs before the channel', has('lib/gateway/handleStream.js', /adDue\(v\.line, id\)/));
ok('ads: ad response is marked for players', has('lib/gateway/handleStream.js', /X-Mizanora-Ad/));
ok('ads: ad playlist ends so the app re-requests the channel', has('lib/gateway/handleStream.js', /EXT-X-ENDLIST/));
ok('ads: ad playlist segments are sealed too', has('lib/gateway/handleStream.js', /rewrite\(text, finalUrl, base\)/));
ok('ads: config is cached', has('lib/gateway/ads.js', /unstable_cache/));
ok('ads: ad start is logged', has('lib/gateway/handleStream.js', /ad_start/));

// ---------------------------------------------------------------- 5. bulk channel management
ok('bulk: channels api supports bulk', has('app/api/admin/iptv/channels/route.js', /action === 'bulk'/));
ok('bulk: bulk can delete', has('app/api/admin/iptv/channels/route.js', /mode === 'delete'/));
ok('bulk: bulk can move group / off', has('app/api/admin/iptv/channels/route.js', /off === null \? \{\} : \{ off \}/));
ok('bulk: manual add supported', has('app/api/admin/iptv/channels/route.js', /action === 'add'/));
ok('bulk: bulk save writes shards', has('app/api/admin/iptv/channels/route.js', /writeShardedDoc/));
ok('bulk: UI has select + bulk bar', has('components/IptvCatalogueAdmin.js', /Move group/) && has('components/IptvCatalogueAdmin.js', /Turn OFF/));
ok('bulk: UI paginates', has('components/IptvCatalogueAdmin.js', /Page \{page \+ 1\}/));
ok('bulk: UI searches', has('components/IptvCatalogueAdmin.js', /Channel search/));
ok('bulk: UI can add a channel manually', has('components/IptvCatalogueAdmin.js', /Manual channel/));

// ---------------------------------------------------------------- 6. in-app player
ok('player: /iptv/player page exists', existsSync(join(root, 'app/iptv/player/page.js')));
ok('player: UI component exists', existsSync(join(root, 'components/IptvPlayer.js')));
ok('player: line listing api exists', existsSync(join(root, 'app/api/gw/me/route.js')));
ok('player: listing api verifies the line', has('app/api/gw/me/route.js', /verifyLine/));
ok('player: listing api never returns stream urls', !/url:\s*c\.url/.test(read('app/api/gw/me/route.js')));
ok('player: guide api exists', existsSync(join(root, 'app/api/gw/guide/route.js')));
ok('player: guide api verifies the line', has('app/api/gw/guide/route.js', /verifyLine/));
ok('player: UI plays hls', has('components/IptvPlayer.js', /hls\.js/));
ok('player: UI plays the ad first', has('components/IptvPlayer.js', /startAd/));
ok('player: UI has a skip button', has('components/IptvPlayer.js', /Skip ad/));
ok('player: UI shows now/next', has('components/IptvPlayer.js', /Abhi/));
ok('player: linked from /iptv', read('app/iptv/page.js').includes("href=\"/iptv/player\""));
ok('player: in the sitemap', read('app/sitemap.js').includes("'/iptv/player'"));

// ---------------------------------------------------------------- 7. tabbed admin
ok('admin: tabs exist', has('components/AdminIptv.js', /\['overview'/));
ok('admin: channels tab', has('components/AdminIptv.js', /tab === 'channels' && <IptvCatalogueAdmin/));
ok('admin: epg tab', has('components/AdminIptv.js', /tab === 'epg' && <IptvEpgAdmin/));
ok('admin: users tab', has('components/AdminIptv.js', /tab === 'users' && <IptvLinesAdmin/));
ok('admin: tools tab', has('components/AdminIptv.js', /tab === 'tools' && <IptvToolsAdmin/));

// ---------------------------------------------------------------- 8. version + docs
ok('version: package is 45 or later', /"version": "(45|46|47|48)\.0\.0"/.test(read('package.json')));
ok('docs: v45 notes exist', existsSync(join(root, 'UPGRADE-v45.md')));
ok('docs: notes explain EPG', /EPG|XMLTV/i.test(read('UPGRADE-v45.md')));
ok('docs: notes list what is still missing', /baqi|NAHI/i.test(read('UPGRADE-v45.md')));

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
