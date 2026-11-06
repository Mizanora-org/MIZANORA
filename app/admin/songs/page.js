'use client';
import { useCallback, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ExternalLink, LoaderCircle, Music4, Search, ServerCog, Sparkles, TriangleAlert } from 'lucide-react';

// v54 — Songs console: check the music mirrors, try a live search and confirm the sitemap entry.
const SUGGESTIONS = ['Atif Aslam', 'Coke Studio', 'Arijit Singh', 'Punjabi hits', 'Nusrat Fateh Ali Khan'];

export default function AdminSongsPage() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [state, setState] = useState('idle'); // idle | loading | ok | empty | error
  const [ms, setMs] = useState(0);

  const run = useCallback(async (query) => {
    const text = String(query || '').trim();
    if (!text) return;
    setState('loading');
    const started = Date.now();
    try {
      const res = await fetch(`/api/songs/search?q=${encodeURIComponent(text)}&limit=12`, { cache: 'no-store' });
      const data = await res.json();
      setMs(Date.now() - started);
      const list = Array.isArray(data.items) ? data.items : [];
      setItems(list);
      setState(list.length ? 'ok' : 'empty');
    } catch {
      setItems([]);
      setState('error');
    }
  }, []);

  return (
    <div className="space-y-5">
      <header className="rounded-3xl border border-line bg-surface p-5 shadow-sm">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-raised px-3 py-1 text-[0.7rem] font-extrabold uppercase tracking-wider text-gold">
          <Music4 size={12} /> Songs · v54
        </p>
        <h1 className="mt-2 font-display text-2xl font-extrabold text-cream">Songs console</h1>
        <p className="mt-1 max-w-2xl text-sm text-dim">
          Songs public JioSaavn-style mirrors se aate hain. Yahan se mirror health check karein, live search test karein
          aur sitemap entry kholein. Kohi API key ki zarurat nahi — <code className="rounded bg-raised px-1">SONGS_API_BASE</code>{' '}
          env se apna mirror bhi laga sakte hain (sab se pehle try hota hai).
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
          <Link href="/songs" className="inline-flex items-center gap-1 rounded-full bg-gold px-3 py-1.5 text-white">Open /songs <ExternalLink size={12} /></Link>
          <a href="/sitemaps/songs.xml" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-dim hover:border-gold hover:text-gold">songs.xml <ExternalLink size={12} /></a>
          <a href="/api/songs/search?q=atif%20aslam" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-dim hover:border-gold hover:text-gold">API test <ExternalLink size={12} /></a>
        </div>
      </header>

      <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-display text-lg font-extrabold text-cream"><ServerCog size={18} className="text-gold" /> Mirror check</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="flex min-w-[260px] flex-1 items-center gap-2 rounded-full border border-line bg-raised px-4 py-2.5">
            <Search size={16} className="text-faint" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') run(q); }}
              placeholder="Query likhein — Atif Aslam, Coke Studio…"
              className="w-full bg-transparent text-sm font-semibold text-cream outline-none placeholder:text-faint"
              aria-label="Test song query"
            />
          </label>
          <button type="button" onClick={() => run(q)} className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2.5 text-sm font-extrabold text-white">
            {state === 'loading' ? <LoaderCircle size={15} className="animate-spin" /> : <Sparkles size={15} />} Test
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => { setQ(s); run(s); }} className="rounded-full border border-line px-2.5 py-1 text-[0.68rem] font-extrabold text-dim hover:border-gold hover:text-gold">{s}</button>
          ))}
        </div>

        <div className="mt-4 text-sm">
          {state === 'loading' && <p className="text-dim">Mirrors se jawab ka intezar…</p>}
          {state === 'ok' && (
            <p className="inline-flex items-center gap-1.5 font-bold text-emerald-700">
              <CheckCircle2 size={15} /> {items.length} songs mile · {ms}ms
            </p>
          )}
          {state === 'empty' && <p className="inline-flex items-center gap-1.5 font-bold text-amber-700"><TriangleAlert size={15} /> Mirror ne jawab diya lekin koi playable song nahi — query badal kar dekhein.</p>}
          {state === 'error' && <p className="inline-flex items-center gap-1.5 font-bold text-rose-700"><TriangleAlert size={15} /> API route tak nahi pohncha. Build/deploy ke baad dobara try karein.</p>}
        </div>

        {items.length > 0 && (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
            {items.map((s) => (
              <li key={s.id} className="flex items-center gap-3 p-2.5">
                {s.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.image} alt="" referrerPolicy="no-referrer" className="h-10 w-10 rounded-lg object-cover" />
                ) : <span className="grid h-10 w-10 place-items-center rounded-lg bg-raised text-gold"><Music4 size={16} /></span>}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-xs font-extrabold text-cream">{s.title}</p>
                  <p className="line-clamp-1 text-[0.65rem] font-semibold text-dim">{(s.artists || []).join(', ')}</p>
                </div>
                <Link href={`/songs/${s.slug}`} className="text-[0.65rem] font-extrabold text-gold hover:underline">Open</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
