'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { heartbeat, trackPage } from '@/lib/track';

// Counts page views and keeps the "live users" record fresh. Admin pages and bots are never counted.
//
// v62: the heartbeat used to fire every 60 s in EVERY open tab — that alone is one Vercel Function
// invocation per minute per visitor, forever. It is now 2 minutes and lib/beaconBudget.js allows it
// only for the sampled visitors and at most 6 times per tab. trackPage() is budgeted the same way,
// so a normal (non-sampled) visit makes no network request at all. The server scales the sampled
// hits back up, so the live-user and daily counters in Admin > Dashboard still show estimates of
// the whole audience.
export default function Tracker({ off = false }) {
  const path = usePathname() || '/';
  useEffect(() => {
    if (off || path.startsWith('/admin')) return undefined;
    trackPage(path);
    const t = setInterval(() => { if (document.visibilityState === 'visible') heartbeat(path); }, 120000);
    return () => clearInterval(t);
  }, [path, off]);
  return null;
}
