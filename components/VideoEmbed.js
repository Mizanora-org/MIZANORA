'use client';
import { useState } from 'react';
import Image from 'next/image';
import { Play } from 'lucide-react';

// Click-to-play videos. Nothing heavy loads until the shopper taps play, so product pages stay fast.
function One({ v, title }) {
  const [on, setOn] = useState(false);
  const [broken, setBroken] = useState(false);
  const ratio = v.vertical ? 'aspect-[9/16] max-w-xs' : 'aspect-video';
  return (
    <div className={`relative w-full overflow-hidden rounded-2xl border border-line bg-cream ${ratio}`}>
      {on ? (
        v.type === 'file'
          ? (broken
            ? <a href={v.url} target="_blank" rel="noopener noreferrer" className="grid h-full w-full place-items-center bg-black p-4 text-center text-sm font-bold text-white">This video could not play here. Tap to open it.</a>
            : <video src={v.src} controls autoPlay playsInline preload="metadata" onError={() => setBroken(true)} className="h-full w-full bg-black" />)
          : <iframe src={v.src} title={`${title} video`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" loading="lazy" className="h-full w-full border-0" />
      ) : (
        <button type="button" onClick={() => setOn(true)} aria-label={`Play ${v.label} video of ${title}`} className="group absolute inset-0 grid place-items-center">
          {v.thumb && <Image referrerPolicy="no-referrer" src={v.thumb} alt="" fill sizes="(max-width:768px) 100vw, 50vw" className="object-cover" />}
          {!v.thumb && <span className="absolute inset-0 bg-gradient-to-br from-gold to-[#073D28]" />}
          <span className="absolute inset-0 bg-black/20 transition group-hover:bg-black/10" />
          <span className="relative grid h-16 w-16 place-items-center rounded-full bg-white/95 text-gold shadow-xl"><Play size={30} fill="currentColor" /></span>
          <span className="absolute bottom-2 left-3 rounded-full bg-black/60 px-2.5 py-0.5 text-xs font-semibold text-white">{v.label}</span>
        </button>
      )}
    </div>
  );
}

export default function VideoEmbed({ videos, title }) {
  if (!videos.length) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {videos.map((v) => <One key={v.url} v={v} title={title} />)}
    </div>
  );
}
