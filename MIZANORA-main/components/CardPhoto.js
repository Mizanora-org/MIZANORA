'use client';
import { useState } from 'react';
import Image from 'next/image';

// The photo of a product card. If the image cannot load in THIS visitor's browser, the whole card is marked dead and
// removed with CSS (see [data-card][data-dead] in globals.css) - a product with a broken photo never shows on the shop.
// No empty grey box, no "unavailable" card: the grid simply reflows.
export default function CardPhoto({ src, alt, priority = false, sizes }) {
  const [raw, setRaw] = useState(false); // v19: if the optimiser cannot fetch the photo, the browser loads it directly (no referrer) before giving up
  const dead = (e) => {
    try {
      const card = e.currentTarget.closest('[data-card]');
      if (card) card.setAttribute('data-dead', '1');
    } catch { /* ignore */ }
  };
  if (raw) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} referrerPolicy="no-referrer" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" onError={dead} />;
  }
  return (
    <Image referrerPolicy="no-referrer"
      src={src}
      alt={alt}
      fill
      priority={priority}
      sizes={sizes}
      className="object-cover"
      onError={() => setRaw(true)}
    />
  );
}
