'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { heartbeat, trackPage } from '@/lib/track';

// Counts page views and keeps the "live users" record fresh. Admin pages and bots are never counted.
export default function Tracker({ off = false }) {
  const path = usePathname() || '/';
  useEffect(() => {
    if (off || path.startsWith('/admin')) return undefined;
    trackPage(path);
    const t = setInterval(() => { if (document.visibilityState === 'visible') heartbeat(path); }, 40000);
    return () => clearInterval(t);
  }, [path, off]);
  return null;
}
