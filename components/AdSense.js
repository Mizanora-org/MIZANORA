'use client';
import { useEffect } from 'react';

// v60 — ADSENSE, WITHOUT THE SPEED TAX.
//
// Google AdSense (auto ads) was a plain <script async> in <head>. "async" only means it does not
// block parsing: the browser still downloads and runs ~160 KB of third-party JavaScript in the
// first seconds, on the same phone that is trying to paint the page. PageSpeed counts all of it in
// Total Blocking Time and "third-party impact", and it competes with the LCP picture.
//
// Now the tag is added at the first real sign of a visitor:
//   * a tap / scroll / key press, or
//   * the page being fully loaded and the browser idle for 2.5 s, or
//   * a normal page view with no interaction at 4 s (so an ad still shows for a passive reader).
// The <meta name="google-adsense-account"> tag stays in the head, so the site is verified either way.
//
// Set NEXT_PUBLIC_ADSENSE_EAGER=1 to load it immediately again.
const CLIENT = 'ca-pub-4008582341764263';
const SRC = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`;
const EAGER = process.env.NEXT_PUBLIC_ADSENSE_EAGER === '1';

let started = false;

function load() {
  if (started || typeof document === 'undefined') return;
  started = true;
  if (document.querySelector('script[data-mz-adsense]')) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = SRC;
  s.crossOrigin = 'anonymous';
  s.setAttribute('data-mz-adsense', '1');
  (document.head || document.documentElement).appendChild(s);
}

export default function AdSense() {
  useEffect(() => {
    if (EAGER) { load(); return undefined; }

    const events = ['pointerdown', 'touchstart', 'keydown', 'scroll', 'wheel'];
    const onFirst = () => { load(); off(); };
    const off = () => events.forEach((e) => window.removeEventListener(e, onFirst));

    let idle = 0;
    const afterLoad = () => {
      const go = () => { idle = window.setTimeout(load, 2500); };
      if ('requestIdleCallback' in window) window.requestIdleCallback(go, { timeout: 2500 });
      else go();
    };
    if (document.readyState === 'complete') afterLoad();
    else window.addEventListener('load', afterLoad, { once: true });

    // A passive reader (no taps at all) still gets the ads.
    const safety = window.setTimeout(load, 4000);

    events.forEach((e) => window.addEventListener(e, onFirst, { passive: true }));
    return () => {
      off();
      window.clearTimeout(safety);
      window.clearTimeout(idle);
    };
  }, []);
  return null;
}
