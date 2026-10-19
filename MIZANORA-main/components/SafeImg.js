'use client';

// A plain image that removes itself (or its closest [data-dead-wrap]) when the link is broken.
// Used for the smaller pictures: category circles, banners, reels - so a dead link never leaves an empty frame.
export default function SafeImg({ src, alt = '', className = '', wrap = false, ...rest }) {
  const die = (e) => {
    try {
      const el = wrap ? e.currentTarget.closest('[data-dead-wrap]') || e.currentTarget : e.currentTarget;
      el.setAttribute('data-dead', '1');
    } catch { /* ignore */ }
  };
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} loading="lazy" decoding="async" onError={die} {...rest} />;
}
