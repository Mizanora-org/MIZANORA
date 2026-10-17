'use client';
import { useState } from 'react';
import Image from 'next/image';
import { reportBrokenImage } from '@/lib/imageReport';

export default function Gallery({ images, name, slug }) {
  const [i, setI] = useState(0);
  const [bad, setBad] = useState({}); // photos that failed to load: 1 = try the plain photo, 2 = placeholder (reported once)
  if (!images.length) return <div className="grid aspect-square place-items-center rounded-2xl bg-raised font-display text-5xl text-bronze">M</div>;
  const go = (d) => setI((c) => (c + d + images.length) % images.length);
  let x0 = null;
  return (
    <div className="min-w-0 max-w-full">
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-line bg-raised"
        onTouchStart={(e) => { x0 = e.touches[0].clientX; }}
        onTouchEnd={(e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 45 && images.length > 1) go(dx < 0 ? 1 : -1); }}>
        {bad[i] === 2 ? <div className="grid h-full w-full place-items-center font-display text-5xl text-bronze">M</div> : bad[i] === 1 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={images[i]} alt={`${name} - photo ${i + 1}`} referrerPolicy="no-referrer" decoding="async" className="absolute inset-0 h-full w-full object-cover" onError={() => { setBad((b) => ({ ...b, [i]: 2 })); reportBrokenImage(slug); }} />
        ) : (
          <Image src={images[i]} alt={`${name} - photo ${i + 1}`} fill priority={i === 0} sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" onError={() => setBad((b) => ({ ...b, [i]: 1 }))} />
        )}
        {images.length > 1 && <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2.5 py-0.5 text-xs font-semibold text-white">{i + 1} / {images.length}</span>}
      </div>
      {images.length > 1 && (
        <div className="no-sb mt-3 flex w-full max-w-full gap-2 overflow-x-auto pb-1">
          {images.map((src, n) => (
            <button key={src + n} onClick={() => setI(n)} aria-label={`Show photo ${n + 1}`}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 ${n === i ? 'border-gold' : 'border-line'}`}>
              {bad[n] === 2 ? <span className="grid h-full w-full place-items-center bg-raised text-bronze">M</span> : bad[n] === 1 ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" referrerPolicy="no-referrer" loading="lazy" className="absolute inset-0 h-full w-full object-cover" onError={() => setBad((b) => ({ ...b, [n]: 2 }))} />
              ) : <Image src={src} alt="" fill sizes="64px" className="object-cover" onError={() => setBad((b) => ({ ...b, [n]: 1 }))} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
