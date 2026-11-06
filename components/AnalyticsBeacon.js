'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Mizanora v56 — the server-side analytics beacon.
//
// lib/track.js already counts views inside the Realtime Database from the browser. This beacon adds
// what a browser cannot know by itself: country, city, timezone, network and browser/OS, read from
// the request headers by /api/analytics/collect.
//
// Rules: no admin pages, no bots, no `mz_notrack` opt-out, nothing that can delay the page.
export default function AnalyticsBeacon({ off = false }) {
  const path = usePathname() || '/';

  useEffect(() => {
    if (off) return;
    if (path.startsWith('/admin')) return;
    try {
      if (localStorage.getItem('mz_notrack')) return;
      if (navigator.doNotTrack === '1') return;
    } catch { /* private mode */ }
    const ua = navigator.userAgent || '';
    if (navigator.webdriver || /bot|crawl|spider|slurp|lighthouse|headless|preview|facebookexternalhit/i.test(ua)) return;

    const send = () => {
      try {
        const body = JSON.stringify({
          path,
          referrer: document.referrer || '',
          title: String(document.title || '').slice(0, 120),
          lang: String(navigator.language || '').slice(0, 12),
          screen: window.innerWidth < 640 ? 'mobile' : window.innerWidth < 1024 ? 'tablet' : 'desktop',
          tz: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { return ''; } })(),
        });
        fetch('/api/analytics/collect', {
          method: 'POST',
          keepalive: true,
          headers: { 'content-type': 'application/json' },
          body,
        }).catch(() => {});
      } catch { /* ignore */ }
    };

    // Wait a moment so the beacon never competes with the page's own data requests.
    const t = setTimeout(send, 1200);
    return () => clearTimeout(t);
  }, [path, off]);

  return null;
}
