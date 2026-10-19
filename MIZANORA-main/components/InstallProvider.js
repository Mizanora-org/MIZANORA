'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const Ctx = createContext({ canInstall: false, isIOS: false, installed: false, promptInstall: async () => 'unavailable' });
const DISMISS_KEY = 'mz_install_dismissed';
const COOLDOWN = 3 * 24 * 3600 * 1000; // ask again after 3 days

export function InstallProvider({ children }) {
  const [evt, setEvt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [dismissedAt, setDismissedAt] = useState(0);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    setInstalled(Boolean(standalone));
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream);
    try { setDismissedAt(Number(localStorage.getItem(DISMISS_KEY)) || 0); } catch (_) {}

    const onBip = (e) => { e.preventDefault(); setEvt(e); }; // Chrome/Edge/Samsung: keep the event, show our own button
    const onInstalled = () => { setInstalled(true); setEvt(null); };
    window.addEventListener('beforeinstallprompt', onBip);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBip);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = useCallback(() => {
    const now = Date.now();
    setDismissedAt(now);
    try { localStorage.setItem(DISMISS_KEY, String(now)); } catch (_) {}
  }, []);

  const promptInstall = useCallback(async () => {
    if (!evt) return 'unavailable';
    evt.prompt(); // must be called from a user tap
    const { outcome } = await evt.userChoice;
    setEvt(null);
    if (outcome === 'dismissed') dismiss();
    return outcome;
  }, [evt, dismiss]);

  const value = useMemo(() => ({
    canInstall: Boolean(evt) && !installed,
    isIOS: isIOS && !installed,
    installed,
    promptInstall,
    dismiss,
    snoozed: Date.now() - dismissedAt < COOLDOWN,
  }), [evt, installed, isIOS, promptInstall, dismiss, dismissedAt]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useInstall = () => useContext(Ctx);
