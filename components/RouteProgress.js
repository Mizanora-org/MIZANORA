'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

// Thin green/gold line at the top: starts the instant a link is tapped and finishes when the new page shows.
// This is why a tap now gives instant feedback instead of feeling like the app hung.
export default function RouteProgress() {
  const path = usePathname();
  const bar = useRef(null);
  const timer = useRef(0);
  const safety = useRef(0);
  const width = useRef(0);

  const set = (w, on) => {
    const el = bar.current;
    if (!el) return;
    el.style.width = `${w}%`;
    if (on) el.setAttribute('data-on', '1'); else el.removeAttribute('data-on');
  };
  const stop = () => { clearInterval(timer.current); clearTimeout(safety.current); };
  const finish = () => {
    stop();
    if (!width.current) return;
    set(100, true);
    safety.current = setTimeout(() => { set(0, false); width.current = 0; }, 260);
  };

  useEffect(() => { finish(); /* the page changed */ }, [path]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const start = () => {
      stop();
      width.current = 12; set(12, true);
      timer.current = setInterval(() => { width.current += (90 - width.current) * 0.12; set(width.current, true); }, 220);
      safety.current = setTimeout(finish, 9000); // never stay on screen forever
    };
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      let u;
      try { u = new URL(a.href, window.location.href); } catch (_) { return; }
      if (u.origin !== window.location.origin) return;
      if (u.pathname === window.location.pathname) return; // same page (search / hash): nothing to wait for
      start();
    };
    document.addEventListener('click', onClick, true);
    return () => { document.removeEventListener('click', onClick, true); stop(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div id="mz-progress" ref={bar} aria-hidden="true" />;
}
