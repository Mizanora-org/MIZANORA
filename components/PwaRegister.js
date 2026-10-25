'use client';
import { useEffect } from 'react';

// Service worker registration, done the professional way:
//  1. register once the page is idle (never competes with the first paint);
//  2. when a NEW version is deployed, activate it at once and reload the page once (the app updates itself);
//  3. check for a new version every 30 minutes while the app stays open.
// v28: every timer and listener is cleaned up, so hot reloads / repeated mounts cannot accumulate update loops.
export default function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return undefined;
    let cancelled = false;
    let reloaded = false;
    let idleId = null;
    let timeoutId = null;
    let updateTimer = null;
    let registration = null;
    let onUpdate = null;
    let onController = null;

    const register = async () => {
      if (cancelled) return;
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
        if (cancelled) return;
        registration = reg;
        const activate = (worker) => {
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) worker.postMessage('SKIP_WAITING');
          });
        };
        if (reg.waiting && navigator.serviceWorker.controller) reg.waiting.postMessage('SKIP_WAITING');
        onUpdate = () => activate(reg.installing);
        reg.addEventListener('updatefound', onUpdate);
        onController = () => {
          if (reloaded || cancelled) return;
          reloaded = true;
          if (document.visibilityState === 'visible') window.location.reload();
        };
        navigator.serviceWorker.addEventListener('controllerchange', onController);
        updateTimer = setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
      } catch { /* offline or blocked: the site still works */ }
    };

    const start = () => {
      if (cancelled) return;
      if (typeof window.requestIdleCallback === 'function') idleId = window.requestIdleCallback(register, { timeout: 4000 });
      else timeoutId = setTimeout(register, 1500);
    };
    const onLoad = () => start();
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', onLoad, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener('load', onLoad);
      if (idleId != null && typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(idleId);
      if (timeoutId) clearTimeout(timeoutId);
      if (updateTimer) clearInterval(updateTimer);
      if (registration && onUpdate) registration.removeEventListener('updatefound', onUpdate);
      if (onController) navigator.serviceWorker.removeEventListener('controllerchange', onController);
    };
  }, []);
  return null;
}
