'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

// v36: the founder's photo wall.
// Plain <img> on purpose (the shop serves its own files, so there is nothing to optimise away),
// width/height given so the page does not jump while pictures load, and a lightbox that:
//   - opens on click, closes with Escape / the X / a click on the backdrop;
//   - moves with the arrow keys and never traps the page behind it;
//   - locks the page scroll only while it is open;
//   - keeps focus on the close button, so a keyboard user is never lost.
export default function PhotoGallery({ photos = [], title = 'Photos' }) {
  const [open, setOpen] = useState(-1);
  const closeRef = useRef(null);
  const list = Array.isArray(photos) ? photos : [];

  const go = useCallback((d) => {
    setOpen((i) => (i < 0 ? i : (i + d + list.length) % list.length));
  }, [list.length]);

  const close = useCallback(() => setOpen(-1), []);

  useEffect(() => {
    if (open < 0) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key === 'Tab' && closeRef.current) { e.preventDefault(); closeRef.current.focus(); }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    return () => { document.body.style.overflow = prevOverflow; window.removeEventListener('keydown', onKey); };
  }, [open, go, close]);

  if (!list.length) return null;
  const cur = open >= 0 ? list[open] : null;

  return (
    <section className="mt-8" aria-labelledby="photos" id="photos">
      <h2 id="photos" className="section-title mb-3">{title}</h2>
      <ul className="mz-photo-grid">
        {list.map((ph, i) => (
          <li key={ph.id || ph.src}>
            <button
              type="button"
              className="mz-photo-tile"
              onClick={() => setOpen(i)}
              aria-label={`Open photo: ${ph.alt || ph.title || 'Muaaz Iqbal'}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ph.thumb || ph.src}
                alt={ph.alt || ph.title || 'Muaaz Iqbal'}
                width={ph.width || 480}
                height={ph.height || 480}
                loading={i < 4 ? 'eager' : 'lazy'}
                decoding="async"
                referrerPolicy="no-referrer"
              />
              {ph.title ? <span className="mz-photo-cap">{ph.title}</span> : null}
            </button>
          </li>
        ))}
      </ul>

      {cur && (
        <div
          className="mz-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={cur.alt || cur.title || 'Photo'}
          onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <button ref={closeRef} type="button" className="mz-lightbox-x" onClick={close} aria-label="Close photo">
            <X size={20} aria-hidden="true" />
          </button>
          {list.length > 1 && (
            <button type="button" className="mz-lightbox-nav is-prev" onClick={() => go(-1)} aria-label="Previous photo">
              <ChevronLeft size={26} aria-hidden="true" />
            </button>
          )}
          <figure className="mz-lightbox-fig" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cur.src} alt={cur.alt || cur.title || 'Muaaz Iqbal'} width={cur.width || 1200} height={cur.height || 1200} decoding="async" referrerPolicy="no-referrer" />
            <figcaption>
              {cur.title ? <b>{cur.title}</b> : null}
              {cur.caption ? <span>{cur.caption}</span> : null}
              {list.length > 1 ? <i aria-hidden="true">{open + 1} / {list.length}</i> : null}
            </figcaption>
          </figure>
          {list.length > 1 && (
            <button type="button" className="mz-lightbox-nav is-next" onClick={() => go(1)} aria-label="Next photo">
              <ChevronRight size={26} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
