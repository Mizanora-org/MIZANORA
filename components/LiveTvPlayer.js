'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, List, X } from 'lucide-react';
import { channelTarget, pickAd, stepIndex } from '@/lib/liveTv';

// The Live TV player (v24.1). One channel at a time, Next / Previous / pick from the list. Every time the channel changes a product ad plays
// for the number of seconds the admin set (visitors may skip after the "skip after" seconds) while the new channel loads behind it.
// HLS (.m3u8): Safari plays it itself; other browsers get hls.js (loaded once, pinned version, from cdnjs).
const HLS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.17/hls.min.js';
let hlsPromise = null;
const loadHls = () => {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.Hls) return Promise.resolve(window.Hls);
  if (!hlsPromise) hlsPromise = new Promise((res) => { const s = document.createElement('script'); s.src = HLS_SRC; s.async = true; s.onload = () => res(window.Hls || null); s.onerror = () => res(null); document.head.appendChild(s); });
  return hlsPromise;
};
const pkr = (n) => `Rs ${Number(n).toLocaleString('en-PK')}`;

export default function LiveTvPlayer({ cfg, ads }) {
  const chans = cfg.channels;
  const [idx, setIdx] = useState(() => stepIndex(chans, -1, 1));
  const [ad, setAd] = useState(() => (cfg.ads.enabled && cfg.ads.onStart ? pickAd(ads, 0) : null));
  const [left, setLeft] = useState(() => cfg.ads.seconds);
  const [status, setStatus] = useState('loading'); // loading | playing | failed | blocked
  const [list, setList] = useState(false);
  const [q, setQ] = useState('');
  const video = useRef(null);
  const hls = useRef(null);
  const counter = useRef(1);
  const cur = chans[idx];
  const target = useMemo(() => (cur ? channelTarget(cur.url) : null), [cur]);

  const go = useCallback((to) => {
    if (to < 0 || to === idx) { return; }
    if (cfg.ads.enabled && ads.length) { setAd(pickAd(ads, counter.current)); counter.current += 1; setLeft(cfg.ads.seconds); }
    setStatus('loading'); setIdx(to); setList(false);
  }, [idx, cfg.ads.enabled, cfg.ads.seconds, ads]);
  const next = () => go(stepIndex(chans, idx, 1));
  const prev = () => go(stepIndex(chans, idx, -1));

  // ad countdown
  useEffect(() => {
    if (!ad) return undefined;
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [ad]);
  useEffect(() => { if (ad && left <= 0) setAd(null); }, [ad, left]);

  // load the channel (not for YouTube: that is an iframe)
  useEffect(() => {
    const v = video.current;
    if (hls.current) { try { hls.current.destroy(); } catch (_) { /* gone */ } hls.current = null; }
    if (!v || !target || target.kind === 'youtube') return undefined;
    let dead = false;
    const fail = () => { if (!dead) setStatus('failed'); };
    const ok = () => { if (!dead) setStatus('playing'); };
    const start = () => { const p = v.play(); if (p && p.catch) p.catch((e) => { if (!dead) setStatus(e && e.name === 'NotAllowedError' ? 'blocked' : 'failed'); }); };
    v.onplaying = ok; v.onerror = fail;
    v.removeAttribute('src'); v.load();
    const stall = setTimeout(() => { if (!dead && v.paused && v.readyState < 2) setStatus((s) => (s === 'loading' ? 'failed' : s)); }, 20000);
    (async () => {
      if (target.kind === 'hls' && !v.canPlayType('application/vnd.apple.mpegurl')) {
        const Hls = await loadHls();
        if (dead) return;
        if (Hls && Hls.isSupported()) {
          const h = new Hls({ lowLatencyMode: true, maxBufferLength: 20 });
          hls.current = h;
          h.on(Hls.Events.ERROR, (_e, d) => { if (d && d.fatal) { if (d.type === 'networkError') { try { h.startLoad(); } catch (_) { fail(); } } else fail(); } });
          h.loadSource(target.src); h.attachMedia(v);
          if (cfg.autoplay) start();
          return;
        }
      }
      v.src = target.src; if (cfg.autoplay) start();
    })();
    return () => { dead = true; clearTimeout(stall); v.onplaying = null; v.onerror = null; try { v.pause(); } catch (_) { /* gone */ } };
  }, [target, cfg.autoplay]);
  useEffect(() => () => { if (hls.current) { try { hls.current.destroy(); } catch (_) { /* gone */ } } }, []);

  // a blocked start (browser wants a touch): the next touch plays
  useEffect(() => {
    if (status !== 'blocked') return undefined;
    const go2 = () => { const v = video.current; if (v) v.play().catch(() => {}); };
    const ev = ['pointerup', 'touchend', 'click', 'keydown'];
    ev.forEach((e) => document.addEventListener(e, go2, { once: true, passive: true }));
    return () => ev.forEach((e) => document.removeEventListener(e, go2));
  }, [status]);
  // YouTube is "playing" as soon as its frame is there
  useEffect(() => { if (target && target.kind === 'youtube') setStatus('playing'); }, [target]);

  if (!cur) return <p className="rounded-2xl bg-raised p-5 text-dim">Abhi koi channel nahi hai.</p>;
  const shownList = chans.map((c, i) => ({ ...c, i })).filter((c) => !c.off && (!q.trim() || `${c.name} ${c.group}`.toLowerCase().includes(q.trim().toLowerCase())));
  const canSkip = ad && cfg.ads.seconds - left >= cfg.ads.skipAfter;

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: '16 / 9' }}>
        {target && target.kind === 'youtube' && <iframe key={target.src} src={target.src} title={cur.name} className="absolute inset-0 h-full w-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />}
        {target && target.kind !== 'youtube' && <video ref={video} className="absolute inset-0 h-full w-full bg-black" controls playsInline preload="none" poster={cur.logo || undefined} />}
        {!target && <p className="absolute inset-0 grid place-items-center p-4 text-center text-white/80">Is channel ka link theek nahi hai.</p>}
        {target && target.kind !== 'youtube' && status === 'loading' && !ad && <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-white/80">Channel load ho raha hai...</p>}
        {status === 'blocked' && !ad && <p className="pointer-events-none absolute inset-0 grid place-items-center bg-black/50 p-4 text-center font-bold text-white">Chalane ke liye screen ko chhoo dein</p>}
        {status === 'failed' && !ad && (
          <div className="absolute inset-0 grid place-items-center bg-black/80 p-4 text-center text-white"><div><p className="font-bold">Ye channel abhi nahi chal raha.</p><p className="mt-1 text-sm text-white/70">Ho sakta hai stream band ho ya dusri website par chalne se mana kare.</p><button type="button" className="mt-3 rounded-full bg-[#F5B83D] px-5 py-2 font-bold text-[#0B6B45]" onClick={next}>Agla channel</button></div></div>
        )}
        {ad && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-gradient-to-br from-[#0B6B45] to-[#06402a] p-4 text-white" role="dialog" aria-label="Advertisement">
            <span className="absolute left-3 top-3 rounded-full bg-black/40 px-2 py-0.5 text-[11px] font-bold tracking-wide">AD · {Math.max(0, left)}s</span>
            {canSkip && <button type="button" onClick={() => setAd(null)} className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-bold">Skip <X size={12} /></button>}
            <div className="flex w-full max-w-md items-center gap-4">
              {ad.image ? <img src={ad.image} alt={ad.name} className="h-28 w-28 shrink-0 rounded-xl bg-white object-cover sm:h-36 sm:w-36" /> : null}
              <div className="min-w-0 text-left">
                <p className="line-clamp-2 text-lg font-extrabold">{ad.name}</p>
                <p className="mt-1 text-xl font-extrabold text-[#F5B83D]">{pkr(ad.price)} {ad.comparePrice ? <s className="ml-1 text-sm font-semibold text-white/60">{pkr(ad.comparePrice)}</s> : null}</p>
                <Link href={`/product/${ad.slug}`} className="mt-3 inline-block rounded-full bg-white px-5 py-2 text-sm font-extrabold text-[#0B6B45]">Abhi dekhein</Link>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={prev} className="btn-ghost inline-flex items-center gap-1" aria-label="Previous channel"><ChevronLeft size={18} /> Pichla</button>
        <div className="min-w-0 text-center"><p className="truncate font-extrabold">{cur.name}</p>{cur.group && <p className="truncate text-xs text-dim">{cur.group}</p>}</div>
        <button type="button" onClick={next} className="btn-ghost inline-flex items-center gap-1" aria-label="Next channel">Agla <ChevronRight size={18} /></button>
      </div>
      <button type="button" onClick={() => setList((v) => !v)} className="btn-gold inline-flex w-full items-center justify-center gap-2"><List size={18} /> Channels ki list ({chans.filter((c) => !c.off).length})</button>
      {list && (
        <div className="card space-y-2">
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Channel talash karein" aria-label="Search channels" />
          <ul className="max-h-80 space-y-1 overflow-auto">
            {shownList.slice(0, 200).map((c) => (
              <li key={c.url}><button type="button" onClick={() => go(c.i)} className={`flex w-full items-center gap-3 rounded-xl p-2 text-left text-sm ${c.i === idx ? 'bg-gold/10 font-extrabold' : 'hover:bg-raised'}`}>
                {c.logo ? <img src={c.logo} alt="" className="h-8 w-8 rounded bg-white object-contain" loading="lazy" /> : <span className="grid h-8 w-8 place-items-center rounded bg-raised text-xs">TV</span>}
                <span className="min-w-0 flex-1 truncate">{c.name}</span>{c.group && <span className="hidden truncate text-xs text-dim sm:inline">{c.group}</span>}
              </button></li>
            ))}
            {!shownList.length && <li className="p-2 text-sm text-dim">Koi channel nahi mila.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
