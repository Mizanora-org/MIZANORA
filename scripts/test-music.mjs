// Mizanora background music: link checks (no network, no Firebase).
import { cleanReelMusic, normalizeMusicUrl, musicForViewer } from '../lib/reelMusic.js';

let bad = 0;
const eq = (a, b, m) => {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (!ok) bad++;
  console.log(ok ? 'ok  ' : 'FAIL', m, ok ? '' : JSON.stringify({ got: a, want: b }));
};

eq(cleanReelMusic({ url: 'https://res.cloudinary.com/x/video/upload/theme.mp3', volume: 35 }).ok, true, 'cloudinary mp3 accepted');
eq(cleanReelMusic({ url: 'http://x.com/a.mp3' }).ok, false, 'http link rejected');
eq(cleanReelMusic({ url: 'https://example.com/page.html' }).ok, false, 'web page (not audio file) rejected');
eq(cleanReelMusic({ url: '' }).value.enabled, false, 'empty link -> music off');
eq(cleanReelMusic({ url: 'https://a.com/x.mp3', volume: 999 }).value.volume, 100, 'volume clamped to 100');
eq(cleanReelMusic({ url: 'https://a.com/x.mp3', volume: 'abc' }).value.volume, 35, 'bad volume -> default 35');
eq(normalizeMusicUrl('https://drive.google.com/file/d/ABC123/view?usp=sharing'), 'https://drive.google.com/uc?export=download&id=ABC123', 'Drive share link converted');
eq(musicForViewer({ enabled: false, url: 'https://a.com/x.mp3', volume: 35 }).url, '', 'disabled -> no url for viewer');
eq(musicForViewer({ enabled: true, url: 'https://a.com/x.mp3', volume: 50 }).volume, 0.5, 'viewer volume 0..1');

if (bad) { console.error(`\n${bad} music test(s) failed.`); process.exit(1); }
console.log('\nAll music tests passed.');
