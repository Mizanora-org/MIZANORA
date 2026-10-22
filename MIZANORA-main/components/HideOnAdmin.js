'use client';
import { usePathname } from 'next/navigation';

// Inside <main>, the shop's footer and floating buttons are hidden on /admin: the whole main area belongs to the admin panel.
// (Server code cannot read the pathname in a layout, so this tiny client wrapper decides.)
export default function HideOnAdmin({ children }) {
  const path = usePathname() || '/';
  if (path.startsWith('/admin')) return null;
  return children;
}
