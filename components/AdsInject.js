'use client';
import { useEffect } from 'react';

// v31: loads the shop's OWN embed script (key=self) and marks where ads may appear.
// The server only sends ads when the admin switches "Show ads on the shop itself" on
// (Admin > Ads API > Stats & Auto), so this costs nothing while it is off.
export default function AdsInject({ slots = [] }) {
  useEffect(() => {
    if (document.getElementById('mzads-self')) return;
    const s = document.createElement('script');
    s.id = 'mzads-self';
    s.async = true;
    s.src = '/api/ads/embed.js?key=self';
    s.onload = () => { try { window.MZADS_API && window.MZADS_API.refresh(); } catch (_) { /* ignore */ } };
    (document.head || document.documentElement).appendChild(s);
  }, []);
  return slots.map((t) => <div key={t} data-mz-ads={t} />);
}
