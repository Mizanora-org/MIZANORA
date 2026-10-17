'use client';
import { useEffect, useRef, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { dbClient } from '@/lib/firebase-client';
import { revalidateSite } from '@/lib/admin-cache';
import { APP_MUSIC_DEFAULT, cleanAppMusic } from '@/lib/appMusic';
import { REEL_MUSIC_DEFAULT, cleanReelMusic } from '@/lib/reelMusic';

// ---------------------------------------------------------------------------------------------
// The two music cards of the admin panel (Admin > Music).
//
// Both do the same job: the admin pastes a direct audio link, the panel checks it, and the shop
// starts using it. The difference is WHERE the music plays:
//   * AppMusicCard   -> the whole app (home, products, cart, blog, ...) plays it in the background
//   * ReelsMusicCard -> only behind the reels that have no sound of their own
//
// The saving rules live in lib/appMusic.js and lib/reelMusic.js (the same code the server uses),
// so what the admin sees is exactly what the shop will play.
// ---------------------------------------------------------------------------------------------

/** A little "Test play" player with a stop button and a note when the file cannot be played. */
function TestPlayer({ url, volume }) {
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef(null);

  useEffect(() => () => { if (ref.current) { ref.current.pause(); ref.current = null; } }, []);

  const stop = () => { if (ref.current) { ref.current.pause(); ref.current = null; } setPlaying(false); };
  const play = () => {
    if (!url) { setError('Paste a music link first.'); return; }
    stop();
    setError('');
    const a = new Audio(url);
    a.volume = Math.min(1, Math.max(0, (Number(volume) || 0) / 100));
    a.onended = () => setPlaying(false);
    a.onerror = () => { setError('The browser could not play this link. Check that it is a direct audio file link (not a web page).'); setPlaying(false); };
    ref.current = a;
    const p = a.play();
    if (p && p.catch) p.catch(() => { setError('The browser refused to play this link. It may be blocked or not a direct audio file.'); setPlaying(false); });
    else setPlaying(true);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={play} className="btn-ghost !px-4 !py-2 text-sm">{playing ? 'Play again' : 'Test play'}</button>
      <button type="button" onClick={stop} className="btn-ghost !px-4 !py-2 text-sm" disabled={!playing}>Stop test</button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}

/**
 * The shared form: link, name, volume, on/off switches.
 * `kind` picks the rules ("app" or "reels"), `switches` lists the extra checkboxes to show.
 */
function MusicForm({ kind, defaults, docId, title, intro, linkLabel, linkPlaceholder, switches = [] }) {
  const [cfg, setCfg] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // 'app' -> the whole app, 'reels' -> the reels only
  const clean = kind === 'app' ? cleanAppMusic : cleanReelMusic;

  useEffect(() => {
    let alive = true;
    getDoc(doc(dbClient(), 'siteMeta', docId))
      .then((d) => { if (alive) setCfg({ ...defaults, ...(d.exists() ? d.data() : {}) }); })
      .catch((e) => { if (alive) { setCfg({ ...defaults }); setMsg(e.message); } });
    return () => { alive = false; };
  }, [docId, defaults]);

  if (!cfg) return <p className="card mb-6 text-sm text-dim">Loading music settings...</p>;

  const set = (k) => (e) => setCfg((c) => ({ ...c, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const r = clean(cfg);

  async function save(e) {
    e.preventDefault();
    const res = clean(cfg);
    if (!res.ok) { setMsg(res.error); return; }
    setBusy(true);
    try {
      await setDoc(doc(dbClient(), 'siteMeta', docId), { ...res.value, updatedAtMs: Date.now() });
      setCfg({ ...defaults, ...res.value });
      await revalidateSite();
      setMsg('Saved. The shop is using this music now (it can take a minute to refresh on the phones).');
    } catch (err) { setMsg(err.message); }
    setBusy(false);
  }

  return (
    <form onSubmit={save} className="card mb-6 space-y-3">
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="text-sm text-dim">{intro}</p>
      </div>
      <div>
        <label className="label" htmlFor={`${docId}-url`}>{linkLabel}</label>
        <input id={`${docId}-url`} className="input" value={cfg.url} onChange={set('url')} placeholder={linkPlaceholder} />
        {cfg.url && <p className={`mt-1 text-xs ${r.ok ? 'text-gold' : 'text-red-600'}`}>{r.ok ? `OK${r.value.url !== cfg.url ? ` (converted to: ${r.value.url})` : ''}` : r.error}</p>}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`${docId}-title`}>Name of the music</label>
          <input id={`${docId}-title`} className="input" maxLength={60} value={cfg.title} onChange={set('title')} />
        </div>
        <div>
          <label className="label" htmlFor={`${docId}-volume`}>Volume: {cfg.volume}%</label>
          <input id={`${docId}-volume`} type="range" min="0" max="100" value={cfg.volume} onChange={set('volume')} className="w-full accent-[#0B6B45]" />
        </div>
      </div>
      {switches.length > 0 && (
        <div className="flex flex-wrap gap-4">
          {switches.map((s) => (
            <label key={s.key} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={cfg[s.key] !== false} onChange={set(s.key)} className="h-4 w-4 accent-[#0B6B45]" />
              {s.label}
            </label>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <button className="btn-gold" disabled={busy}>{busy ? 'Saving...' : 'Save music'}</button>
        <button type="button" className="btn-ghost" onClick={() => setCfg((c) => ({ ...c, url: '' }))}>Remove link</button>
      </div>
      <TestPlayer url={r.ok ? r.value.url : ''} volume={cfg.volume} />
      {msg && <p role="status" className="rounded-xl bg-raised p-3 text-sm">{msg}</p>}
    </form>
  );
}

/** The app background music: the whole shop plays it. */
export function AppMusicCard() {
  return (
    <MusicForm
      kind="app"
      docId="appMusic"
      defaults={APP_MUSIC_DEFAULT}
      title="App background music"
      intro="Paste a direct audio link and the whole shop plays it quietly in the background while people browse. Every shopper can switch it off with the music button in the header."
      linkLabel="Music link (direct audio file)"
      linkPlaceholder="https://res.cloudinary.com/.../mizanora-theme.mp3"
      switches={[
        { key: 'enabled', label: 'Music on in the whole app' },
        { key: 'autoplay', label: 'Start by itself (after the first tap)' },
      ]}
    />
  );
}

/** The reels music: plays behind the reels that have no sound of their own. */
export function ReelsMusicCard() {
  return (
    <MusicForm
      kind="reels"
      docId="reelMusic"
      defaults={REEL_MUSIC_DEFAULT}
      title="Reels background music"
      intro="Paste a direct audio link and it plays behind the reels that have NO sound of their own (silent videos). A reel with its own soundtrack keeps its sound and the music stays quiet."
      linkLabel="Music link (direct audio file)"
      linkPlaceholder="https://res.cloudinary.com/.../reels-theme.mp3"
      switches={[{ key: 'enabled', label: 'Music on in the reels' }]}
    />
  );
}
