'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Trash2, Tv, Activity } from 'lucide-react';
import { authClient, dbClient } from '@/lib/firebase-client';
import { revalidateSite } from '@/lib/admin-cache';
import { MAX_CHANNELS, TV_DEFAULT, TV_DOC, cleanChannel, cleanTv, parseM3U, TV_PRESETS } from '@/lib/liveTv';

// Admin > Live TV: load channels (M3U file, M3U link, pasted text or one by one) and choose the PRODUCTS whose ad plays while a visitor
// switches channel. Saved in Firestore siteMeta/liveTv; the /live page refreshes within seconds of pressing Save.
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
  const [shown, setShown] = useState(40);
  const [health, setHealth] = useState({}); // url -> { ok, reason, ms }
  const [prog, setProg] = useState(null); // { done, total, dead }

  useEffect(() => {
    let live = true;
    getDoc(doc(dbClient(), TV_DOC.collection, TV_DOC.id)).then((d) => { if (live) setCfg(d.exists() ? cleanTv({ ...TV_DEFAULT, ...d.data() }) : { ...TV_DEFAULT }); })
      .catch((e) => { if (live) { setMsg(`Could not read the setting: ${e.message}`); setCfg({ ...TV_DEFAULT }); } });
    return () => { live = false; };
  }, []);
  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));
  const setAds = (k, v) => setCfg((c) => ({ ...c, ads: { ...c.ads, [k]: v } }));
  const list = useMemo(() => {
    if (!cfg) return [];
    const q = find.trim().toLowerCase();
    return cfg.channels.map((c, i) => ({ ...c, i })).filter((c) => !q || `${c.name} ${c.group}`.toLowerCase().includes(q));
  }, [cfg, find]);
  if (!cfg) return <p className="p-6 text-dim">Loading...</p>;

  const merge = (incoming, skipped = 0, what = 'playlist') => {
    const have = new Set(cfg.channels.map((c) => c.url));
    const fresh = incoming.filter((c) => !have.has(c.url));
    const all = [...cfg.channels, ...fresh].slice(0, MAX_CHANNELS);
    set('channels', all);
    setMsg(`${fresh.length} new channel${fresh.length === 1 ? '' : 's'} added from the ${what}${incoming.length - fresh.length ? `, ${incoming.length - fresh.length} already there` : ''}${skipped ? `, ${skipped} skipped (not a stream link)` : ''}. ${all.length >= MAX_CHANNELS ? `Limit ${MAX_CHANNELS} reached. ` : ''}Press Save to publish.`);
  };
  const fromFile = async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { setMsg('File is bigger than 2 MB.'); return; }
    const t = await f.text();
    const r = parseM3U(t);
    if (!r.channels.length) { setMsg(`No usable channel found. Only https:// streams work on this website${r.skipped ? ` (${r.skipped} lines were skipped)` : ''}.`); return; }
    merge(r.channels, r.skipped, 'file');
  };
  const fromText = () => { const r = parseM3U(paste); if (!r.channels.length) { setMsg('No usable channel found in the pasted text.'); return; } merge(r.channels, r.skipped, 'pasted text'); setPaste(''); };
  const fromLink = async () => {
    setBusy('link'); setMsg('');
    try {
      const r = await fetch('/api/admin/tv-import', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await authClient().currentUser.getIdToken()}` }, body: JSON.stringify({ url: link }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error || `Error ${r.status}`);
      if (!j.channels.length) throw new Error(`No usable channel found${j.skipped ? ` (${j.skipped} lines skipped)` : ''}.`);
      merge(j.channels, j.skipped, 'link'); setLink('');
    } catch (e) { setMsg(e.message); }
    setBusy('');
  };
  const addOne = () => { const c = cleanChannel(one); if (!c) { setMsg('Give a name and a stream link (http:// or https://).'); return; } merge([c], 0, 'form'); setOne({ name: '', url: '', group: '' }); };
  const patch = (i, p) => set('channels', cfg.channels.map((c, n) => (n === i ? { ...c, ...p } : c)));
  const drop = (i) => set('channels', cfg.channels.filter((_, n) => n !== i));
  const move = (i, d) => { const a = [...cfg.channels]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; set('channels', a); };

  const searchProducts = async () => {
    if (pq.trim().length < 2) return;
    setBusy('search');
    try { const r = await fetch(`/api/search?q=${encodeURIComponent(pq.trim())}`); const j = await r.json(); setHits((j.items || j.products || []).slice(0, 12)); } catch { setHits([]); }
    setBusy('');
  };
  const addAd = (slug) => { if (!slug || cfg.ads.slugs.includes(slug)) return; setAds('slugs', [...cfg.ads.slugs, slug].slice(0, 30)); };

  // Check every channel (12 at a time, from the server) and show a red / green dot. Dead ones can be switched off in one tap.
  async function checkAll() {
    const urls = cfg.channels.filter((c) => !c.off).map((c) => c.url);
    if (!urls.length) return;
    setBusy('check'); setMsg(''); const h = {}; let dead = 0;
    setProg({ done: 0, total: urls.length, dead: 0 });
    try {
      const token = await authClient().currentUser.getIdToken();
      for (let i = 0; i < urls.length; i += 12) {
        const r = await fetch('/api/admin/tv-check', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ urls: urls.slice(i, i + 12) }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) throw new Error(j.error || `Error ${r.status}`);
        for (const x of j.results) { h[x.url] = x; if (!x.ok) dead += 1; }
        setHealth({ ...h }); setProg({ done: Math.min(urls.length, i + 12), total: urls.length, dead });
      }
      setMsg(`Checked ${urls.length} channels: ${urls.length - dead} answer, ${dead} do not. Press "Switch off dead" then Save.`);
    } catch (e) { setMsg(`Check stopped: ${e.message}`); }
    setBusy('');
  }
  const deadCount = cfg.channels.filter((c) => !c.off && health[c.url] && !health[c.url].ok).length;
  const switchOffDead = () => { set('channels', cfg.channels.map((c) => (health[c.url] && !health[c.url].ok ? { ...c, off: true } : c))); setMsg(`${deadCount} dead channels switched off. Press Save to publish.`); };
  // fastest first: channels that answered quickly go to the top of the list (the visitor's first channel loads sooner)
  const sortFast = () => { const rank = (c) => (c.off ? 3 : health[c.url] ? (health[c.url].ok ? 0 : 2) : 1); set('channels', cfg.channels.map((c, i) => ({ c, i })).sort((a, b) => rank(a.c) - rank(b.c) || ((health[a.c.url] && health[a.c.url].ms) || 0) - ((health[b.c.url] && health[b.c.url].ms) || 0) || a.i - b.i).map((x) => x.c)); setMsg('Working channels moved to the top. Press Save.'); };

  async function save() {
    setBusy('save'); setMsg('');
    try {
      const clean = cleanTv(cfg);
      await setDoc(doc(dbClient(), TV_DOC.collection, TV_DOC.id), { ...clean, updatedAtMs: Date.now() });
      setCfg(clean);
      await revalidateSite(undefined, ['livetv']);
      setMsg(`Saved: ${clean.channels.length} channels, ${clean.ads.slugs.length} ad products. /live shows it within a few seconds.`);
    } catch (e) { setMsg(`Could not save: ${e.message}`); }
    setBusy('');
  }

  return (
    <div className="min-w-0 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="flex items-center gap-2 text-2xl font-extrabold"><Tv size={24} /> Live TV</h1><p className="text-sm text-dim">Channels from an M3U playlist and the product ads shown while the visitor switches channel.</p></div>
        <div className="flex gap-2"><Link href="/live" target="_blank" className="btn-ghost">Open /live</Link><button type="button" className="btn-gold" disabled={busy === 'save'} onClick={save}>{busy === 'save' ? 'Saving...' : 'Save'}</button></div>
      </header>
      {msg && <p role="status" className="rounded-xl bg-raised p-3 text-sm font-semibold text-gold">{msg}</p>}

      <section className="card space-y-3">
        <h2 className="text-lg font-extrabold">1. Settings</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Switch label="Live TV is ON" hint="Off: the /live page says it is not available." checked={cfg.enabled} onChange={(v) => set('enabled', v)} />
          <Switch label="Start playing by itself" hint="The browser still needs one touch before sound." checked={cfg.autoplay} onChange={(v) => set('autoplay', v)} />
          <label className="block text-sm"><span className="label">Title</span><input className="input" maxLength={60} value={cfg.title} onChange={(e) => set('title', e.target.value)} /></label>
          <label className="block text-sm"><span className="label">Short note under the player (optional)</span><input className="input" maxLength={160} value={cfg.note} onChange={(e) => set('note', e.target.value)} /></label>
        </div>
        <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Add only streams you have the right to show: your own, or channels whose owner allows it (many YouTube live channels allow embedding). You are responsible for what you add. <b>http://</b> streams now play too: the shop relays them ("stream relay"). Relayed video uses your Vercel bandwidth, so keep the list to channels people really watch. Use <b>Check all channels</b> below to switch off the dead ones: a channel that never starts is the main reason TV feels slow.</p>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-extrabold">2. Add channels ({cfg.channels.length}/{MAX_CHANNELS})</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm"><span className="label">Upload an M3U / M3U8 file</span><input type="file" accept=".m3u,.m3u8,.txt,audio/x-mpegurl,application/vnd.apple.mpegurl" className="input" onChange={fromFile} /></label>
          <div className="text-sm"><span className="label">Quick lists (public iptv-org playlists): tap one, then press Load</span><div className="mb-2 flex flex-wrap gap-1.5">{TV_PRESETS.map(([n, u]) => <button key={u} type="button" className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold hover:border-gold" onClick={() => setLink(u)}>{n}</button>)}</div></div>
          <div className="text-sm"><span className="label">Or an M3U link (https)</span><div className="flex gap-2"><input className="input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://.../playlist.m3u" /><button type="button" className="btn-ghost" disabled={busy === 'link' || !link} onClick={fromLink}>{busy === 'link' ? '...' : 'Load'}</button></div></div>
        </div>
        <label className="block text-sm"><span className="label">Or paste the playlist text</span><textarea className="input font-mono text-xs" rows={3} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'#EXTM3U\n#EXTINF:-1 group-title="News",My Channel\nhttps://example.com/live.m3u8'} /></label>
        {paste && <button type="button" className="btn-ghost" onClick={fromText}>Add from pasted text</button>}
        <div className="grid gap-2 sm:grid-cols-[1fr_2fr_1fr_auto]">
          <input className="input" placeholder="Channel name" value={one.name} onChange={(e) => setOne({ ...one, name: e.target.value })} />
          <input className="input" placeholder="https://... .m3u8 / YouTube live link" value={one.url} onChange={(e) => setOne({ ...one, url: e.target.value })} />
          <input className="input" placeholder="Group (optional)" value={one.group} onChange={(e) => setOne({ ...one, group: e.target.value })} />
          <button type="button" className="btn-ghost" onClick={addOne}>Add one</button>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-extrabold">3. Ads between channels</h2>
        <p className="text-xs text-dim">When a visitor presses Next, Previous or picks a channel, the chosen products play as a short ad (photo, name, price, a button to the product) while the new channel loads. The ads take turns. Price and photo come from the shop itself.</p>
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
        <h2 className="text-lg font-extrabold">4. Channels</h2>
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-raised p-3 text-sm">
          <button type="button" className="btn-gold !py-2" disabled={busy === 'check' || !cfg.channels.length} onClick={checkAll}><Activity size={16} className="mr-1 inline" />{busy === 'check' ? 'Checking...' : 'Check all channels'}</button>
          {prog && <span className="font-semibold">{prog.done}/{prog.total} checked, <span className="text-red-600">{prog.dead} dead</span></span>}
          {deadCount > 0 && <button type="button" className="btn-ghost !py-2" onClick={switchOffDead}>Switch off dead ({deadCount})</button>}
          {prog && prog.done >= prog.total && <button type="button" className="btn-ghost !py-2" onClick={sortFast}>Working first</button>}
          <span className="basis-full text-xs text-dim">The check runs from the server. A channel that works only inside Pakistan can show as dead here: that is why it is switched off, not deleted. You can switch it on again.</span>
        </div>
        <input className="input" placeholder="Search channels" value={find} onChange={(e) => { setFind(e.target.value); setShown(40); }} />
        <ul className="space-y-1.5">
          {list.slice(0, shown).map((c) => (
            <li key={c.url} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-2 text-sm">
              <span className="w-8 text-xs text-dim">{c.i + 1}</span>
              {health[c.url] && <span title={health[c.url].ok ? `answers${health[c.url].ms ? ` in ${health[c.url].ms} ms` : ''}` : health[c.url].reason} className={`h-2.5 w-2.5 shrink-0 rounded-full ${health[c.url].ok ? 'bg-emerald-500' : 'bg-red-500'}`} />}
              <input className="input !py-1 min-w-[8rem] flex-1" value={c.name} maxLength={70} onChange={(e) => patch(c.i, { name: e.target.value })} />
              <span className="hidden max-w-[12rem] truncate text-xs text-dim md:inline" title={c.url}>{c.group || c.url}</span>
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" className="accent-[#0B6B45]" checked={!c.off} onChange={(e) => patch(c.i, { off: !e.target.checked })} /> on</label>
              <button type="button" className="btn-ghost !px-2 !py-1" onClick={() => move(c.i, -1)} aria-label="Move up">↑</button>
              <button type="button" className="btn-ghost !px-2 !py-1" onClick={() => move(c.i, 1)} aria-label="Move down">↓</button>
              <button type="button" className="text-red-600" onClick={() => drop(c.i)} aria-label="Delete"><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
        {list.length > shown && <button type="button" className="btn-ghost" onClick={() => setShown((n) => n + 60)}>Show more ({list.length - shown})</button>}
        {!cfg.channels.length && <p className="text-sm text-dim">No channels yet.</p>}
        <button type="button" className="btn-gold" disabled={busy === 'save'} onClick={save}>{busy === 'save' ? 'Saving...' : 'Save'}</button>
      </section>
    </div>
  );
}
