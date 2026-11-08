'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { proxyImage } from '@/lib/imgFallback';

// The photo of a product card. If the image cannot load in THIS visitor's browser, the whole card is marked dead and
// removed with CSS (see [data-card][data-dead] in globals.css) - a product with a broken photo never shows on the shop.
// No empty grey box, no "unavailable" card: the grid simply reflows.
// v32: before giving up, the photo is retried through the shop's own image relay (/api/img).
export default function CardPhoto({ src, alt, priority = false, sizes }) {
  const [step, setStep] = useState(0); // 0 = Next optimizer, 1 = browser direct, 2 = shop relay
  useEffect(() => { setStep(0); }, [src]);

  const dead = (e) => {
    try {
      const card = e.currentTarget.closest('[data-card]');
      if (card) card.setAttribute('data-dead', '1');
    } catch { /* ignore */ }
  };
  if (step > 0) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={step === 1 ? src : proxyImage(src)} alt={alt} referrerPolicy="no-referrer" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" onError={(e) => (step === 1 ? setStep(2) : dead(e))} />;
  }
  return (
    <Image referrerPolicy="no-referrer"
      src={src}
      alt={alt}
      fill
      priority={priority}
      sizes={sizes}
      className="object-cover"
      onError={() => setStep(1)}
    />
  );
}
