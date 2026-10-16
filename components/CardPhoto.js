'use client';
import Image from 'next/image';

// The photo of a product card. If the image cannot load in THIS visitor's browser, the whole card is marked dead and
// removed with CSS (see [data-card][data-dead] in globals.css) - a product with a broken photo never shows on the shop.
// No empty grey box, no "unavailable" card: the grid simply reflows.
export default function CardPhoto({ src, alt, priority = false, sizes }) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      sizes={sizes}
      className="object-cover"
      onError={(e) => {
        try {
          const card = e.currentTarget.closest('[data-card]');
          if (card) card.setAttribute('data-dead', '1');
        } catch { /* ignore */ }
      }}
    />
  );
}
