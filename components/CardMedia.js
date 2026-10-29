'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Play } from 'lucide-react';
import { parseVideo } from '@/lib/video';
import { proxyImage } from '@/lib/imgFallback';

// THE CARD PICTURE, WITH FOUR STEPS (so a card is never an empty grey box):
//   1. the product photo (optimised by Next);
//   1b. v19: if the optimiser cannot fetch it (many supplier / Facebook / Instagram hosts refuse server downloads), the SAME photo
//       is loaded straight by the visitor's browser with no referrer. This alone fixes most "image not loading" cases;
//   1c. v32: if the browser also refuses it (hotlink protection, expired signature, http link), the shop's own relay
//       (/api/img) fetches it on the server and serves it from our address;
//   2. if that photo cannot load at all -> the product's video (a real <video> first frame, or a
//      branded play cover for Facebook / Instagram / TikTok / YouTube embeds);
//   3. only if there is no photo AND no video, the card removes itself with CSS ([data-card][data-dead]).
export default function CardMedia({ img, alt, priority = false, sizes, video = '' }) {
  const first = img ? 'img' : video ? 'video' : 'dead';
  const [state, setState] = useState(first); // 'img' | 'raw' | 'proxy' | 'video' | 'dead'
  const v = parseVideo(video) || null;

  // A recycled card (list refresh, "load more", filter) must not keep the state of the previous product.
  useEffect(() => { setState(img ? 'img' : video ? 'video' : 'dead'); }, [img, video]);

  if (state === 'dead' || (!img && !video)) {
    return <div data-die="1" className="h-full w-full bg-raised" aria-hidden="true" />;
  }

  if (state === 'video' && v && v.type === 'file') {
    return (
      <>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video src={v.src} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
        <span className="absolute bottom-2 right-2 z-10 grid h-7 w-7 place-items-center rounded-full bg-cream/70 text-white" aria-hidden="true"><Play size={13} /></span>
      </>
    );
  }

  if (state === 'video') {
    return (
      <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-[#0E8556] to-[#073D28]">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-white/90 text-[#0B6B45] shadow-lg" aria-hidden="true"><Play size={20} /></span>
        <span className="absolute bottom-2 left-2 rounded-md bg-cream/70 px-2 py-0.5 text-[0.65rem] font-bold text-white">{v ? `${v.label} video` : 'Video'}</span>
      </div>
    );
  }

  if (state === 'raw' || state === 'proxy') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={state === 'proxy' ? proxyImage(img) : img} alt={alt} referrerPolicy="no-referrer" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" onError={() => setState(state === 'raw' ? 'proxy' : video ? 'video' : 'dead')} />;
  }

  return (
    <Image referrerPolicy="no-referrer"
      src={img}
      alt={alt}
      fill
      priority={priority}
      sizes={sizes}
      decoding="async"
      className="object-cover"
      onError={() => setState('raw')}
    />
  );
}
