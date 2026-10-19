'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import ProductCard from '@/components/ProductCard';

// "AAP KE LIYE" (for you). The assistant remembers which categories a shopper talked about (their own device, no account,
// no tracking) and this shelf shows the cheapest good products from those categories. The product list comes from
// /api/for-you, which searches the WHOLE catalogue (archived files included) - so it also works when nothing is in Firebase.
export default function ForYouShelf({ assistant }) {
  const [cats, setCats] = useState([]);
  const [items, setItems] = useState([]);

  useEffect(() => {
    let mine = true;
    let prefs = null;
    try { prefs = JSON.parse(localStorage.getItem('mz_ai_prefs') || 'null'); } catch (_) { prefs = null; }
    const top = prefs && prefs.cats ? Object.entries(prefs.cats).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([slug]) => slug).filter(Boolean) : [];
    if (!top.length) return undefined;
    setCats(top);
    fetch(`/api/for-you?cats=${encodeURIComponent(top.join(','))}&limit=10`)
      .then((r) => r.json())
      .then((j) => { if (mine && j && j.ok) setItems(j.items || []); })
      .catch(() => {});
    return () => { mine = false; };
  }, []);

  if (!items.length) return null;
  const names = items[0] && items[0].categories ? items[0].categories[0] : '';
  return (
    <section className="mx-auto max-w-7xl scroll-mt-20 px-3 pt-8 sm:px-4" aria-labelledby="foryou">
      <div className="rounded-2xl border border-gold/30 bg-gold/5 p-3 sm:p-4">
        <div className="mb-3 flex items-end justify-between gap-4">
          <h2 id="foryou" className="section-title flex items-center gap-2">
            <Sparkles size={20} className="text-gold" /> Aap ke liye
            {names && <span className="text-sm font-semibold text-dim">({names}{cats.length > 1 ? ' aur aap ki pasand' : ''})</span>}
          </h2>
          {assistant && assistant.enabled && (
            <Link href={`/products?q=${encodeURIComponent(cats[0].replace(/-/g, ' '))}`} className="flex items-center gap-1 whitespace-nowrap text-sm font-bold text-gold">
              Aur dekhein <ArrowRight size={15} />
            </Link>
          )}
        </div>
        <div className="no-sb -mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-2 md:mx-0 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:px-0 lg:grid-cols-5">
          {items.slice(0, 10).map((p) => (
            <div key={p.id} className="w-[44vw] max-w-[200px] shrink-0 snap-start md:w-auto md:max-w-none"><ProductCard p={p} /></div>
          ))}
        </div>
        <p className="text-[0.7rem] text-faint">{assistant && assistant.enabled ? `Ye ${assistant.name} ki yaad se: aap ne in cheezon mein dilchaspi dikhai thi.` : 'Aap ki pasand ke mutabiq.'}</p>
      </div>
    </section>
  );
}
