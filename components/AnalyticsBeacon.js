'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { takeBeacon, visitorId, BEACON_WEIGHT } from '@/lib/beaconBudget';

// Mizanora v56 — the server-side analytics beacon.
//
// lib/track.js already counts views inside the Realtime Database from the browser. This beacon adds
// what a browser cannot know by itself: country, city, timezone, network and browser/OS, read from
// the request headers by /api/analytics/collect.
//
// Rules: no admin pages, no bots, no `mz_notrack` opt-out, nothing that can delay the page.
//
// v62 — ZERO ORIGIN FOR MOST VISITS. This used to POST on EVERY client-side route change (one
// Function invocation per page view). Now takeBeacon('geo') permits exactly ONE request per tab per
// session, and only for the deterministic ~1% sample (NEXT_PUBLIC_TRACK_SAMPLE). Country, city,
// browser and referrer are session-level facts, so one well-placed request still gives Admin >
// Traffic the complete picture; the server scales the sample back up by BEACON_WEIGHT. With
// NEXT_PUBLIC_TRACK_SAMPLE=0 this component sends nothing at all.
export default function AnalyticsBeacon({ off = false }) {
  const path = usePathname() || '/';

  useEffect(() => {
    if (off || BEACON_WEIGHT <= 0) return;
    if (path.startsWith('/admin')) return;
    try {
      if (localStorage.getItem('mz_notrack')) return;
      if (navigator.doNotTrack === '1') return;
    } catch { /* private mode */ }
    const ua = navigator.userAgent || '';
    if (navigator.webdriver || /bot|crawl|spider|slurp|lighthouse|headless|preview|facebookexternalhit/i.test(ua)) return;

    const send = () => {
      // Claimed here, at send time, so a cancelled timer never spends the session's only slot.
      const w = takeBeacon('geo');
      if (!w) return;
      try {
        const body = JSON.stringify({
          w, vid: visitorId(),
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
