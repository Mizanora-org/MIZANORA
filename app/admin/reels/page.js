'use client';
import { useCallback, useEffect, useState } from 'react';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { dbClient } from '@/lib/firebase-client';
import { readCache, writeCache, revalidateSite } from '@/lib/admin-cache';
import { parseVideo } from '@/lib/video';
import { REEL_MUSIC_DEFAULT, cleanReelMusic } from '@/lib/reelMusic';

const EMPTY = { id: '', url: '', title: '', productSlug: '', link: '', order: '', active: true };

// Mizanora background music: one link the admin sets. It plays behind reels that have NO sound
// (silent videos). A reel with its own sound keeps its sound and the music stays quiet.
function MusicCard() {
  const [cfg, setCfg] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    getDoc(doc(dbClient(), 'siteMeta', 'reelMusic'))
      .then((d) => setCfg({ ...REEL_MUSIC_DEFAULT, ...(d.exists() ? d.data() : {}) }))
      .catch((e) => { setCfg({ ...REEL_MUSIC_DEFAULT }); setMsg(e.message); });
  }, []);
  useEffect(() => () => { if (preview) preview.pause(); }, [preview]);

  if (!cfg) return <p className="card mb-6 text-sm text-dim">Loading music settings...</p>;
  const set = (k) => (e) => setCfg((c) => ({ ...c, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function save(e) {
    e.preventDefault();
    const r = cleanReelMusic(cfg);
    if (!r.ok) { setMsg(r.error); return; }
    setBusy(true);
    try {
      await setDoc(doc(dbClient(), 'siteMeta', 'reelMusic'), { ...r.value, updatedAtMs: Date.now() });
      setCfg({ ...REEL_MUSIC_DEFAULT, ...r.value });
      await revalidateSite();
      setMsg('Saved. The reels use this music now (it can take a minute to refresh on the phones).');
    } catch (err) { setMsg(err.message); }
    setBusy(false);
  }

  function play() {
    const r = cleanReelMusic(cfg);
    if (!r.ok || !r.value.url) { setMsg(r.ok ? 'Paste a music link first.' : r.error); return; }
    if (preview) preview.pause();
    const a = new Audio(r.value.url);
    a.volume = r.value.volume / 100;
    a.play().catch(() => setMsg('The browser could not play this link. Check that it is a direct audio file link.'));
    setPreview(a);
  }
  function stop() { if (preview) preview.pause(); }

  const r = cleanReelMusic(cfg);
  return (
    <form onSubmit={save} className="card mb-6 space-y-3">
      <div>
        <h2 className="text-xl font-bold">Mizanora background music</h2>
        <p className="text-sm text-dim">Paste a direct audio link (ends with .mp3, .m4a, .ogg or .wav). It plays behind silent reels only. Reels with their own sound keep their sound.</p>
        <p className="mt-1 text-xs text-dim">Where to host it: Cloudinary (free, audio uploads), your own server, or any site that gives a direct file link. Google Drive and Dropbox links are converted automatically when possible.</p>
      </div>
      <div><label className="label" htmlFor="mu">Music link</label>
        <input id="mu" className="input" value={cfg.url} onChange={set('url')} placeholder="https://res.cloudinary.com/.../mizanora-theme.mp3" />
        {cfg.url && <p className={`mt-1 text-xs ${r.ok ? 'text-gold' : 'text-red-600'}`}>{r.ok ? `OK${r.value.url !== cfg.url ? ` (converted to: ${r.value.url})` : ''}` : r.error}</p>}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="mt">Name shown on the reel</label>
          <input id="mt" className="input" maxLength={60} value={cfg.title} onChange={set('title')} /></div>
        <div><label className="label" htmlFor="mv">Volume: {cfg.volume}%</label>
          <input id="mv" type="range" min="0" max="100" value={cfg.volume} onChange={set('volume')} className="w-full accent-[#0B6B45]" /></div>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cfg.enabled !== false} onChange={set('enabled')} className="h-4 w-4 accent-[#0B6B45]" /> Music on in the reels</label>
      <div className="flex flex-wrap gap-3">
        <button className="btn-gold" disabled={busy}>{busy ? 'Saving...' : 'Save music'}</button>
        <button type="button" className="btn-ghost" onClick={play}>Test play</button>
        <button type="button" className="btn-ghost" onClick={stop}>Stop test</button>
        <button type="button" className="px-2 text-sm text-red-700" onClick={() => { setCfg({ ...cfg, url: '' }); }}>Remove link</button>
      </div>
      {msg && <p role="status" className="rounded-xl bg-raised p-3 text-sm">{msg}</p>}
    </form>
  );
}

export default function AdminReels() {
  const [list, setList] = useState(null);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const r = await getDocs(collection(dbClient(), 'reels'));
    setList(r.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)));
    // Product names for the dropdown: reuse the copy the Products page already loaded when there is one.
    let prods = readCache('products');
    if (!prods) {
      const p = await getDocs(collection(dbClient(), 'products'));
      prods = p.docs.map((d) => ({ id: d.id, ...d.data() }));
      writeCache('products', prods);
    }
    setProducts(prods.map((x) => ({ id: x.id, name: x.name })).sort((a, b) => String(a.name).localeCompare(String(b.name))));
  }, []);
  useEffect(() => { load().catch((e) => { setList([]); setMsg(e.code === 'permission-denied' ? 'Publish the updated firestore.rules first (it adds the reels section).' : e.message); }); }, [load]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const v = parseVideo(form.url);

  async function save(e) {
    e.preventDefault();
    if (!v) { setMsg('This link is not supported. Use a YouTube, Facebook, Instagram, TikTok or .mp4 link.'); return; }
    const id = form.id || Date.now().toString(36);
    try {
      await setDoc(doc(dbClient(), 'reels', id), { url: form.url.trim(), title: form.title.trim(), productSlug: form.productSlug, link: form.link.trim(), order: Number(form.order) || 0, active: Boolean(form.active), updatedAtMs: Date.now() });
      setForm(EMPTY); setShow(false); setMsg('Reel saved. It is live on the home page and /reels.'); await load(); await revalidateSite();
    } catch (e2) { setMsg(e2.message); }
  }

  return (
    <div className="min-w-0">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold">Reels</h1>
        <button type="button" className="btn-gold !px-5 !py-2.5" onClick={() => { setForm(EMPTY); setShow(true); }}>+ Add reel</button>
      </div>
      <MusicCard />
      <p className="mb-4 text-sm text-dim">Paste a YouTube Short, Facebook reel, Instagram reel, TikTok or .mp4 link. Pick the product so the viewer gets a Shop now button. Product videos also appear here automatically.</p>
      {msg && <p role="status" className="mb-3 rounded-xl bg-raised p-3 text-sm">{msg}</p>}

      {show && (
        <form onSubmit={save} className="card mb-6 space-y-3">
          <h2 className="text-xl font-bold">{form.id ? 'Edit reel' : 'New reel'}</h2>
          <div><label className="label" htmlFor="ru">Video link</label><input id="ru" className="input" value={form.url} onChange={set('url')} placeholder="https://www.youtube.com/shorts/..." required />
            {form.url && <p className={`mt-1 text-xs ${v ? 'text-gold' : 'text-red-600'}`}>{v ? `OK: ${v.label}${v.vertical ? ' (vertical)' : ''}` : 'Not supported'}</p>}</div>
          <div><label className="label" htmlFor="rt">Title shown on the reel</label><input id="rt" className="input" value={form.title} onChange={set('title')} placeholder="e.g. Eid collection, 3 piece suit" /></div>
          <div><label className="label" htmlFor="rp">Shop now goes to this product</label>
            <select id="rp" className="input" value={form.productSlug} onChange={set('productSlug')}><option value="">No product (use link below)</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          {!form.productSlug && <div><label className="label" htmlFor="rl">Or a page link</label><input id="rl" className="input" value={form.link} onChange={set('link')} placeholder="/category/women-fashion" /></div>}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor="ro">Order (1 shows first)</label><input id="ro" type="number" className="input" value={form.order} onChange={set('order')} /></div>
            <label className="flex items-end gap-2 pb-3 text-sm"><input type="checkbox" checked={form.active} onChange={set('active')} className="h-4 w-4 accent-[#0B6B45]" /> Visible</label>
          </div>
          <div className="flex gap-3"><button className="btn-gold flex-1">Save reel</button><button type="button" className="btn-ghost" onClick={() => setShow(false)}>Cancel</button></div>
        </form>
      )}

      {!list ? <p className="text-dim">Loading...</p> : list.length === 0 ? <p className="card text-center text-dim">No reels yet. Add your first one.</p> : (
        <ul className="space-y-2">
          {list.map((r) => (
            <li key={r.id} className="card flex flex-wrap items-center gap-3 !p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{r.title || r.url} {r.active === false && <span className="text-xs text-red-700">(hidden)</span>}</p>
                <p className="truncate text-xs text-dim">{(parseVideo(r.url) || {}).label || 'Unsupported'} · {r.productSlug ? `Product: ${(products.find((p) => p.id === r.productSlug) || {}).name || r.productSlug}` : (r.link || 'All products')}</p>
              </div>
              <button className="btn-ghost !px-4 !py-2 text-sm" onClick={() => { setForm({ ...EMPTY, ...r, order: r.order || '' }); setShow(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>
              <button className="px-2 text-sm text-red-700" onClick={() => { if (confirm('Delete this reel?')) deleteDoc(doc(dbClient(), 'reels', r.id)).then(load).then(() => revalidateSite()); }}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
