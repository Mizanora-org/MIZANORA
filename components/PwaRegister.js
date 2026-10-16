'use client';
import { useEffect } from 'react';

// Service worker registration, done the professional way:
//  1. register once the page is idle (never competes with the first paint);
//  2. when a NEW version is deployed, activate it at once and reload the page once (the app updates itself);
//  3. check for a new version every 30 minutes while the app stays open.
export default function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return undefined;
    let reloaded = false;
    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
        const activate = (worker) => {
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              worker.postMessage('SKIP_WAITING');
            }
          });
        };
        if (reg.waiting && navigator.serviceWorker.controller) reg.waiting.postMessage('SKIP_WAITING');
        reg.addEventListener('updatefound', () => activate(reg.installing));
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (reloaded) return;
          reloaded = true;
          if (document.visibilityState === 'visible') window.location.reload();
        });
        setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
      } catch { /* offline or blocked: the site still works */ }
    };
    const idle = window.requestIdleCallback ? () => window.requestIdleCallback(register, { timeout: 4000 }) : () => setTimeout(register, 1500);
    if (document.readyState === 'complete') idle();
    else window.addEventListener('load', idle, { once: true });
    return undefined;
  }, []);
  return null;
}
