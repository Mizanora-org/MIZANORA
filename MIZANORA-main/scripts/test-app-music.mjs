// The app background music and the shared audio-link rules (no network, no Firebase).
import { cleanAppMusic, musicForViewer } from '../lib/appMusic.js';
import { checkAudioUrl, clampVolume, isAudioLink, normalizeAudioUrl } from '../lib/audioLink.js';

let bad = 0;
const eq = (a, b, m) => {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (!ok) bad++;
  console.log(ok ? 'ok  ' : 'FAIL', m, ok ? '' : JSON.stringify({ got: a, want: b }));
};
const ok = (v, m) => eq(Boolean(v), true, m);

// ---- the shared link rules
eq(isAudioLink('https://x.com/a.mp3'), true, 'a .mp3 link is an audio link');
eq(isAudioLink('https://x.com/a.m4a?token=1'), true, 'a .m4a link with a query is an audio link');
eq(isAudioLink('https://x.com/page.html'), false, 'a web page is not an audio link');
eq(isAudioLink('https://dl.dropboxusercontent.com/a/b'), true, 'a dropbox direct link is an audio link');
eq(normalizeAudioUrl('https://drive.google.com/file/d/ABC/view?usp=sharing'), 'https://drive.google.com/uc?export=download&id=ABC', 'Drive share link converted');
eq(normalizeAudioUrl('https://www.dropbox.com/s/x/a.mp3?dl=0'), 'https://dl.dropboxusercontent.com/s/x/a.mp3?raw=1', 'Dropbox share link converted');
eq(checkAudioUrl('http://x.com/a.mp3').ok, false, 'http link rejected');
eq(checkAudioUrl('https://x.com/a.mp3').ok, true, 'https mp3 accepted');
eq(clampVolume(999), 100, 'volume clamped to 100');
eq(clampVolume(-5), 0, 'volume clamped to 0');
eq(clampVolume('abc', 30), 30, 'a broken volume falls back to the default');

// ---- the app music settings
eq(cleanAppMusic({ url: 'https://res.cloudinary.com/x/video/upload/theme.mp3' }).ok, true, 'a cloudinary mp3 is accepted');
eq(cleanAppMusic({ url: 'https://x.com/page.html' }).ok, false, 'a web page is rejected');
eq(cleanAppMusic({ url: '' }).value.enabled, false, 'an empty link switches the music off');
eq(cleanAppMusic({ url: '' }).ok, true, 'an empty link is not an error');
eq(cleanAppMusic({ url: 'https://a.com/x.mp3', volume: 250 }).value.volume, 100, 'the volume is clamped');
eq(cleanAppMusic({ url: 'https://a.com/x.mp3', title: '  Mizanora   theme  ' }).value.title, 'Mizanora theme', 'the name is cleaned up');
eq(cleanAppMusic({ url: 'https://a.com/x.mp3', enabled: false }).value.enabled, false, 'the switch is kept');
eq(cleanAppMusic({ url: 'https://a.com/x.mp3', autoplay: false }).value.autoplay, false, 'the autoplay switch is kept');
eq(cleanAppMusic({ url: 'https://drive.google.com/file/d/ABC/view' }).value.url, 'https://drive.google.com/uc?export=download&id=ABC', 'the drive link is converted before saving');

// ---- what the browser gets
eq(musicForViewer({ enabled: false, url: 'https://a.com/x.mp3', volume: 30 }).url, '', 'a disabled music has no url');
eq(musicForViewer({ enabled: true, url: 'https://a.com/x.mp3', volume: 50 }).volume, 0.5, 'the viewer volume is 0..1');
eq(musicForViewer({ enabled: true, url: 'https://a.com/x.mp3', volume: 50 }).autoplay, true, 'autoplay is on by default');
eq(musicForViewer({ enabled: true, url: 'not-a-link', volume: 50 }).url, '', 'a link that is not https is not sent to the browser');

if (bad) { console.error(`\n${bad} app music test(s) failed.`); process.exit(1); }
console.log('\nAll app music tests passed.');
