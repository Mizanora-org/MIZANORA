'use client';
import { getMarkup } from '@/lib/refClient';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const Ctx = createContext(null);
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

  const value = useMemo(() => ({
    items, ready, add, setQty, remove, clear,
    count: items.reduce((s, i) => s + i.qty, 0),
    subtotal: items.reduce((s, i) => s + i.price * i.qty, 0),
  }), [items, ready, add, setQty, remove, clear]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useCart = () => useContext(Ctx);
