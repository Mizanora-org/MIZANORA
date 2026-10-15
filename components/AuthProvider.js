'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { firebaseConfigured } from '@/lib/firebase-config';

// user === undefined while checking, null when signed out.
const Ctx = createContext({ user: null, ready: true });

// The Firebase login code (about 100 KB) is NOT part of the first page load any more. It is loaded in the background
// right after the page is usable, or immediately on pages that need the account (account, checkout, worker, admin).
const NEEDS_AUTH_NOW = /^\/(account|checkout|worker|workers|admin|thank-you|cart|connect)/;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);
  const [go, setGo] = useState(false);
  const path = usePathname() || '/';

  useEffect(() => {
    if (!firebaseConfigured) { setUser(null); return undefined; }
    if (go) return undefined;
    if (NEEDS_AUTH_NOW.test(path)) { setGo(true); return undefined; }
    const start = () => setGo(true);
    if (typeof requestIdleCallback === 'function') { const h = requestIdleCallback(start, { timeout: 1500 }); return () => cancelIdleCallback(h); }
    const t = setTimeout(start, 900);
    return () => clearTimeout(t);
  }, [go, path]);

  useEffect(() => {
    if (!go) return undefined;
    let off = () => {};
    let dead = false;
    Promise.all([import('firebase/auth'), import('@/lib/firebase-client')]).then(([{ onAuthStateChanged }, { authClient }]) => {
      if (dead) return;
      off = onAuthStateChanged(authClient(), (u) => setUser(u || null));
    }).catch(() => setUser(null));
    return () => { dead = true; off(); };
  }, [go]);

  const value = useMemo(() => ({ user: user || null, ready: user !== undefined }), [user]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
