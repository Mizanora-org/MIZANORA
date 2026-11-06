'use client';
import { useCallback, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2, Clapperboard, ExternalLink, Film, LoaderCircle, Play, Search, Server, Sparkles, TriangleAlert,
} from 'lucide-react';
import MovieServersAdmin from '@/components/MovieServersAdmin';

// v54 — the Movies console, rebuilt.
//
// The old page was a "custom movie" CRUD: title, year, story, cast, poster… typed in by hand. That
// system is retired: every film and series now comes from IMDb (Cinemeta), and an IMDb id is enough
// to open a page. This console keeps the parts an admin actually needs:
//   * test any IMDb id / title against the same search the site uses
//   * jump to the catalogue, the world browser and the sitemap chunks
//   * manage the play servers (domain/play/{imdbid}) that feed the Mizanora player
export default function AdminMoviesPage() {
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
      const res = await fetch(`/api/movies/search?q=${encodeURIComponent(text)}`, { cache: 'no-store' });
      const data = await res.json();
      setMs(Date.now() - started);
      const list = Array.isArray(data.items) ? data.items : [];
      setItems(list.slice(0, 8));
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
          <Clapperboard size={12} /> IMDb catalogue · v54
        </p>
        <h1 className="mt-2 font-display text-2xl font-extrabold text-cream">Movies &amp; Series</h1>
        <p className="mt-1 max-w-2xl text-sm text-dim">
          Ab koi &quot;custom movie&quot; add nahi hoti. Har film aur series <strong className="text-cream">IMDb (Cinemeta)</strong> se
          aati hai — poster, rating, cast, story aur episodes khud aa jate hain, aur IMDb id hi slug hota hai
          (<code className="rounded bg-raised px-1">/movies/tt1375666</code>). Yahan se catalogue test karein,
          sitemap chunks dekhein aur apne play servers manage karein.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
          <Link href="/movies" className="inline-flex items-center gap-1 rounded-full bg-gold px-3 py-1.5 text-white">Open /movies <ExternalLink size={12} /></Link>
          <Link href="/movies/world" className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-dim hover:border-gold hover:text-gold">World catalogue <ExternalLink size={12} /></Link>
          <a href="/sitemap-index.xml" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-dim hover:border-gold hover:text-gold">sitemap-index.xml <ExternalLink size={12} /></a>
          <a href="/sitemaps/movies-0.xml" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-dim hover:border-gold hover:text-gold">movies-0.xml <ExternalLink size={12} /></a>
        </div>
      </header>

      <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-display text-lg font-extrabold text-cream"><Search size={18} className="text-gold" /> Catalogue test</h2>
        <p className="mt-1 text-xs font-semibold text-dim">IMDb id (<code className="rounded bg-raised px-1">tt1375666</code>) ya title likhein — wahi search chalega jo site par chalta hai.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="flex min-w-[260px] flex-1 items-center gap-2 rounded-full border border-line bg-raised px-4 py-2.5">
            <Search size={16} className="text-faint" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') run(q); }}
              placeholder="tt1375666 ya Inception…"
              aria-label="Test IMDb lookup"
              className="w-full bg-transparent text-sm font-semibold text-cream outline-none placeholder:text-faint"
            />
          </label>
          <button type="button" onClick={() => run(q)} className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2.5 text-sm font-extrabold text-white">
            {state === 'loading' ? <LoaderCircle size={15} className="animate-spin" /> : <Sparkles size={15} />} Test
          </button>
        </div>
        <div className="mt-3 text-sm">
          {state === 'loading' && <p className="text-dim">IMDb se jawab ka intezar…</p>}
          {state === 'ok' && <p className="inline-flex items-center gap-1.5 font-bold text-emerald-700"><CheckCircle2 size={15} /> {items.length} titles mile · {ms}ms</p>}
          {state === 'empty' && <p className="inline-flex items-center gap-1.5 font-bold text-amber-700"><TriangleAlert size={15} /> Kuch nahi mila — id check karein ya upstream (Cinemeta) reachable hai ya nahi.</p>}
          {state === 'error' && <p className="inline-flex items-center gap-1.5 font-bold text-rose-700"><TriangleAlert size={15} /> Search route tak nahi pohncha.</p>}
        </div>
        {items.length > 0 && (
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
            {items.map((m) => (
              <li key={m.slug} className="flex items-center gap-3 p-2.5">
                {m.poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.poster} alt="" referrerPolicy="no-referrer" className="h-12 w-9 rounded object-cover" />
                ) : <span className="grid h-12 w-9 place-items-center rounded bg-raised text-gold"><Film size={15} /></span>}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-xs font-extrabold text-cream">{m.title} <span className="text-faint">({m.year})</span></p>
                  <p className="line-clamp-1 text-[0.65rem] font-semibold text-dim">
                    {m.type} · {m.imdbId || '—'} · {m.rating ? `IMDb ${m.rating}` : 'no rating'}
                  </p>
                </div>
                <Link href={`/movies/${m.slug}`} className="text-[0.65rem] font-extrabold text-gold hover:underline">Open</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-3xl border border-line bg-surface p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-display text-lg font-extrabold text-cream"><Server size={18} className="text-gold" /> How the catalogue works now</h2>
        <ul className="mt-2 space-y-1.5 text-sm text-dim">
          <li><strong className="text-cream">Source:</strong> Cinemeta — <code className="rounded bg-raised px-1">v3-cinemeta.strem.io</code> (IMDb data, zero API key).</li>
          <li><strong className="text-cream">Slug:</strong> IMDb id. Koi custom entry, koi manual title nahi.</li>
          <li><strong className="text-cream">Sitemap:</strong> <code className="rounded bg-raised px-1">/sitemap-index.xml</code> → 20,000-URL chunks. 500,000 titles ke liye <code className="rounded bg-raised px-1">npm run imdb:ids</code> chalayein (ya weekly GitHub Action), phir <code className="rounded bg-raised px-1">MOVIES_SITEMAP_LIMIT=500000</code>.</li>
          <li><strong className="text-cream">Player:</strong> neeche play servers — har server <code className="rounded bg-raised px-1">domain/play/{'{imdbid}'}</code> template se link banata hai.</li>
        </ul>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-raised px-3 py-2 text-[0.7rem] font-semibold text-dim">
          <Play size={13} className="text-gold" /> Purani hand-added movies ab site par show nahi hoti — unka data Firestore mein pada reh sakta hai, magar hub use nahi karta.
        </p>
      </section>

      <MovieServersAdmin />
    </div>
  );
}
