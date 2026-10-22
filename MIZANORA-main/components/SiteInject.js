'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { pageMatches } from '@/lib/inject';

// Your own snippets from Admin > Studio. CSS and HTML are part of the page (so there is no flash); JavaScript runs once per snippet per visit.
// Injected scripts get a tiny helper:  window.MZ.onRoute(fn)  calls fn(path) now and after every page change inside the shop.
// Safe mode: open any shop address with ?noinject=1 to switch every snippet off for this visit (?noinject=0 turns it back on).
// Never active inside /admin.
export default function SiteInject({ items = [], slot = 'end' }) {
  const path = usePathname() || '/';
  const [safe, setSafe] = useState(false);

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('noinject');
      if (q === '1') sessionStorage.setItem('mz_noinject', '1');
      if (q === '0') sessionStorage.removeItem('mz_noinject');
      setSafe(sessionStorage.getItem('mz_noinject') === '1');
    } catch (_) { setSafe(false); }
  }, [path]);

  const off = safe || path.startsWith('/admin');
  const mine = off ? [] : items.filter((i) => pageMatches(i.pages, path));
  const jsKey = slot === 'end' ? mine.filter((i) => i.type === 'js').map((i) => i.id).join(',') : '';

  useEffect(() => {
    if (slot !== 'end') return;
    const w = window;
    if (!w.MZ) { w.MZ = { subs: [], onRoute(fn) { try { fn(w.location.pathname); } catch (e) { console.error('[mz-inject]', e); } this.subs.push(fn); }, path: () => w.location.pathname }; }
    w.MZ.subs.forEach((fn) => { try { fn(path); } catch (e) { console.error('[mz-inject]', e); } });
  }, [path, slot]);

  useEffect(() => {
    if (!jsKey) return;
    const done = (window.__mzInj = window.__mzInj || {});
    for (const it of mine.filter((i) => i.type === 'js')) {
      if (done[it.id]) continue;
      done[it.id] = 1;
      try {
        const s = document.createElement('script');
        s.setAttribute('data-mz-inject', it.id);
        s.textContent = `try{\n${it.code}\n}catch(e){console.error('[mz-inject ${it.id}]',e)}`;
        document.body.appendChild(s);
      } catch (e) { console.error('[mz-inject]', e); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jsKey]);

  return (
    <>
      {mine.filter((i) => i.type === 'css' && slot === 'end').map((i) => <style key={i.id} data-mz-inject={i.id} dangerouslySetInnerHTML={{ __html: i.code }} />)}
      {mine.filter((i) => i.type === 'html' && (i.where === 'top' ? slot === 'top' : slot === 'end')).map((i) => <div key={i.id} data-mz-inject={i.id} dangerouslySetInnerHTML={{ __html: i.code }} />)}
    </>
  );
}
