'use client';
import { useEffect } from 'react';

// App-like touch behaviour: the page itself never pinch-zooms or "bounces" (like a real app).
// Normal scrolling, taps, the photo swipe and typing are not affected.
export default function AppFeel() {
  useEffect(() => {
    const stop = (e) => e.preventDefault();
    const move = (e) => { if (e.touches && e.touches.length > 1) e.preventDefault(); };
    ['gesturestart', 'gesturechange', 'gestureend'].forEach((t) => document.addEventListener(t, stop));
    document.addEventListener('touchmove', move, { passive: false });
    return () => {
      ['gesturestart', 'gesturechange', 'gestureend'].forEach((t) => document.removeEventListener(t, stop));
      document.removeEventListener('touchmove', move);
    };
  }, []);
  return null;
}
