'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { MoonStar, X } from 'lucide-react';
import { quranStatus } from '@/lib/quran';

// THE SITE-WIDE QURAN SESSION (v23).
// While the admin's schedule says "live" (Admin > Quran) every page of the shop shows a small glowing button. Depending on the
// admin's choice the full Quran screen also opens by itself (bottom sheet or full screen). Browsers refuse sound until the visitor
// touches the page, so the recitation starts with the first touch ("Tap to listen" is shown until then).
// A visitor can close it: it then stays closed for the rest of that session window. Nothing runs in the admin panel, on the checkout
// pages, or while the shop is shut down.
const Host = dynamic(() => import('./QuranHost'), { ssr: false });
const QUIET = ['/admin', '/checkout', '/thank-you', '/cart', '/track', '/offline', '/quran'];
const KEY = 'mz_quran_closed';

const remember = (k) => { try { localStorage.setItem(KEY, k); } catch (_) { /* storage blocked */ } };
const closedBefore = (k) => { try { return localStorage.getItem(KEY) === k; } catch (_) { return false; } };

export default function QuranSession({ cfg }) {
  const path = usePathname() || '/';
  const [now, setNow] = useState(0);
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const autoDone = useRef(false);

  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(t); }, []);

  const st = now ? quranStatus(cfg, now) : { live: false };
  // One key for "this session window": the day + the end of the window (changes tomorrow and for every new window).
  const winKey = st.live ? `${new Date(now + 5 * 3600e3).toISOString().slice(0, 10)}|${st.why}|${st.endsAtMs ? Math.floor(st.endsAtMs / 60000) : 0}` : '';
  const quiet = QUIET.some((q) => path === q || path.startsWith(`${q}/`));
  const homeOnly = cfg.pages === 'home' && path !== '/';
  const show = st.live && !homeOnly && !path.startsWith('/admin');

  // Open by itself once per window when the admin chose "sheet" or "full" (never on quiet pages, never after the visitor closed it).
  useEffect(() => {
    if (!show || autoDone.current || quiet || cfg.display === 'pill' || !winKey) return;
    autoDone.current = true;
    if (closedBefore(winKey)) { setHidden(true); return; }
    setOpen(true);
  }, [show, quiet, cfg.display, winKey]);

  // The window ended: close the screen.
  useEffect(() => { if (!show) { setOpen(false); autoDone.current = false; } }, [show]);

  const close = useCallback(() => { setOpen(false); remember(winKey); }, [winKey]);
  const hide = useCallback(() => { setHidden(true); setOpen(false); remember(winKey); }, [winKey]);

  if (!show) return null;
  return (
    <>
      {!hidden && !open && (
        <div className="mzq-pill-wrap no-print">
          <button type="button" className="mzq-pill" onClick={() => setOpen(true)} aria-label={`${cfg.title}: open`}>
            <span className="mzq-pill-ic" aria-hidden="true"><MoonStar size={18} /></span>
            <span className="min-w-0 text-left"><b className="block truncate">{cfg.title}</b><small className="block truncate">{cfg.message || 'Sunne ke liye tap karein'}</small></span>
          </button>
          <button type="button" className="mzq-pill-x" onClick={hide} aria-label="Hide for now"><X size={14} /></button>
        </div>
      )}
      {open && <Host cfg={cfg} autoStart={cfg.autoStart} onClose={close} />}
    </>
  );
}
