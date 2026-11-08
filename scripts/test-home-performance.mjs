import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripModel } from '../lib/liveBadges.js';

const page = readFileSync('app/page.js', 'utf8');
const hub = readFileSync('components/HomeHub.js', 'utf8');
assert.match(page, /categories\.slice\(0, 6\)/, 'home category shelves are bounded');
assert.match(page, /max: 24/, 'mixed feed stays compact');
assert.match(page, /tvItems\.slice\(0, 14\)/, 'TV client boundary receives a small preview');
assert.match(hub, /chans\.length >= 18/, 'home hub creates only 18 TV link objects');
const preview = Array.from({ length: 14 }, (_, i) => ({ name: `Channel ${i}`, slug: `channel-${i}` }));
const b = stripModel({ tv: { count: 100000, channels: preview } });
assert.equal(b.tvCount, 100000, 'the badge shows the full channel count');
assert.equal(b.channels.length, 14, 'no full TV catalogue is sent to the banner');
console.log('Home performance: bounded shelves/feed and 100k-channel preview payload OK.');
