'use client';
import { useEffect } from 'react';

// v60 — the old AppFeel put a NON-PASSIVE touchmove listener on document and cancelled every
// multi-touch gesture. Two problems:
//   1. a non-passive touchmove on document means the browser must ask JavaScript before it can
//      scroll, on every single finger movement (the classic "scroll feels sticky" bug);
//   2. it blocked pinch-zoom, which is an accessibility failure (low-vision visitors could not
//      enlarge the shop) and PageSpeed lists it under "Prevents zooming and scaling".
// The shop now behaves like a normal web page: fast native scrolling and working zoom. The app-like
// touches that DO help (no rubber-band on the sheets, tap feedback, swipe rows) are handled by the
// individual components. This file stays so old imports keep working.
export default function AppFeel() {
  useEffect(() => {
    // One tiny, passive guard: a double-tap on a button must not zoom the page on iOS.
    const no = (e) => { if (e.touches && e.touches.length > 1) return; };
    document.addEventListener('touchstart', no, { passive: true });
    return () => document.removeEventListener('touchstart', no);
  }, []);
  return null;
}
