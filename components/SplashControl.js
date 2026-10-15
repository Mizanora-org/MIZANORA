'use client';
import { useEffect } from 'react';

// Fades the opening screen out once the page is interactive (never before 700 ms, so it does not flicker).
export default function SplashControl() {
  useEffect(() => {
    const el = document.getElementById('mz-splash');
    if (!el || el.hasAttribute('data-gone')) return undefined;
    const wait = Math.max(0, 700 - performance.now());
    const t1 = setTimeout(() => {
      el.setAttribute('data-hide', '1');
      try { sessionStorage.setItem('mz_splash', '1'); } catch (_) { /* private mode */ }
      setTimeout(() => el.setAttribute('data-gone', '1'), 600);
    }, wait);
    return () => clearTimeout(t1);
  }, []);
  return null;
}
