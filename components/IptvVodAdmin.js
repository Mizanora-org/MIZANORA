'use client';
import { useCallback, useEffect, useState } from 'react';
import { authClient } from '@/lib/firebase-client';
import { Clapperboard, DownloadCloud, Film, Loader2, Plus, RefreshCw, Save, Sparkles, Trash2, Tv2 } from 'lucide-react';

// Admin > IPTV > Movies & Series (VOD).
// M3U file/link se import (naam mein (2023) ya S01E02 ho to khud pehchanta hai),
// ya haath se movie/series add karein. Save hone par Xtream aur Stalker dono par milti hai.
export default function IptvVodAdmin() {
  const [state, setState] = useState({ loading: true, movies: [], series: [], stats: null });
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('movies');
  const [manual, setManual] = useState({ name: '', url: '', group: '', poster: '' });
  const [showManual, setShowManual] = useState(false);
  const [imdb, setImdb] = useState(null);

  const call = useCallback(async (body, method = 'POST') => {
    const u = authClient().currentUser;
    if (!u) return { ok: false, error: 'Signed out.' };
    const token = await u.getIdToken();
    try {
      const r = await fetch('/api/admin/iptv/vod', {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: method === 'GET' ? undefined : JSON.stringify(body),
      });
      return await r.json().catch(() => ({ ok: false, error: `Server ${r.status}` }));
    } catch (e) { return { ok: false, error: e.message }; }
  }, []);

  const load = useCallback(async () => {
    setBusy('load'); setErr('');
    const j = await call(null, 'GET');
    if (j.ok) setState({ loading: false, movies: j.movies || [], series: j.series || [], stats: j.stats || null });
    else setErr(j.error || 'Load nahi hua.');
    setBusy('');
  }, [call]);

  const loadImdb = useCallback(async () => {
    const u = authClient().currentUser;
    if (!u) return;
    try {
      const token = await u.getIdToken();
      const r = await fetch('/api/admin/iptv/meta', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const j = await r.json();
      if (j.ok) setImdb(j);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); loadImdb(); }, [load, loadImdb]);

  async function fillImdb(kind) {
    setBusy(`imdb:${kind}`); setMsg(''); setErr('');
    const j = await call({ action: 'enrich', kind, limit: 16 });
    setBusy('');
    if (!j.ok) { setErr(j.error || 'IMDb se data nahi aaya.'); return; }
    setMsg(`IMDb se ${j.filled} items bhare (${j.scanned} scanned)${j.done ? ' — sab complete' : ` — ${j.misses.length ? `${j.misses.length} match nahi mile` : 'aur baqi hain'}`}.`);
    load(); loadImdb();
  }

  async function doImport() {
    setBusy('import'); setMsg(''); setErr('');
    const j = await call({ action: 'import', url: url.trim(), text });
    setBusy('');
    if (!j.ok) { setErr(j.error || 'Import nahi hua.'); return; }
    setState((s) => ({ ...s, movies: j.movies || [], series: j.series || [], stats: j.stats }));
    setMsg(`${j.movies?.length || 0} movies, ${j.series?.length || 0} series mile — neeche "Save" dabayein.`);
    setText(''); setUrl('');
  }

  async function save(mode = 'append') {
    setBusy('save'); setMsg(''); setErr('');
    const j = await call({ action: mode, movies: state.movies, series: state.series });
    setBusy('');
    if (!j.ok) { setErr(j.error || 'Save nahi hua.'); return; }
    setMsg(`Save — ${j.stats.movies} movies, ${j.stats.series} series, ${j.stats.episodes} episodes. Clients ko 1 minute mein nazar aayega.`);
    load();
  }

  async function toggle(kind, id) {
    setBusy(id);
    const j = await call({ action: 'toggle', kind, id });
    setBusy('');
    if (j.ok) setState((s) => ({ ...s, [kind]: (kind === 'series' ? s.series : s.movies).map((x) => (x.id === id ? { ...x, off: !x.off } : x)) }));
  }

  async function remove(kind, id) {
    if (!confirm('Yeh item hata dein?')) return;
    setBusy(id);
    const j = await call({ action: 'remove', kind, id });
    setBusy('');
    if (j.ok) { setState((s) => ({ ...s, [kind]: (kind === 'series' ? s.series : s.movies).filter((x) => x.id !== id) })); setMsg('Item hata diya.'); }
  }

  async function addManual() {
    setBusy('manual'); setMsg(''); setErr('');
    const j = await call({ action: 'addMovie', movie: manual });
    setBusy('');
    if (!j.ok) { setErr(j.error || 'Add nahi hua.'); return; }
    setManual({ name: '', url: '', group: '', poster: '' });
    setShowManual(false);
    setMsg(`"${j.movie.name}" movie list mein add ho gayi.`);
    load();
  }

  async function clearAll() {
    if (!confirm('Saari movies aur series hata dein? Channels par asar nahi hoga.')) return;
    setBusy('clear');
    const j = await call({ action: 'clear' });
    setBusy('');
    if (j.ok) { setState({ loading: false, movies: [], series: [], stats: { movies: 0, series: 0, episodes: 0 } }); setMsg('VOD khali.'); }
  }

  const st = state.stats || { movies: state.movies.length, series: state.series.length, episodes: 0 };

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-bold"><Clapperboard size={16} className="text-gold" /> Movies &amp; series</h2>
          <p className="text-xs text-dim">Xtream (Movies / Series tabs) aur Stalker (VOD) dono isi list se chalte hain.</p>
        </div>
        <span className="rounded-full border border-line bg-raised px-2.5 py-1 text-[11px] font-bold text-dim">
          {st.movies || 0} movies · {st.series || 0} series · {st.episodes || 0} episodes
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="M3U link — movies/series wali playlist" />
        <button type="button" className="btn-ghost" onClick={doImport} disabled={!!busy || (!url.trim() && !text.trim())}>
          {busy === 'import' ? <Loader2 size={14} className="animate-spin" /> : <DownloadCloud size={14} />} Import
        </button>
      </div>
      <textarea
        className="input min-h-[84px] font-mono text-[11px]"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'Ya M3U paste karein:\n#EXTINF:-1 group-title="Movies" tvg-logo="...",Film Name (2024)\nhttps://.../film.mp4\n#EXTINF:-1 group-title="Series",Show Name S01E02\nhttps://.../ep2.mkv'}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-gold" onClick={() => save('append')} disabled={!!busy || (!state.movies.length && !state.series.length)}>
          {busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save (add karke)
        </button>
        <button type="button" className="btn-ghost" onClick={() => save('save')} disabled={!!busy || (!state.movies.length && !state.series.length)}>
          <RefreshCw size={14} /> Replace all
        </button>
        <button type="button" className="btn-ghost" onClick={() => setShowManual((v) => !v)}>
          <Plus size={14} /> Manual movie
        </button>
        <button type="button" className="btn-ghost" onClick={clearAll} disabled={!!busy || (!state.movies.length && !state.series.length)}>
          <Trash2 size={14} /> Clear VOD
        </button>
        <button type="button" className="btn-ghost" onClick={() => fillImdb('movies')} disabled={!!busy || !state.movies.length}>
          {busy === 'imdb:movies' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} IMDb — movies
        </button>
        <button type="button" className="btn-ghost" onClick={() => fillImdb('series')} disabled={!!busy || !state.series.length}>
          {busy === 'imdb:series' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} IMDb — series
        </button>
      </div>

      {showManual && (
        <div className="grid gap-2 rounded-xl border border-line bg-raised p-3 sm:grid-cols-2">
          <input className="input" placeholder="Movie ka naam" value={manual.name} onChange={(e) => setManual((m) => ({ ...m, name: e.target.value }))} />
          <input className="input" placeholder="Stream link (mp4/mkv/m3u8)" value={manual.url} onChange={(e) => setManual((m) => ({ ...m, url: e.target.value }))} />
          <input className="input" placeholder="Category (e.g. Action)" value={manual.group} onChange={(e) => setManual((m) => ({ ...m, group: e.target.value }))} />
          <input className="input" placeholder="Poster link (optional)" value={manual.poster} onChange={(e) => setManual((m) => ({ ...m, poster: e.target.value }))} />
          <button type="button" className="btn-gold sm:col-span-2" onClick={addManual} disabled={busy === 'manual' || !manual.name.trim() || !manual.url.trim()}>
            {busy === 'manual' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add movie
          </button>
        </div>
      )}

      {imdb && (
        <p className="text-[11px] text-faint">
          IMDb metadata: {imdb.missing?.movies || 0} movies / {imdb.missing?.series || 0} series adhoori — poster, rating, plot, cast IMDb (Cinemeta) se aata hai.
        </p>
      )}
      {msg && <p className="rounded-xl border border-gold/30 bg-gold/[0.06] px-3 py-2 text-xs font-semibold text-gold">{msg}</p>}
      {err && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{err}</p>}
      {state.loading && <p className="flex items-center gap-2 text-xs text-dim"><Loader2 size={13} className="animate-spin" /> Load ho raha hai…</p>}

      <div className="flex gap-2">
        {[['movies', 'Movies', Film], ['series', 'Series', Tv2]].map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold ${tab === id ? 'border-gold/40 bg-gold/[0.08] text-gold' : 'border-line bg-surface text-dim'}`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {tab === 'movies' && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-faint">
              <tr><th className="py-1">Movie</th><th>Category</th><th>Year</th><th>Type</th><th /></tr>
            </thead>
            <tbody>
              {state.movies.slice(0, 40).map((m) => (
                <tr key={m.id} className={`border-t border-line/60 ${m.off ? 'opacity-50' : ''}`}>
                  <td className="max-w-[14rem] truncate py-1.5 font-semibold text-cream">{m.name}</td>
                  <td className="text-xs text-dim">{m.group}</td>
                  <td className="text-xs tabular-nums text-dim">{m.year || '—'}</td>
                  <td className="text-xs text-dim">{m.ext}</td>
                  <td className="text-right">
                    <button type="button" className="btn-ghost !px-2 !py-1 text-[11px]" onClick={() => toggle('movies', m.id)}>{m.off ? 'ON' : 'OFF'}</button>
                    <button type="button" className="ml-1 text-faint hover:text-red-600" onClick={() => remove('movies', m.id)} aria-label="Remove"><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
              {!state.movies.length && <tr><td colSpan={5} className="py-3 text-xs text-faint">Abhi koi movie nahi — import karein ya manual add karein.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'series' && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] text-left text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-faint">
              <tr><th className="py-1">Series</th><th>Category</th><th>Seasons</th><th>Episodes</th><th /></tr>
            </thead>
            <tbody>
              {state.series.slice(0, 40).map((s) => (
                <tr key={s.id} className={`border-t border-line/60 ${s.off ? 'opacity-50' : ''}`}>
                  <td className="max-w-[14rem] truncate py-1.5 font-semibold text-cream">{s.name}</td>
                  <td className="text-xs text-dim">{s.group}</td>
                  <td className="text-xs tabular-nums text-dim">{s.seasons.length}</td>
                  <td className="text-xs tabular-nums text-dim">{s.seasons.reduce((n, x) => n + x.episodes.length, 0)}</td>
                  <td className="text-right">
                    <button type="button" className="btn-ghost !px-2 !py-1 text-[11px]" onClick={() => toggle('series', s.id)}>{s.off ? 'ON' : 'OFF'}</button>
                    <button type="button" className="ml-1 text-faint hover:text-red-600" onClick={() => remove('series', s.id)} aria-label="Remove"><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
              {!state.series.length && <tr><td colSpan={5} className="py-3 text-xs text-faint">Abhi koi series nahi — import karein (naam mein S01E02 ho).</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
