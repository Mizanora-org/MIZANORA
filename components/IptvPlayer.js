'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronRight, Clock, ExternalLink, Film, Loader2, LogOut, Maximize, Play, Radio, Search, SkipForward, Star, Tv, Volume2, VolumeX, X,
} from 'lucide-react';

// MIZANORA PLAYER — apni line se live/movies/series. Stream gateway se aati hai (asli URL chhupa),
// ad pehle isi video mein chalta hai (skip button ke sath), phir channel.
const enc = (s) => encodeURIComponent(String(s || ''));

export default function IptvPlayer() {
  const [creds, setCreds] = useState(null);
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('live');
  const [group, setGroup] = useState('all');
  const [q, setQ] = useState('');
  const [pickSeries, setPickSeries] = useState(null);
  const [playing, setPlaying] = useState(null);
  const [guide, setGuide] = useState({});
  const [ad, setAd] = useState(null);
  const [skipLeft, setSkipLeft] = useState(0);
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const skipRef = useRef(0);

  const clearHls = useCallback(() => {
    if (hlsRef.current) { try { hlsRef.current.destroy(); } catch { /* ignore */ } hlsRef.current = null; }
  }, []);

  const attach = useCallback(async (url) => {
    const v = videoRef.current;
    if (!v || !url) return;
    clearHls();
    try {
      if (/\.m3u8(\?|$)/i.test(url) && !v.canPlayType('application/vnd.apple.mpegurl')) {
        const Hls = (await import('hls.js')).default;
        if (Hls.isSupported()) {
          const hls = new Hls({ lowLatencyMode: false, maxBufferLength: 20 });
          hls.loadSource(url);
          hls.attachMedia(v);
          hlsRef.current = hls;
          await v.play().catch(() => {});
          return;
        }
      }
      v.src = url;
      await v.play().catch(() => {});
    } catch (e) { setErr(`Player: ${e.message}`); }
  }, [clearHls]);

  const streamPath = useCallback((item) => {
    if (!creds || !item) return '';
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    const kind = item.kind === 'live' ? 'live' : item.kind === 'movie' ? 'movie' : 'series';
    const ext = item.ext || (kind === 'live' ? 'm3u8' : 'mp4');
    return `${base}/${kind}/${enc(creds.username)}/${enc(creds.password)}/${enc(item.id)}.${ext}`;
  }, [creds]);

  const startStream = useCallback(async (item) => {
    const url = streamPath(item);
    if (!url) return;
    await attach(url);
  }, [attach, streamPath]);

  const startAd = useCallback(async (adCfg, item) => {
    setAd(adCfg);
    skipRef.current = Number(adCfg.skipAfter) || 0;
    setSkipLeft(skipRef.current);
    const url = adCfg.prerollUrl;
    if (!url) { setAd(null); await startStream(item); return; }
    const v = videoRef.current;
    if (!v) { setAd(null); await startStream(item); return; }
    clearHls();
    try {
      if (/\.m3u8(\?|$)/i.test(url) && !v.canPlayType('application/vnd.apple.mpegurl')) {
        const Hls = (await import('hls.js')).default;
        if (Hls.isSupported()) {
          const hls = new Hls();
          hls.loadSource(url); hls.attachMedia(v); hlsRef.current = hls;
          hls.on(Hls.Events.ERROR, () => finishAd(item));
          await v.play().catch(() => {});
          return;
        }
      }
      v.src = url;
      await v.play().catch(() => {});
    } catch { finishAd(item); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearHls, startStream]);

  const finishAd = useCallback((item) => {
    setAd(null);
    setSkipLeft(0);
    startStream(item);
  }, [startStream]);

  const play = useCallback(async (item) => {
    setPlaying(item);
    setErr('');
    setAd(null);
    if (item.kind === 'live') {
      try {
        const j = await fetch(`/api/gw/ad?channel=${enc(item.id)}`, { cache: 'no-store' }).then((r) => r.json());
        if (j && j.ad && j.ad.prerollUrl) { await startAd(j.ad, item); return; }
        if (j && j.ad && j.ad.imageUrl) setAd(j.ad);
      } catch { /* ad optional */ }
    }
    await startStream(item);
  }, [startAd, startStream]);

  // Skip countdown
  useEffect(() => {
    if (!ad || !skipLeft) return;
    const t = setTimeout(() => setSkipLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearTimeout(t);
  }, [ad, skipLeft]);

  useEffect(() => () => clearHls(), [clearHls]);

  const login = useCallback(async (username = u, password = p) => {
    setBusy('login'); setErr('');
    try {
      const r = await fetch('/api/gw/me', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const j = await r.json().catch(() => ({ ok: false, error: `Server ${r.status}` }));
      if (!j.ok) { setErr(j.error || 'Login nahi hua.'); setBusy(''); return; }
      setData(j);
      setCreds({ username: j.line.username, password });
      try { sessionStorage.setItem('mz_iptv_creds', JSON.stringify({ username: j.line.username, password })); } catch { /* ignore */ }
      setBusy('');
      fetch(`/api/gw/guide?username=${enc(j.line.username)}&password=${enc(password)}`, { cache: 'no-store' })
        .then((x) => x.json()).then((g) => {
          if (g && g.ok) {
            const map = {};
            for (const c of g.channels) map[c.id] = { now: c.now, next: c.next };
            setGuide(map);
          }
        }).catch(() => {});
    } catch (e) { setErr(e.message); setBusy(''); }
  }, [u, p]);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('mz_iptv_creds') || 'null');
      if (saved && saved.username && saved.password) { setU(saved.username); setP(saved.password); login(saved.username, saved.password); }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function logout() {
    clearHls();
    try { sessionStorage.removeItem('mz_iptv_creds'); } catch { /* ignore */ }
    setCreds(null); setData(null); setPlaying(null); setGuide({}); setAd(null);
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.removeAttribute('src'); }
  }

  if (!creds || !data) {
    return (
      <section className="mx-auto max-w-md">
        <div className="card border-gold/30 bg-gradient-to-b from-[#062b1c] to-[#04150e] text-cream">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold/20"><Tv size={18} className="text-gold" /></span>
            <div>
              <h1 className="font-display text-lg font-black">Mizanora Player</h1>
              <p className="text-[11px] text-cream/60">Apni IPTV line se live, movies aur series</p>
            </div>
          </div>

          <form className="mt-4 space-y-2" onSubmit={(e) => { e.preventDefault(); login(); }}>
            <input className="input !border-white/15 !bg-white/[0.06] !text-cream placeholder:!text-cream/40" placeholder="Username (mz…)" value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" />
            <input className="input !border-white/15 !bg-white/[0.06] !text-cream placeholder:!text-cream/40" placeholder="Password" value={p} onChange={(e) => setP(e.target.value)} type="password" autoComplete="current-password" />
            <button type="submit" className="btn-gold w-full justify-center" disabled={busy === 'login' || !u.trim() || !p.trim()}>
              {busy === 'login' ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />} Watch now
            </button>
          </form>

          {err && <p className="mt-2 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200">{err}</p>}
          <p className="mt-3 text-[11px] leading-relaxed text-cream/50">
            Line nahi hai? <a className="text-gold underline" href="/iptv/start">free trial lein</a> ya{' '}
            <a className="text-gold underline" href="/iptv">plans dekhein</a>. Xtream apps (TiviMate, Smarters) mein bhi yahi username/password chalta hai.
          </p>
        </div>
      </section>
    );
  }

  const isLive = tab === 'live';
  const source = isLive ? data.channels : tab === 'movies' ? data.movies : data.series;
  const term = q.trim().toLowerCase();
  const list = source
    .filter((x) => (group === 'all' || (x.group || 'Other') === group) && (!term || String(x.name).toLowerCase().includes(term)))
    .slice(0, 300);

  const groupsOf = (rows) => [...new Set(rows.map((r) => r.group || 'Other'))].sort();
  const groupList = ['all', ...groupsOf(source)];

  return (
    <div className="grid gap-3 lg:grid-cols-[20rem_1fr]">
      {/* player */}
      <div className="order-2 space-y-2 lg:order-1">
        <div className="relative overflow-hidden rounded-2xl border border-line bg-black">
          <video
            ref={videoRef}
            className="aspect-video w-full bg-black"
            controls={!ad}
            muted={muted}
            playsInline
            onEnded={() => { if (ad && playing) finishAd(playing); }}
          />
          {ad && (
            <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 bg-black/70 px-3 py-1.5 text-[11px] text-cream">
              <span className="flex items-center gap-1.5 font-bold text-gold">AD · {ad.title || 'Advertisement'}</span>
              <div className="flex items-center gap-2">
                {ad.clickUrl && <a href={ad.clickUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-cream/80 underline"><ExternalLink size={11} /> Offer</a>}
                <button
                  type="button"
                  className="rounded-full border border-cream/30 px-2 py-0.5 font-bold disabled:opacity-50"
                  disabled={skipLeft > 0}
                  onClick={() => playing && finishAd(playing)}
                >
                  {skipLeft > 0 ? `Skip ${skipLeft}s` : <span className="flex items-center gap-1"><SkipForward size={11} /> Skip ad</span>}
                </button>
              </div>
            </div>
          )}
          {!playing && (
            <div className="absolute inset-0 grid place-items-center bg-black/55 text-center">
              <div>
                <Tv size={26} className="mx-auto text-gold" />
                <p className="mt-1 text-xs text-cream/70">List se koi channel chunein</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-raised px-3 py-2 text-[11px]">
          <span className="max-w-[16rem] truncate font-bold text-cream">{playing ? playing.name : 'Kuch play nahi ho raha'}</span>
          <span className="flex items-center gap-1.5">
            <button type="button" className="btn-ghost !px-2 !py-1" onClick={() => { const v = videoRef.current; if (v) { v.muted = !v.muted; setMuted(v.muted); } }} aria-label="Mute">
              {muted ? <VolumeX size={13} /> : <Volume2 size={13} />}
            </button>
            <button type="button" className="btn-ghost !px-2 !py-1" onClick={() => videoRef.current?.requestFullscreen?.()} aria-label="Fullscreen"><Maximize size={13} /></button>
            <button type="button" className="btn-ghost !px-2 !py-1" onClick={logout}><LogOut size={13} /> Logout</button>
          </span>
        </div>

        {playing && isLive && guide[playing.id]?.now && (
          <div className="rounded-xl border border-line bg-surface px-3 py-2 text-[11px] text-dim">
            <p className="flex items-center gap-1.5 font-bold text-gold"><Clock size={11} /> Abhi</p>
            <p className="truncate text-cream">{guide[playing.id].now.title}</p>
            {guide[playing.id].next && <p className="truncate text-faint">Agla: {guide[playing.id].next.title}</p>}
          </div>
        )}
        {err && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{err}</p>}
      </div>

      {/* browse */}
      <div className="order-1 space-y-2 lg:order-2">
        <div className="flex flex-wrap items-center gap-2">
          {[['live', 'Live TV', Radio], ['movies', 'Movies', Film], ['series', 'Series', Tv]].map(([id, label, Icon]) => (
            <button key={id} type="button" onClick={() => { setTab(id); setGroup('all'); setQ(''); setPickSeries(null); }}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold ${tab === id ? 'border-gold/40 bg-gold/[0.08] text-gold' : 'border-line bg-surface text-dim'}`}>
              <Icon size={13} /> {label}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-faint">{data.line.username} · {data.line.devices}/{data.line.maxDevices} device</span>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input className="input pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder={isLive ? 'Channel search…' : 'Naam search…'} />
          </div>
          <button type="button" className="btn-ghost" onClick={() => { setQ(''); setGroup('all'); }}><X size={13} /> Clear</button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {groupList.slice(0, 24).map((g) => (
            <button key={g} type="button" onClick={() => setGroup(g)}
              className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-bold ${group === g ? 'border-gold/50 bg-gold/[0.1] text-gold' : 'border-line bg-surface text-dim'}`}>
              {g === 'all' ? 'All' : g}
            </button>
          ))}
        </div>

        {tab === 'series' && pickSeries ? (
          <div className="space-y-2 rounded-xl border border-line bg-surface p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-cream">{pickSeries.name}</p>
              <button type="button" className="text-faint" onClick={() => setPickSeries(null)}><X size={14} /></button>
            </div>
            {pickSeries.seasons.map((s) => (
              <div key={s.n}>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-faint">Season {s.n}</p>
                <div className="mt-1 grid gap-1 sm:grid-cols-2">
                  {s.episodes.map((e) => (
                    <button key={e.n} type="button"
                      onClick={() => play({ kind: 'series', id: `${pickSeries.id}-${s.n}-${e.n}`, name: `${pickSeries.name} S${s.n}E${e.n}`, ext: e.ext })}
                      className="flex items-center justify-between gap-2 rounded-lg border border-line bg-raised px-2 py-1 text-left text-[11px] text-dim hover:border-gold/40">
                      <span className="truncate">E{e.n} {e.title}</span><Play size={11} className="shrink-0 text-gold" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="max-h-[30rem] space-y-1 overflow-y-auto rounded-xl border border-line bg-surface p-1.5">
            {list.map((item) => {
              const poster = tab === 'live' ? item.logo : item.poster;
              const active = playing && playing.id === item.id;
              const liveEpg = isLive ? guide[item.id] : null;
              return (
                <button key={item.id} type="button"
                  onClick={() => {
                    if (tab === 'series') { setPickSeries(item); return; }
                    play({ kind: tab === 'live' ? 'live' : 'movie', id: item.id, name: item.name, ext: item.ext || (tab === 'live' ? 'm3u8' : 'mp4') });
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left ${active ? 'border-gold/50 bg-gold/[0.08]' : 'border-transparent hover:border-line hover:bg-raised'}`}>
                  <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded bg-raised">
                    {poster ? <img src={poster} alt="" className="h-full w-full object-cover" loading="lazy" /> : <Tv size={12} className="text-faint" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-cream">{item.name}</span>
                    <span className="block truncate text-[10px] text-faint">
                      {isLive ? (liveEpg?.now?.title || item.group || 'Live') : (item.year ? `${item.year} · ` : '') + (item.group || '')}
                    </span>
                  </span>
                  {item.rating > 0 && <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-gold"><Star size={9} /> {item.rating}</span>}
                  <ChevronRight size={13} className="shrink-0 text-faint" />
                </button>
              );
            })}
            {!list.length && <p className="p-3 text-xs text-faint">Kuch nahi mila — search ya group badal kar dekhein.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
