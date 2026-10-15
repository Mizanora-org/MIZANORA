'use client';
import { getMarkup } from '@/lib/refClient';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const StateCtx = createContext(null);
const ActionsCtx = createContext(null);
const KEY = 'mz_cart';

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const load = () => {
      try { setItems(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (_) { setItems([]); }
    };
    load();
    setReady(true);
    const onStorage = (e) => { if (e.key === KEY) load(); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (_) { /* storage full or blocked */ }
  }, [items, ready]);

  const add = useCallback((p, { size = '', qty = 1 } = {}) => {
    setItems((cur) => {
      const key = `${p.id}|${size}`;
      const found = cur.find((i) => i.key === key);
      if (found) return cur.map((i) => (i.key === key ? { ...i, qty: Math.min(10, i.qty + qty) } : i));
      return [...cur, { key, id: p.id, slug: p.slug || p.id, name: p.name, price: p.price + getMarkup(p.id), image: (p.images && p.images[0]) || p.image || '', size, qty: Math.min(10, qty) }];
    });
  }, []);
  const setQty = useCallback((key, qty) => {
    setItems((cur) => cur.map((i) => (i.key === key ? { ...i, qty: Math.max(1, Math.min(10, qty)) } : i)));
  }, []);
  const remove = useCallback((key) => setItems((cur) => cur.filter((i) => i.key !== key)), []);
  const clear = useCallback(() => setItems([]), []);

  // Two contexts: components that only ADD to the cart (product cards, product page) never re-render when the cart changes.
  const actions = useMemo(() => ({ add, setQty, remove, clear }), [add, setQty, remove, clear]);
  const state = useMemo(() => ({
    items, ready,
    count: items.reduce((s, i) => s + i.qty, 0),
    subtotal: items.reduce((s, i) => s + i.price * i.qty, 0),
  }), [items, ready]);

  return <ActionsCtx.Provider value={actions}><StateCtx.Provider value={state}>{children}</StateCtx.Provider></ActionsCtx.Provider>;
}

export const useCartActions = () => useContext(ActionsCtx);
// Everything (same as before): cart items, count, subtotal and the actions.
export function useCart() {
  const state = useContext(StateCtx);
  const actions = useContext(ActionsCtx);
  return useMemo(() => ({ ...state, ...actions }), [state, actions]);
}
