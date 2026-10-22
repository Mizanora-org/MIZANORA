'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// The ready-made animations of Admin > Studio (see lib/inject.js for the list). Everything is light: only opacity / transform, a
// handful of elements at a time, nothing runs for visitors who asked for reduced motion, and nothing runs inside /admin.
const COLORS = ['#F2C766', '#0E8556', '#E0342B', '#F29F05', '#2563EB', '#ffffff'];

function layer(cls) {
  const box = document.createElement('div');
  box.className = cls; box.setAttribute('aria-hidden', 'true');
  document.body.appendChild(box);
  return box;
}
function burst(x, y, n = 28) {
  const box = document.querySelector('.fx-confetti') || layer('fx-confetti');
  for (let k = 0; k < n && box.childElementCount < 90; k += 1) {
    const s = document.createElement('i');
    s.style.left = `${x}px`; s.style.top = `${y}px`;
    s.style.background = COLORS[k % COLORS.length];
    s.style.setProperty('--dx', `${(Math.random() - 0.5) * 260}px`);
    s.style.setProperty('--dy', `${-60 - Math.random() * 180}px`);
    s.style.setProperty('--rot', `${Math.random() * 720 - 360}deg`);
    s.addEventListener('animationend', () => s.remove());
    box.appendChild(s);
  }
}

const SETUP = {
  reveal() {
    if (!('IntersectionObserver' in window)) return () => {};
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('fx-in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px', threshold: 0.04 });
    const scan = () => document.querySelectorAll('main [data-card]:not([data-fxr]), main > section:not([data-fxr])').forEach((el) => {
      el.setAttribute('data-fxr', '1');
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) return; // already on screen: leave it alone
      el.classList.add('fx-pre'); io.observe(el);
    });
    scan();
    let t = 0;
    const mo = new MutationObserver(() => { clearTimeout(t); t = setTimeout(scan, 250); });
    mo.observe(document.getElementById('main') || document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); clearTimeout(t); document.querySelectorAll('.fx-pre').forEach((e) => e.classList.remove('fx-pre')); };
  },
  sparkle() {
    const box = layer('fx-sparkles');
    let last = 0;
    const on = (e) => {
      const now = performance.now();
      if (now - last < 45 || box.childElementCount > 26) return;
      last = now;
      const p = e.touches && e.touches[0] ? e.touches[0] : e;
      const s = document.createElement('i');
      s.style.left = `${p.clientX}px`; s.style.top = `${p.clientY}px`;
      s.style.setProperty('--dx', `${Math.random() * 36 - 18}px`);
      s.style.setProperty('--sz', `${4 + Math.random() * 6}px`);
      s.addEventListener('animationend', () => s.remove());
      box.appendChild(s);
    };
    window.addEventListener('pointermove', on, { passive: true });
    window.addEventListener('touchmove', on, { passive: true });
    return () => { window.removeEventListener('pointermove', on); window.removeEventListener('touchmove', on); box.remove(); };
  },
  lanterns() {
    const box = layer('fx-lanterns');
    box.innerHTML = '<span class="l1"><i></i></span><span class="l2"><i></i></span>';
    return () => box.remove();
  },
  confetti() {
    const on = (e) => { const b = e.target && e.target.closest && e.target.closest('[data-act="add"]'); if (b) burst(e.clientX || window.innerWidth / 2, e.clientY || window.innerHeight / 2, 22); };
    document.addEventListener('click', on, true);
    return () => { document.removeEventListener('click', on, true); const b = document.querySelector('.fx-confetti'); if (b) b.remove(); };
  },
  tilt() {
    if (!window.matchMedia('(hover: hover)').matches) return () => {};
    let cur = null;
    const reset = () => { if (cur) { cur.style.removeProperty('--rx'); cur.style.removeProperty('--ry'); cur = null; } };
    const on = (e) => {
      const c = e.target && e.target.closest && e.target.closest('[data-card]');
      if (c !== cur) reset();
      if (!c) return;
      cur = c;
      const r = c.getBoundingClientRect();
      c.style.setProperty('--ry', `${(((e.clientX - r.left) / r.width) - 0.5) * 9}deg`);
      c.style.setProperty('--rx', `${(0.5 - ((e.clientY - r.top) / r.height)) * 9}deg`);
    };
    document.addEventListener('pointermove', on, { passive: true });
    return () => { document.removeEventListener('pointermove', on); reset(); };
  },
  progress() {
    const bar = layer('fx-progress'); bar.innerHTML = '<i></i>';
    const i = bar.firstChild; let raf = 0;
    const upd = () => { raf = 0; const h = document.documentElement; const max = h.scrollHeight - h.clientHeight; i.style.transform = `scaleX(${max > 0 ? Math.min(1, h.scrollTop / max) : 0})`; };
    const on = () => { if (!raf) raf = requestAnimationFrame(upd); };
    window.addEventListener('scroll', on, { passive: true }); upd();
    return () => { window.removeEventListener('scroll', on); if (raf) cancelAnimationFrame(raf); bar.remove(); };
  },
};
const MOTION = new Set(['reveal', 'sparkle', 'lanterns', 'confetti', 'tilt']);

export default function SiteFx({ effects = [] }) {
  const path = usePathname() || '/';
  const off = path.startsWith('/admin');
  const key = off ? '' : effects.join(',');

  useEffect(() => {
    if (!key) { document.documentElement.removeAttribute('data-fx'); return undefined; }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const list = key.split(',').filter((e) => !(reduce && MOTION.has(e)));
    document.documentElement.setAttribute('data-fx', list.join(' '));
    const undo = [];
    for (const e of list) { try { if (SETUP[e]) undo.push(SETUP[e]()); } catch (err) { console.error('[studio effect]', e, err); } }
    return () => { undo.forEach((u) => { try { u(); } catch (_) { /* ignore */ } }); document.documentElement.removeAttribute('data-fx'); };
  }, [key]);

  // A confetti shower when an order has been placed.
  useEffect(() => {
    if (!key.split(',').includes('confetti') || !path.startsWith('/thank-you')) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const t = setTimeout(() => { for (let k = 0; k < 4; k += 1) burst(window.innerWidth * (0.2 + k * 0.2), window.innerHeight * 0.25, 30); }, 450);
    return () => clearTimeout(t);
  }, [key, path]);
  return null;
}
