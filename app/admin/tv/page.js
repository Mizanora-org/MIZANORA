'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Trash2, Tv, Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import { authClient } from '@/lib/firebase-client';
import { MAX_CHANNELS, MAX_TV_SOURCES, TV_DEFAULT, TV_THEMES, channelGroups, channelSources, cleanTv, parseM3U, TV_PRESETS } from '@/lib/liveTv';
import XtreamImport from '@/components/XtreamImport';
import TvBulkTools from '@/components/TvBulkTools';

// Admin > Live TV: load channels (M3U file, M3U link, pasted text or one by one) and choose the
// PRODUCTS whose ad plays while the visitor switches channel.
//
// v38: built for a big list. The channels are no longer kept inside the Firestore setting
// document (1 MB limit): Save splits them into shards at siteMeta/liveTv/channels/p0, p1, ...
// so the shop can hold 100,000 of them. Loading and saving go through /api/admin/tv/config,
// which also re-validates every link server-side - the browser can no longer be the only check.
// The list below is paged, because rendering 100,000 rows would freeze the tab.
const PAGE_SIZE = 50;

const Switch = ({ label, hint, checked, onChange }) => (
  <label className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3 text-sm">
    <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#0B6B45]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span><b className="block text-cream">{label}</b>{hint && <small className="text-dim">{hint}</small>}</span>
  </label>
);

export default function AdminTv() {
  const [cfg, setCfg] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [link, setLink] = useState('');
  const [paste, setPaste] = useState('');
  const [find, setFind] = useState('');
  const [one, setOne] = useState({ name: '', url: '', group: '' });
  const [pq, setPq] = useState('');
  const [hits, setHits] = useState([]);
  const [page, setPage] = useState(0);
  const [health, setHealth] = useState({}); // url -> { ok, reason, ms }
  const [prog, setProg] = useState(null); // { done, total, dead }
  const [selected, setSelected] = useState(() => new Set());
  const [parts, setParts] = useState(0);
  const [loadErr, setLoadErr] = useState('');   // why the list could not be read
  const [expected, setExpected] = useState(0);  // how many channels the DATABASE says it holds

  // The sign-in token. Never throws: a missing or expired session comes back as null and the
  // caller shows a message instead of dying inside a template literal.
  const token = useCallback(async () => {
    try {
      const u = authClient().currentUser;
      return u ? await u.getIdToken() : null;
    } catch (_) { return null; }
  }, []);

  const call = useCallback(async (body) => {
    const t = await token();
    if (!t) return { ok: false, error: 'You are signed out. Reload the page and sign in again.' };
    try {
      const r = await fetch('/api/admin/tv/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify(body),
      });
      return await r.json().catch(() => ({ ok: false, error: `The server answered ${r.status}.` }));
    } catch (e) {
      return { ok: false, error: `Could not reach the server: ${e.message}` };
    }
  }, [token]);

  // v39: load() used to have NO try/catch. Any rejection - a dropped connection, a signed-out
  // session - left `cfg` null, and the page sat on "Loading..." forever with no message and no
  // way out. It now always lands somewhere: real data, an error with a Try again button, or an
  // empty setting. It can never hang.
  const load = useCallback(async () => {
    setBusy('load');
    let j;
    try {
      j = await call({ action: 'load' });
    } catch (e) {
      j = { ok: false, error: e.message || 'unknown error' };
    }
    if (j.ok) {
      setCfg(j.cfg || { ...TV_DEFAULT });
      setParts(j.cfg && j.cfg.parts ? j.cfg.parts : 0);
      setExpected(j.recorded != null ? Number(j.recorded) || 0 : (j.cfg && Number(j.cfg.count)) || 0);
      setSelected(new Set());
      setPage(0);
      if (!j.legacy && Number(j.recorded) > (j.cfg?.channels || []).length) {
        const loaded = (j.cfg?.channels || []).length;
        setLoadErr(`The database says it holds ${Number(j.recorded).toLocaleString('en-PK')} channels, but ${loaded ? `only ${loaded.toLocaleString('en-PK')}` : 'none'} came back. Do NOT press Save until this is sorted - saving an incomplete list would delete channels.`);
      } else {
        setLoadErr('');
      }
    } else {
      setCfg((c) => c || { ...TV_DEFAULT });
      setLoadErr(`Could not read the setting: ${j.error || 'unknown error'}`);
    }
    setBusy('');
  }, [call]);

  useEffect(() => { load(); }, [load]);

  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));
  const setAds = (k, v) => setCfg((c) => ({ ...c, ads: { ...c.ads, [k]: v } }));
  const setChannels = (list) => { setCfg((c) => ({ ...c, channels: list })); setSelected(new Set()); setPage(0); };

  // Search runs over name + group + link. It is the scope the bulk tools call "Search".
  const filtered = useMemo(() => {
    if (!cfg) return [];
    const q = find.trim().toLowerCase();
    if (!q) return cfg.channels.map((c, i) => ({ ...c, i }));
    return cfg.channels.map((c, i) => ({ ...c, i })).filter((c) => `${c.name} ${c.group} ${c.url}`.toLowerCase().includes(q));
  }, [cfg, find]);

  const groups = useMemo(() => (cfg ? channelGroups(cfg.channels, 60) : []), [cfg]);
  const deadIndexes = useMemo(() => (cfg?.channels || []).map((c, i) => {
    const urls = channelSources(c);
    return urls.length > 0 && urls.every((url) => health[url] && !health[url].ok) ? i : -1;
  }).filter((i) => i >= 0), [cfg, health]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  if (!cfg) return <p className="p-6 text-dim">Loading...</p>;

  const patch = (i, part) => setCfg((c) => { const next = c.channels.slice(); next[i] = { ...next[i], ...part }; return { ...c, channels: next }; });
  const drop = (i) => { setCfg((c) => ({ ...c, channels: c.channels.filter((_, k) => k !== i) })); setSelected((s) => { const n = new Set(); s.forEach((x) => { if (x !== i) n.add(x > i ? x - 1 : x); }); return n; }); };
  const move = (i, d) => setCfg((c) => { const j = i + d; if (j < 0 || j >= c.channels.length) return c; const next = c.channels.slice(); [next[i], next[j]] = [next[j], next[i]]; return { ...c, channels: next }; });
  const toggleSel = (i) => setSelected((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const selAllOnPage = () => setSelected((s) => { const n = new Set(s); const allOn = rows.every((r) => n.has(r.i)); rows.forEach((r) => (allOn ? n.delete(r.i) : n.add(r.i))); return n; });
  const selAllFiltered = () => setSelected((s) => (s.size === filtered.length && filtered.length ? new Set() : new Set(filtered.map((c) => c.i))));

  const merge = (incoming, skipped = 0, what = 'playlist') => {
    const have = new Set(cfg.channels.map((c) => c.url));
    const unique = [];
    for (const c of incoming) {
      if (!c || !c.url || have.has(c.url)) continue;
      have.add(c.url);
      unique.push(c);
    }
    const room = Math.max(0, MAX_CHANNELS - cfg.channels.length);
    const fresh = unique.slice(0, room);
    const ignored = unique.length - fresh.length;
    const all = [...cfg.channels, ...fresh];
    setCfg((c) => ({ ...c, channels: all }));
    setMsg(`${fresh.length.toLocaleString('en-PK')} new channel${fresh.length === 1 ? '' : 's'} added from the ${what}${ignored ? `, ${ignored.toLocaleString('en-PK')} duplicate${room ? ' or over the limit' : ' (no room left)'}` : ''}${skipped ? `, ${skipped.toLocaleString('en-PK')} skipped (not a stream link)` : ''}. ${all.length >= MAX_CHANNELS ? `Limit ${MAX_CHANNELS.toLocaleString('en-PK')} reached. ` : ''}Press Save to publish.`);
  };

  const fromFile = async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) { setMsg('That file is bigger than 25 MB. Split it, or load it from a link instead.'); return; }
    const t = await f.text();
    const r = parseM3U(t);
    if (!r.channels.length) { setMsg(`No usable channel found. Stream links must start with http:// or https://${r.skipped ? ` (${r.skipped} lines were skipped)` : ''}.`); return; }
    merge(r.channels, r.skipped, 'file');
  };
  const fromText = () => { const r = parseM3U(paste); if (!r.channels.length) { setMsg('No usable channel found in the pasted text.'); return; } merge(r.channels, r.skipped, 'pasted text'); setPaste(''); };
  const fromLink = async () => {
    setBusy('link'); setMsg('');
    try {
      const r = await fetch('/api/admin/tv-import', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await authClient().currentUser.getIdToken()}` }, body: JSON.stringify({ url: link }) });
      const j = await r.json().catch(() => ({}));
      if (!j.ok || !j.channels) { setMsg(j.error || 'That link did not give a playlist.'); return; }
      merge(j.channels, j.skipped || 0, 'link');
      setLink('');
    } catch (err) { setMsg(`Could not load: ${err.message}`); }
    finally { setBusy(''); }
  };
  const addOne = () => {
    const c = { name: one.name.trim(), url: one.url.trim(), group: one.group.trim(), logo: '', sources: [], off: false };
    if (!c.name || !/^https?:\/\/\S+$/i.test(c.url)) { setMsg('A channel needs a name and a link that starts with http:// or https://.'); return; }
    if (cfg.channels.some((x) => x.url === c.url)) { setMsg('That link is already in the list.'); return; }
    setCfg((s) => ({ ...s, channels: [...s.channels, c] }));
    setOne({ name: '', url: '', group: '' });
    setMsg('Channel added. Press Save to publish.');
  };

  const searchProducts = async () => {
    setBusy('search');
    try { const r = await fetch(`/api/search?q=${encodeURIComponent(pq.trim())}`); const j = await r.json(); setHits((j.items || j.products || []).slice(0, 12)); } catch { setHits([]); }
    setBusy('');
  };
  const addAd = (slug) => { if (!slug || cfg.ads.slugs.includes(slug)) return; setAds('slugs', [...cfg.ads.slugs, slug].slice(0, 30)); };

  const allSourcesDead = (c) => { const urls = channelSources(c); return urls.length > 0 && urls.every((url) => health[url] && !health[url].ok); };
  const deadCount = deadIndexes.length;

  const checkAll = async () => {
    setBusy('check'); setProg({ done: 0, total: cfg.channels.length, dead: 0 }); setMsg('');
    const urls = [...new Set(cfg.channels.flatMap((c) => channelSources(c)))];
    const authToken = await token();
    if (!authToken) { setBusy(''); setMsg('You are signed out. Reload the page and sign in again.'); return; }
    const out = {};
    let dead = 0;
    for (let i = 0; i < urls.length; i += 12) {
      const part = urls.slice(i, i + 12);
      try {
        const r = await fetch('/api/admin/tv-check', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` }, body: JSON.stringify({ urls: part }) });
        const j = await r.json().catch(() => ({}));
        Object.assign(out, j.results || {});
      } catch { /* a failed batch simply stays unknown */ }
      setProg({ done: Math.min(i + 12, urls.length), total: urls.length, dead });
    }
    setHealth(out);
    dead = cfg.channels.filter((c) => { const sources = channelSources(c); return sources.length > 0 && sources.every((url) => out[url] && !out[url].ok); }).length;
    setProg({ done: urls.length, total: urls.length, dead });
    setBusy('');
    setMsg(`${urls.length.toLocaleString('en-PK')} links checked, ${dead.toLocaleString('en-PK')} channel${dead === 1 ? '' : 's'} with nothing working.`);
  };
  const switchOffDead = () => { const s = new Set(deadIndexes); setCfg((c) => ({ ...c, channels: c.channels.map((ch, i) => (s.has(i) ? { ...ch, off: true } : ch)) })); setMsg(`${deadCount.toLocaleString('en-PK')} channels with no working source switched off. Press Save to publish.`); };
  const bestResult = (c) => channelSources(c).map((url) => health[url]).filter((h) => h && h.ok).sort((a, b) => (a.ms || 0) - (b.ms || 0))[0];
  const sortFast = () => {
    const rank = (c) => (c.off ? 3 : bestResult(c) ? 0 : allSourcesDead(c) ? 2 : 1);
    setCfg((c) => ({ ...c, channels: c.channels.map((ch, i) => ({ c: ch, i })).sort((a, b) => rank(a.c) - rank(b.c) || ((bestResult(a.c) || {}).ms || 0) - ((bestResult(b.c) || {}).ms || 0) || a.i - b.i).map((x) => x.c) }));
    setMsg('Working channels moved to the top. Press Save.');
  };

  async function save() {
    if (loadErr || busy === 'load') { setMsg('Cannot save until the existing TV settings have loaded successfully. Please try again.'); return; }
    setBusy('save'); setMsg('');
    // v39: the one mistake that cannot be undone. If the database remembers more channels than
    // this page is showing, the page may simply have failed to read the shards - and saving now
    // would overwrite them with an empty list. Ask first.
    // Only ask when the shortfall looks like a FAILED READ, not a deliberate edit: deleting a
    // handful of channels is normal, losing the whole list is not.
    const missing = expected - cfg.channels.length;
    const looksBroken = cfg.channels.length === 0 ? missing > 0 : missing > Math.max(20, expected * 0.5);
    if (looksBroken) {
      const go = window.confirm(
        `The database holds ${expected.toLocaleString('en-PK')} channels, but this page is showing ${cfg.channels.length.toLocaleString('en-PK')}.\n\n`
        + `Saving now would delete ${missing.toLocaleString('en-PK')} channel${missing === 1 ? '' : 's'} for good.\n\n`
        + 'Press "Try again" first if you did not mean to remove them. Save anyway?',
      );
      if (!go) { setBusy(''); setMsg('Save cancelled. Nothing was changed.'); return; }
    }
    try {
      const j = await call({ action: 'save', cfg });
      if (!j.ok) { setMsg(`Could not save: ${j.error}`); setBusy(''); return; }
      setCfg(j.cfg);
      setParts(j.parts || 0);
      setExpected(j.count || 0);
      setLoadErr('');
      setMsg(j.message || `Saved ${j.count} channels.`);
    } catch (e) { setMsg(`Could not save: ${e.message}`); }
    setBusy('');
  }

  async function clearAllChannels() {
    if (!window.confirm('Delete EVERY channel from the database? The settings and the ads are kept.')) return;
    setBusy('clear'); setMsg('');
    const j = await call({ action: 'clear' });
    if (!j.ok) { setMsg(`Could not clear: ${j.error}`); setBusy(''); return; }
    setCfg((c) => ({ ...c, channels: [] }));
    setSelected(new Set());
    setParts(0);
    setExpected(0);
    setLoadErr('');
    setMsg(j.message || 'All channels deleted.');
    setBusy('');
  }

  const onCount = cfg.channels.filter((c) => !c.off).length;

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="flex items-center gap-2 text-2xl font-extrabold"><Tv size={24} /> Live TV</h1><p className="text-sm text-dim">Channels from an M3U playlist, an Xtream Codes panel or one by one — plus the product ads shown while the visitor switches channel.</p></div>
        <div className="flex gap-2"><Link href="/live" target="_blank" className="btn-ghost">Open /live</Link><button type="button" className="btn-gold" disabled={busy === 'save' || busy === 'load' || !!loadErr} onClick={save}>{busy === 'save' ? 'Saving...' : 'Save'}</button></div>
      </header>
      {msg && <p role="status" className="rounded-xl bg-raised p-3 text-sm font-semibold text-gold">{msg}</p>}
      {loadErr && (
        <p role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-red-500/50 bg-red-50 p-3 text-sm text-red-800">
          <span className="min-w-0 flex-1">{loadErr}</span>
          <button type="button" className="btn-ghost !py-1.5" disabled={busy === 'load'} onClick={load}>{busy === 'load' ? 'Trying...' : 'Try again'}</button>
        </p>
      )}
      {!loadErr && expected > 0 && cfg.channels.length === 0 && (
        <p role="alert" className="rounded-xl border-2 border-amber-500 bg-amber-50 p-3 text-sm text-amber-900">
          This list is empty, but the database recorded {expected.toLocaleString('en-PK')} channels at the last save. Pressing Save now would delete them. Use <b>Try again</b> first; only press Save if you really mean to wipe the list.
        </p>
      )}

      <p className="flex flex-wrap gap-x-4 gap-y-1 rounded-xl bg-raised p-3 text-sm">
        <span><b className="text-cream">{cfg.channels.length.toLocaleString('en-PK')}</b> channels</span>
        <span><b className="text-cream">{onCount.toLocaleString('en-PK')}</b> switched on</span>
        <span><b className="text-cream">{groups.length}</b> groups</span>
        <span><b className="text-cream">{parts}</b> shard{parts === 1 ? '' : 's'} in the database</span>
        <span className="text-dim">room for {(MAX_CHANNELS - cfg.channels.length).toLocaleString('en-PK')} more</span>
      </p>

      <section className="card space-y-3">
        <h2 className="text-lg font-extrabold">1. Settings</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Switch label="Live TV is ON" hint="Off: the /live page says it is not available." checked={cfg.enabled} onChange={(v) => set('enabled', v)} />
          <Switch label="Start playing by itself" hint="The browser still needs one touch before sound." checked={cfg.autoplay} onChange={(v) => set('autoplay', v)} />
          <label className="block text-sm"><span className="label">Default TV theme (visitors may change it)</span><select className="input" value={cfg.theme || 'cinema'} onChange={(e) => set('theme', e.target.value)}>{TV_THEMES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label className="block text-sm"><span className="label">Title</span><input className="input" maxLength={60} value={cfg.title} onChange={(e) => set('title', e.target.value)} /></label>
          <label className="block text-sm"><span className="label">Short note under the player (optional)</span><input className="input" maxLength={160} value={cfg.note} onChange={(e) => set('note', e.target.value)} /></label>
        </div>
        <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Add only streams you have the right to show: your own, or channels whose owner allows it. You are responsible for what you add. <b>http://</b> streams play through the shop&apos;s relay, which uses your Vercel bandwidth — so keep the list to channels people really watch. Use <b>Check all channels</b> to switch off the dead ones.</p>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-extrabold">2. Add channels ({cfg.channels.length.toLocaleString('en-PK')}/{MAX_CHANNELS.toLocaleString('en-PK')})</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm"><span className="label">Upload an M3U / M3U8 file (up to 25 MB)</span><input type="file" accept=".m3u,.m3u8,.txt,audio/x-mpegurl,application/vnd.apple.mpegurl" className="input" onChange={fromFile} /></label>
          <div className="text-sm"><span className="label">Quick lists (public iptv-org playlists): tap one, then press Load</span><div className="mb-2 flex flex-wrap gap-1.5">{TV_PRESETS.map(([n, u]) => <button key={u} type="button" className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold hover:border-gold" onClick={() => setLink(u)}>{n}</button>)}</div></div>
          <div className="text-sm"><span className="label">Or an M3U link (https)</span><div className="flex gap-2"><input className="input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://.../playlist.m3u" /><button type="button" className="btn-ghost" disabled={busy === 'link' || !link} onClick={fromLink}>{busy === 'link' ? '...' : 'Load'}</button></div></div>
        </div>
        <label className="block text-sm"><span className="label">Or paste the playlist text</span><textarea className="input font-mono text-xs" rows={3} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'#EXTM3U\n#EXTINF:-1 group-title="News",My Channel\nhttps://example.com/live.m3u8'} /></label>
        {paste && <button type="button" className="btn-ghost" onClick={fromText}>Add from pasted text</button>}

        <div className="mt-3">
          {!loadErr && busy !== 'load' && <XtreamImport
            max={MAX_CHANNELS}
            used={cfg.channels.length}
            onReload={load}
            onChannels={(incoming) => {
              const have = new Set(cfg.channels.map((c) => c.url));
              const fresh = new Set();
              for (const c of incoming) if (c && c.url && !have.has(c.url)) { have.add(c.url); fresh.add(c.url); }
              const room = Math.max(0, MAX_CHANNELS - cfg.channels.length);
              merge(incoming, 0, 'Xtream panel');
              return Math.min(fresh.size, room);
            }}
          />}
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_2fr_1fr_auto]">
          <input className="input" placeholder="Channel name" value={one.name} onChange={(e) => setOne({ ...one, name: e.target.value })} />
          <input className="input" placeholder="https://... .m3u8 / YouTube live link" value={one.url} onChange={(e) => setOne({ ...one, url: e.target.value })} />
          <input className="input" placeholder="Group (optional)" value={one.group} onChange={(e) => setOne({ ...one, group: e.target.value })} />
          <button type="button" className="btn-ghost" onClick={addOne}>Add one</button>
        </div>
      </section>

      <TvBulkTools
        channels={cfg.channels}
        filtered={filtered}
        selected={selected}
        setChannels={setChannels}
        setMsg={setMsg}
        deadCount={deadCount}
        deadIndexes={deadIndexes}
        groups={groups}
      />

      <section className="card space-y-3">
        <h2 className="text-lg font-extrabold">4. Ads between channels</h2>
        <p className="text-xs text-dim">When a visitor presses Next, Previous or picks a channel, the chosen products play as a short ad while the new channel loads. Price and photo come from the shop itself.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Switch label="Show product ads" checked={cfg.ads.enabled} onChange={(v) => setAds('enabled', v)} />
          <Switch label="Also show one when the TV opens" checked={cfg.ads.onStart} onChange={(v) => setAds('onStart', v)} />
          <label className="block text-sm"><span className="label">Ad length (seconds, 3 to 20)</span><input type="number" min={3} max={20} className="input" value={cfg.ads.seconds} onChange={(e) => setAds('seconds', e.target.value)} /></label>
          <label className="block text-sm"><span className="label">Visitor may skip after (seconds, 0 = at once)</span><input type="number" min={0} max={10} className="input" value={cfg.ads.skipAfter} onChange={(e) => setAds('skipAfter', e.target.value)} /></label>
        </div>
        <div className="flex gap-2"><input className="input" value={pq} onChange={(e) => setPq(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && searchProducts()} placeholder="Search a product to advertise" /><button type="button" className="btn-ghost" onClick={searchProducts} disabled={busy === 'search'}>Search</button></div>
        {hits.length > 0 && <ul className="max-h-56 space-y-1 overflow-auto rounded-xl border border-line p-2 text-sm">{hits.map((h) => { const slug = h.slug || h.id; return <li key={slug} className="flex items-center justify-between gap-2"><span className="min-w-0 truncate">{h.name}</span><button type="button" className="btn-ghost shrink-0 !px-3 !py-1" onClick={() => addAd(slug)} disabled={cfg.ads.slugs.includes(slug)}>{cfg.ads.slugs.includes(slug) ? 'Added' : 'Add as ad'}</button></li>; })}</ul>}
        <div className="flex flex-wrap gap-2">{cfg.ads.slugs.map((s) => <span key={s} className="inline-flex items-center gap-1 rounded-full bg-raised px-3 py-1 text-xs font-semibold">{s}<button type="button" aria-label="Remove" onClick={() => setAds('slugs', cfg.ads.slugs.filter((x) => x !== s))}><Trash2 size={12} /></button></span>)}{!cfg.ads.slugs.length && <span className="text-xs text-dim">No product chosen yet: no ad plays.</span>}</div>
        <label className="block text-sm"><span className="label">Or type product slugs (comma separated)</span><input className="input" placeholder="red-kurti, leather-shoes" onBlur={(e) => { e.target.value.split(',').forEach((s) => addAd(s.trim())); e.target.value = ''; }} /></label>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-extrabold">5. Channels</h2>
        <p className="text-xs text-dim">Open Edit links to change the primary stream, group, logo and up to {MAX_TV_SOURCES - 1} backup streams for the same channel. The player tries backups if a link fails. Stream URLs are public to viewers: never put private credentials in them.</p>
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-raised p-3 text-sm">
          <button type="button" className="btn-gold !py-2" disabled={busy === 'check' || !cfg.channels.length} onClick={checkAll}><Activity size={16} className="mr-1 inline" />{busy === 'check' ? 'Checking...' : 'Check all channels'}</button>
          {prog && <span className="font-semibold">{prog.done.toLocaleString('en-PK')}/{prog.total.toLocaleString('en-PK')} links checked, <span className="text-red-600">{prog.dead.toLocaleString('en-PK')} unavailable</span></span>}
          {deadCount > 0 && <button type="button" className="btn-ghost !py-2" onClick={switchOffDead}>Switch off dead ({deadCount})</button>}
          {prog && prog.done >= prog.total && <button type="button" className="btn-ghost !py-2" onClick={sortFast}>Working first</button>}
          <span className="basis-full text-xs text-dim">The check runs from the server. A channel that works only inside Pakistan can show as dead here: that is why it is switched off, not deleted.</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input className="input !flex-1" placeholder="Search channels (name, group or link)" value={find} onChange={(e) => { setFind(e.target.value); setPage(0); }} />
          <button type="button" className="btn-ghost !py-1.5" onClick={selAllFiltered}>{selected.size === filtered.length && filtered.length ? 'Clear selection' : `Select all ${filtered.length.toLocaleString('en-PK')} found`}</button>
          {selected.size > 0 && <span className="text-xs font-bold text-gold">{selected.size.toLocaleString('en-PK')} ticked</span>}
        </div>

        {cfg.channels.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs">
            <button type="button" className="rounded-full border border-line px-2 py-1" onClick={selAllOnPage} aria-label="Tick every channel on this page">Tick page</button>
            <input type="checkbox" className="accent-[#0B6B45]" checked={rows.length > 0 && rows.every((r) => selected.has(r.i))} onChange={selAllOnPage} aria-label="Tick every channel on this page" />
          </div>
        )}

        <ul className="space-y-1.5">
          {rows.map((c) => (
            <li key={c.i} className={`flex flex-wrap items-center gap-2 rounded-xl border p-2 text-sm ${selected.has(c.i) ? 'border-gold bg-gold/5' : 'border-line'}`}>
              <input type="checkbox" className="accent-[#0B6B45]" checked={selected.has(c.i)} onChange={() => toggleSel(c.i)} aria-label={`Tick ${c.name}`} />
              <span className="w-12 text-xs text-dim">{c.i + 1}</span>
              {health[c.url] && <span title={health[c.url].ok ? `answers${health[c.url].ms ? ` in ${health[c.url].ms} ms` : ''}` : health[c.url].reason} className={`h-2.5 w-2.5 shrink-0 rounded-full ${health[c.url].ok ? 'bg-emerald-500' : 'bg-red-500'}`} />}
              <input className="input !py-1 min-w-[8rem] flex-1" value={c.name} maxLength={70} onChange={(e) => patch(c.i, { name: e.target.value })} />
              <span className="hidden max-w-[12rem] truncate text-xs text-dim md:inline" title={c.url}>{c.group || c.url}</span>
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" className="accent-[#0B6B45]" checked={!c.off} onChange={(e) => patch(c.i, { off: !e.target.checked })} /> on</label>
              <button type="button" className="btn-ghost !px-2 !py-1" onClick={() => move(c.i, -1)} aria-label="Move up">↑</button>
              <button type="button" className="btn-ghost !px-2 !py-1" onClick={() => move(c.i, 1)} aria-label="Move down">↓</button>
              <button type="button" className="text-red-600" onClick={() => drop(c.i)} aria-label={`Delete ${c.name}`}><Trash2 size={16} /></button>
              <details className="basis-full rounded-lg bg-raised p-2">
                <summary className="cursor-pointer font-semibold text-gold">Edit links &amp; details · {channelSources(c).length} source(s)</summary>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label className="text-xs"><span className="label">Primary stream URL</span><input className="input" type="url" value={c.url} onChange={(e) => patch(c.i, { url: e.target.value })} placeholder="https://.../live.m3u8" /></label>
                  <label className="text-xs"><span className="label">Group</span><input className="input" value={c.group || ''} maxLength={40} onChange={(e) => patch(c.i, { group: e.target.value })} /></label>
                  <label className="text-xs"><span className="label">Logo URL (optional)</span><input className="input" type="url" value={c.logo || ''} onChange={(e) => patch(c.i, { logo: e.target.value })} /></label>
                  <label className="text-xs sm:col-span-2"><span className="label">Backup streams (one URL per line; max {MAX_TV_SOURCES - 1})</span><textarea className="input font-mono text-xs" rows={3} value={(c.sources || []).join('\n')} onChange={(e) => patch(c.i, { sources: e.target.value.split('\n') })} placeholder={'https://example.com/backup-1.m3u8\nhttps://example.com/backup-2.m3u8'} /></label>
                </div>
                {channelSources(c).map((url, i) => health[url] && <p key={url} className={`mt-1 text-xs ${health[url].ok ? 'text-emerald-700' : 'text-red-600'}`}>Source {i + 1}: {health[url].ok ? `answers${health[url].ms ? ` in ${health[url].ms} ms` : ''}` : health[url].reason}</p>)}
              </details>
            </li>
          ))}
        </ul>

        {pageCount > 1 && (
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
            <button type="button" className="btn-ghost !px-2 !py-1" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}><ChevronLeft size={14} /></button>
            <span className="text-dim">Page {safePage + 1} of {pageCount.toLocaleString('en-PK')} · {filtered.length.toLocaleString('en-PK')} channels</span>
            <button type="button" className="btn-ghost !px-2 !py-1" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}><ChevronRight size={14} /></button>
          </div>
        )}
        {!cfg.channels.length && <p className="text-sm text-dim">No channels yet.</p>}

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-gold" disabled={busy === 'save' || busy === 'load' || !!loadErr} onClick={save}>{busy === 'save' ? 'Saving...' : 'Save'}</button>
          <button type="button" className="btn-ghost !border-red-400 !text-red-700" disabled={busy === 'clear' || busy === 'load' || !!loadErr || !cfg.channels.length} onClick={clearAllChannels}>{busy === 'clear' ? 'Deleting...' : 'Delete all channels from the database'}</button>
        </div>
      </section>
    </div>
  );
}
