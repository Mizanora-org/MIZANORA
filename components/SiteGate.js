'use client';
import { usePathname } from 'next/navigation';

// When the admin shut the website down (Admin > Control) visitors see the reason instead of the shop. The admin pages stay open.
export default function SiteGate({ down, maintenance, children }) {
  const path = usePathname() || '';
  if (down && !path.startsWith('/admin')) return maintenance;
  return children;
}
