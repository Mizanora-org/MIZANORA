// v20: Islamic feed content, season modes, video links, Hijri events. Run: node scripts/test-v20.mjs
import { ISLAMIC_ITEMS, cleanFeedItem } from '../lib/islamic.js';
import { REMINDERS } from '../lib/reminders.js';
import { seasonFor, SEASON_MODES, SEASONS } from '../lib/season.js';
import { parseVideo } from '../lib/video.js';
import { nextIslamicEvent } from '../lib/hijri.js';
let bad = 0;
const t = (name, ok, extra = '') => { if (!ok) bad++; console.log(`${ok ? 'ok   ' : 'FAIL '} ${name}${ok ? '' : ` ${extra}`}`); };

// Islamic feed: every text has Arabic, meaning and a reference; no duplicate ids; kinds are known
const ids = new Set(); let dup = false, missing = '';
for (const x of ISLAMIC_ITEMS) { if (ids.has(x.id)) dup = true; ids.add(x.id); if (!x.ar || !x.ur || !x.ref) missing += x.id + ' '; }
t('feed ids are unique', !dup);
t('every feed item has Arabic, meaning and reference', !missing, missing);
t('feed kinds are valid', ISLAMIC_ITEMS.every((x) => ['ayat', 'hadith', 'qaul', 'dua'].includes(x.kind)));
t('feed has ayat, hadith and dua', ['ayat', 'hadith', 'dua'].every((k) => ISLAMIC_ITEMS.some((x) => x.kind === k)));
t('old daily reminders still exist', REMINDERS.length >= 8);
t('a post without a reference is refused', cleanFeedItem({ kind: 'hadith', ur: 'x' }) === null);
t('a post without a meaning is refused', cleanFeedItem({ kind: 'hadith', ref: 'Bukhari 1' }) === null);
t('markup is stripped from a post', !JSON.stringify(cleanFeedItem({ kind: 'ayat', ur: '<b>hi</b>', ref: 'x 1:1' })).includes('<'));

// Seasons
t('default look is winter', seasonFor(new Date('2026-10-19')).id === 'winter');
t('admin can force autumn', seasonFor(new Date('2026-10-19'), 'autumn').id === 'autumn');
t('auto follows the month (Dec = winter, Jun = summer)', seasonFor(new Date('2026-12-10'), 'auto').id === 'winter' && seasonFor(new Date('2026-06-10'), 'auto').id === 'summer');
t('off switches the look off', seasonFor(new Date(), 'off') === null);
t('all modes are known', SEASON_MODES.every((m) => m === 'auto' || m === 'off' || SEASONS[m]));

// Videos
const cases = { 'https://youtu.be/dQw4w9WgXcQ': 'youtube', 'https://vimeo.com/123456789': 'vimeo', 'https://www.dailymotion.com/video/x8abc12': 'dailymotion', 'https://streamable.com/abc12': 'streamable', 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view': 'drive', 'https://example.com/a.mp4': 'file', 'https://example.com/a.webm?x=1': 'file' };
for (const [u, type] of Object.entries(cases)) t(`video link ${type}`, (parseVideo(u) || {}).type === type, u);
t('a normal web page is not a video', parseVideo('https://example.com/page.html') === null);
t('Dropbox share link becomes a direct file', (parseVideo('https://www.dropbox.com/s/abc/v.mp4?dl=0') || {}).src === 'https://www.dropbox.com/s/abc/v.mp4?raw=1');

// Hijri
const ev = nextIslamicEvent(new Date('2026-10-19'));
t('a next Islamic occasion is found within a year', ev && ev.inDays >= 0 && ev.inDays <= 400, JSON.stringify(ev));
console.log(bad ? `\n${bad} FAILED` : '\nAll v20 tests passed.');
process.exit(bad ? 1 : 0);
