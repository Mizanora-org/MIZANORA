'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// v31: loads the shop's OWN embed script (key=self) and marks where ads may appear.
// The server only sends ads when the admin switches "Show ads on the shop itself" on
// (Admin > Ads API > Stats & Auto), so this costs nothing while it is off.
// v32: the script is loaded once, refreshed on client-side navigation, and every
// slot gets a reserved height so the page does not jump when an ad arrives.
const SCRIPT_ID = 'mzads-self';

function loadScript() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(SCRIPT_ID)) {
    try { window.MZADS_API && window.MZADS_API.refresh(); } catch { /* ignore */ }
    return;
  }
  const s = document.createElement('script');
  s.id = SCRIPT_ID;
  s.async = true;
  s.src = '/api/ads/embed.js?key=self';
  s.onload = () => { try { window.MZADS_API && window.MZADS_API.refresh(); } catch { /* ignore */ } };
  (document.head || document.documentElement).appendChild(s);
}

export default function AdsInject({ slots = [] }) {
  const pathname = usePathname();

  useEffect(() => { loadScript(); }, []);
  // Next's router swaps the page without a reload: re-scan the new slots.
  useEffect(() => {
    const t = setTimeout(() => { try { window.MZADS_API && window.MZADS_API.refresh(); } catch { /* ignore */ } }, 350);
    return () => clearTimeout(t);
  }, [pathname]);

  return slots.map((t, i) => (
    <div
      key={`${t}-${i}`}
      data-mz-ads={t}
      style={{ minHeight: t === 'video' ? 200 : 90, margin: '10px 0' }}
      aria-label="Sponsored"
    />
  ));
}
