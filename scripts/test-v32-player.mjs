// v32: run the real embed script in a fake browser (jsdom) and check what it builds.
// Optional: skips itself when jsdom is not installed (`npm i jsdom --no-save`).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let JSDOM;
try { ({ JSDOM } = await import('jsdom')); } catch {
  console.log('skip  jsdom is not installed (npm i jsdom --no-save) - player test skipped');
  process.exit(0);
}

const code = fs.readFileSync(path.join(root, 'public', 'ads', 'embed.js'), 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fakeShop(ads) {
  return async (url) => {
    if (String(url).includes('/api/ads/serve')) return { ok: true, json: async () => ({ ok: true, ads, rotateMs: 40, count: ads.length, base: 'https://mizanora.vercel.app' }) };
    return { ok: true, json: async () => ({ ok: true }) };
  };
}

async function run({ html, ads }) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${html}</body></html>`, {
    url: 'https://other-site.test/page',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  window.fetch = fakeShop(ads);
  window.MZADS = { key: 'mza_test' };
  window.scrollTo = () => {};
  const s = window.document.createElement('script');
  s.textContent = code;
  window.document.head.appendChild(s);
  await sleep(200);
  return dom;
}

const mp4 = {
  id: 'v1', type: 'video', name: 'MP4 ad', headline: 'Mega sale', cta: 'Shop now',
  href: 'https://mizanora.vercel.app/deals', token: 't1', ctoken: 't2',
  video: { url: 'https://cdn.test/ad.mp4', poster: 'https://cdn.test/p.jpg', muted: true, loop: true, skipAfter: 2, kind: 'file', src: 'https://cdn.test/ad.mp4' },
};

// 1) An MP4 video ad -> a real <video> element in the slot.
{
  const second = { ...mp4, id: 'v1b', name: 'Second ad', headline: 'Second headline' };
  const dom = await run({ html: '<div id="s1" data-mz-ads="video"></div>', ads: [mp4, second] });
  const { document } = dom.window;
  const video = document.querySelector('#s1 .mza-video video');
  assert.ok(video, 'an mp4 video ad renders a <video>');
  assert.equal(video.getAttribute('src'), 'https://cdn.test/ad.mp4');
  assert.equal(video.poster, 'https://cdn.test/p.jpg');
  assert.ok(video.hasAttribute('playsinline'), 'playsinline for phones');
  assert.ok(video.muted, 'starts muted');
  const bar = document.querySelector('#s1 .mza-vbar');
  assert.ok(bar && bar.textContent.includes('Mega sale'), 'headline bar');
  const cta = document.querySelector('#s1 .mza-vcta');
  assert.ok(cta && cta.textContent === 'Shop now', 'the CTA button exists');
  assert.ok(document.querySelector('#s1 .mza-vskip'), 'skip countdown exists');
  assert.ok(document.querySelector('#s1 .mza-vmute'), 'mute button exists');
  assert.ok(document.querySelector('#s1 .mza-badge'), 'the Ad badge is always there');
  console.log('ok    embed: mp4 ad builds a real player (video, poster, play, mute, CTA, skip, badge)');

  // The play button must call play() (it used to do nothing).
  let played = 0;
  video.play = function () { played += 1; dom.window.document.querySelector('#s1 .mza-vplay').classList.add('mza-hide'); return Promise.resolve(); };
  document.querySelector('#s1 .mza-vbtn').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
  await sleep(20);
  assert.equal(played, 1, 'the play button really plays');
  console.log('ok    embed: the play button calls video.play()');

  // A playing video must not be rotated away (the slot rotates every 2.5 s at the soonest).
  Object.defineProperty(video, 'paused', { get: () => false, configurable: true });
  Object.defineProperty(video, 'ended', { get: () => false, configurable: true });
  const first = document.querySelector('#s1 .mza-video');
  const firstLabel = first.querySelector('.mza-vlabel').textContent;
  await sleep(2700);
  assert.equal(document.querySelector('#s1 .mza-video'), first, 'the slot does not rotate while the video plays');
  console.log('ok    embed: rotation waits for the video (no mid-scene cut)');

  // Paused -> the slot moves on to the next creative.
  Object.defineProperty(video, 'paused', { get: () => true, configurable: true });
  await sleep(2700);
  const now = document.querySelector('#s1 .mza-vlabel');
  assert.ok(now && now.textContent !== firstLabel, 'a paused slot rotates to the next ad');
  console.log('ok    embed: a paused video lets the rotation continue');
  dom.window.close();
}

// 2) A YouTube link -> the shop's own embed iframe, never a black <video>.
{
  const yt = {
    ...mp4, id: 'v2', name: 'YouTube ad',
    video: { url: 'https://youtu.be/dQw4w9WgXcQ', poster: '', muted: true, loop: true, skipAfter: 0, kind: 'iframe', src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&mute=1', thumb: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', label: 'YouTube' },
  };
  const dom = await run({ html: '<div id="s2" data-mz-ads="video"></div>', ads: [yt] });
  const { document } = dom.window;
  const frame = document.querySelector('#s2 .mza-video iframe');
  assert.ok(frame, 'a YouTube ad renders an iframe');
  assert.match(frame.getAttribute('src'), /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
  assert.match(frame.getAttribute('allow'), /autoplay/);
  assert.equal(document.querySelector('#s2 .mza-video video'), null, 'no empty <video> for an embed');
  dom.window.close();
  console.log('ok    embed: YouTube ad uses the iframe player (no black box)');
}

// 3) A broken video file -> a clear message, not silence.
{
  const broken = { ...mp4, id: 'v3', href: 'https://mizanora.vercel.app/deals' };
  const dom = await run({ html: '<div id="s3" data-mz-ads="video"></div>', ads: [broken] });
  const { document, Event } = dom.window;
  document.querySelector('#s3 .mza-video video').dispatchEvent(new Event('error'));
  await sleep(20);
  const hint = document.querySelector('#s3 .mza-vhint');
  assert.ok(hint, 'a failed video explains itself');
  assert.match(hint.textContent, /could not play/i);
  dom.window.close();
  console.log('ok    embed: a broken video link shows a message with the ad link');
}

// 4) A video slot with only banner ads -> a banner (never an empty player).
{
  const banner = { id: 'b1', type: 'banner', name: 'Banner', headline: 'Hello', cta: 'Visit', href: '/deals', img: 'https://cdn.test/b.jpg', token: 't', ctoken: 't' };
  const dom = await run({ html: '<div id="s4" data-mz-ads="video"></div>', ads: [banner] });
  const { document } = dom.window;
  assert.ok(document.querySelector('#s4 .mza-creative'), 'the slot still shows a banner');
  assert.equal(document.querySelector('#s4 .mza-video'), null);
  const link = document.querySelector('#s4 .mza-creative');
  assert.equal(link.getAttribute('href'), 'https://mizanora.vercel.app/deals', 'links are absolute to the shop');
  dom.window.close();
  console.log('ok    embed: a banner fills a video slot, and its link points at the shop');
}

console.log('\nAll v32 player tests passed.');
