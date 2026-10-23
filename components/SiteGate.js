'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { shopOpenNow } from '@/lib/shopHours';

// When the admin shut the website down (Admin > Control) visitors see the reason instead of the shop. The admin pages stay open.
// v24: SHOP HOURS. Outside the hours the admin set, visitors see the "shop is closed" screen (with the live Quran) and the shop opens by
// itself at opening time. The check uses the visitor's clock against Pakistan time, so nothing is read from Firebase and no redeploy is needed.
// The first (server) render is always the open shop, so Google sees the real pages; the closed screen appears right after load.
const ALWAYS_OPEN = ['/admin', '/quran', '/hadith', '/islamic', '/tools', '/live', '/search'];

export default function SiteGate({ down, hours, maintenance, closed, children }) {
  const path = usePathname() || '';
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!hours || !hours.enabled) return undefined;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(t);
  }, [hours]);
  if (path.startsWith('/admin')) return children;
  if (down) return maintenance;
  if (now && hours && hours.enabled && !ALWAYS_OPEN.some((p) => path === p || path.startsWith(`${p}/`)) && !shopOpenNow(hours, now).open) return closed;
  return children;
}
