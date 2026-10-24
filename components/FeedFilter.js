'use client';
import { useState } from 'react';

// The tabs of the home feed (All / Products / Islamic / Live TV / Tools). It only sets one attribute on the feed grid; a few CSS lines
// in globals.css hide the other kinds. No cards are re-rendered, so switching is instant.
const TABS = [['all', 'Sab'], ['product', 'Products'], ['islamic', 'Islami'], ['tv', 'Live TV'], ['tool', 'Tools']];
export default function FeedFilter({ children, id = 'mz-feed' }) {
  const [f, setF] = useState('all');
  return (
    <>
      <div role="tablist" aria-label="Feed type" className="no-sb mb-3 flex gap-2 overflow-x-auto">
        {TABS.map(([k, label]) => <button key={k} type="button" role="tab" aria-selected={f === k} onClick={() => setF(k)} className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-bold transition ${f === k ? 'bg-gold text-white' : 'bg-surface text-dim ring-1 ring-line hover:bg-raised'}`}>{label}</button>)}
      </div>
      <div id={id} data-filter={f} className="mz-feed">{children}</div>
    </>
  );
}
