'use client';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

// ONE SEARCH BOX FOR THE WHOLE ADMIN PANEL.
// The box lives in the admin sidebar (components/AdminNav.js); the pages read the same query through useAdminSearch()
// and filter their lists with it. Without a provider the hook stays safe (empty query), so pages can also be opened alone.
const Ctx = createContext(null);

export function AdminSearchProvider({ children }) {
  const [q, setQ] = useState('');
  const clear = useCallback(() => setQ(''), []);
  const value = useMemo(() => ({ q, setQ, clear }), [q, clear]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminSearch() {
  const c = useContext(Ctx);
  return c || { q: '', setQ: () => {}, clear: () => {} };
}
