'use client';
import { useState } from 'react';
import Image from 'next/image';
import { Play } from 'lucide-react';
import { reportBrokenImage } from '@/lib/imageReport';

// v23: photos AND videos in ONE gallery. The slides are the photos first, then the product's videos; a video slide shows a poster with a
// play button and plays right there when tapped (nothing heavy loads before). `videos` are parsed videos (lib/video.js parseVideo).
export default function Gallery({ images, videos = [], name, slug }) {
  const [i, setI] = useState(0);
  const [on, setOn] = useState(false);           // the video of the current slide is playing
  const [vbad, setVbad] = useState({});
  const [bad, setBad] = useState({});            // photos that failed to load: 1 = try the plain photo, 2 = placeholder (reported once)
  const slides = [...images.map((src) => ({ t: 'img', src })), ...videos.map((v) => ({ t: 'vid', v }))];
  if (!slides.length) return <div className="grid aspect-square place-items-center rounded-2xl bg-raised font-display text-5xl text-bronze">M</div>;
  const go = (d) => { setOn(false); setI((c) => (c + d + slides.length) % slides.length); };
  const pick = (n) => { setOn(false); setI(n); };
  const poster = (v) => v.thumb || images[0] || '';
  let x0 = null;
  const cur = slides[i];

  const photo = (src, n, big) => (bad[n] === 2 ? <span className="grid h-full w-full place-items-center bg-raised text-bronze">M</span> : bad[n] === 1 ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={big ? `${name} - photo ${n + 1}` : ''} referrerPolicy="no-referrer" decoding="async" loading={big ? undefined : 'lazy'} className="absolute inset-0 h-full w-full object-cover" onError={() => { setBad((b) => ({ ...b, [n]: 2 })); if (big) reportBrokenImage(slug); }} />
  ) : (
    <Image referrerPolicy="no-referrer" src={src} alt={big ? `${name} - photo ${n + 1}` : ''} fill priority={big && n === 0} sizes={big ? '(max-width:1024px) 100vw, 50vw' : '64px'} className="object-cover" onError={() => setBad((b) => ({ ...b, [n]: 1 }))} />
  ));

  return (
    <div className="min-w-0 max-w-full">
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-line bg-raised"
        onTouchStart={(e) => { x0 = e.touches[0].clientX; }}
        onTouchEnd={(e) => { if (x0 === null || on) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 45 && slides.length > 1) go(dx < 0 ? 1 : -1); }}>
        {cur.t === 'img' ? photo(cur.src, i, true) : on ? (
          cur.v.type === 'file' && !vbad[i]
            ? <video src={cur.v.src} controls autoPlay playsInline preload="metadata" onError={() => setVbad((b) => ({ ...b, [i]: 1 }))} className="absolute inset-0 h-full w-full bg-black object-contain" />
            : cur.v.type === 'file'
              ? <a href={cur.v.url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 grid place-items-center bg-black p-4 text-center text-sm font-bold text-white">This video could not play here. Tap to open it.</a>
              : <iframe src={cur.v.src} title={`${name} video`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" className="absolute inset-0 h-full w-full border-0 bg-black" />
        ) : (
          <button type="button" onClick={() => setOn(true)} aria-label={`Play ${cur.v.label} video of ${name}`} className="group absolute inset-0 grid place-items-center">
            {poster(cur.v) ? <span className="absolute inset-0 block">{photo(poster(cur.v), 9000 + i, false)}</span> : <span className="absolute inset-0 bg-gradient-to-br from-gold to-[#073D28]" />}
            <span className="absolute inset-0 bg-black/25 transition group-hover:bg-black/10" />
            <span className="relative grid h-16 w-16 place-items-center rounded-full bg-white/95 text-gold shadow-xl"><Play size={30} fill="currentColor" /></span>
            <span className="absolute bottom-2 left-3 rounded-full bg-black/60 px-2.5 py-0.5 text-xs font-semibold text-white">{cur.v.label} video</span>
          </button>
        )}
        {slides.length > 1 && <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/55 px-2.5 py-0.5 text-xs font-semibold text-white">{i + 1} / {slides.length}</span>}
        {slides.length > 1 && !on && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous" className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-lg shadow md:grid">&#8249;</button>
            <button type="button" onClick={() => go(1)} aria-label="Next" className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-lg shadow md:grid">&#8250;</button>
          </>
        )}
      </div>
      {slides.length > 1 && (
        <div className="no-sb mt-3 flex w-full max-w-full gap-2 overflow-x-auto pb-1">
          {slides.map((s, n) => (
            <button key={n} type="button" onClick={() => pick(n)} aria-label={s.t === 'img' ? `Show photo ${n + 1}` : `Show ${s.v.label} video`}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 ${n === i ? 'border-gold' : 'border-line'}`}>
              {s.t === 'img' ? photo(s.src, n, false) : (
                <>
                  {poster(s.v) ? photo(poster(s.v), 9000 + n, false) : <span className="absolute inset-0 bg-gradient-to-br from-gold to-[#073D28]" />}
                  <span className="absolute inset-0 grid place-items-center bg-black/35 text-white"><Play size={18} fill="currentColor" /></span>
                </>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
