'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  Megaphone, Plus, Trash2, KeyRound, Copy, Check, RotateCw, ExternalLink,
  Sparkles, BarChart3 as StatsIcon, Layers, X, Search,
} from 'lucide-react';
import { authClient, dbClient, firebaseConfigured } from '@/lib/firebase-client';
import { revalidateSite } from '@/lib/admin-cache';
import { AD_TYPES, ANIM_PRESETS, cleanAd } from '@/lib/ads';

const TABS = [
  { id: 'ads', label: 'Ads', icon: Megaphone },
  { id: 'keys', label: 'API Keys', icon: KeyRound },
  { id: 'stats', label: 'Stats & Auto', icon: StatsIcon },
  { id: 'embed', label: 'Embed', icon: Layers },
];

const NEW_AD = {
  id: '', name: '', type: 'product', status: 'active',
  headline: '', sub: '', cta: '', href: '',
  img: '', bg: '', anim: 'float',
  videoUrl: '', poster: '', muted: true, loop: true, skipAfter: 5,
  productId: '', product: null,
  html: '', dailyImpressions: 0, priority: 0, autoOptimize: true,
  startAt: 0, endAt: 0,
};

export default function AdminAds() {
  const [tab, setTab] = useState('ads');
  const [data, setData] = useState(null); // { ads, keys, config, stats, types, anims }
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [newKey, setNewKey] = useState(null);
  const [form, setForm] = useState(NEW_AD);
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState(null);

  async function token() { return (await authClient().currentUser.getIdToken()); }
  async function call(body) {
    const t = await token();
    const r = await fetch('/api/admin/ads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.ok === false) throw new Error(j.error || 'Request failed');
    return j;
  }
  async function load() {
    const t = await token();
    const r = await fetch('/api/admin/ads', { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (j.ok) setData(j); else setMsg(j.error || 'Could not load');
  }
  useEffect(() => { load().catch((e) => setMsg(e.message)); }, []);

  const statsOf = (id) => (data && data.stats ? data.stats[id] : null) || { impressions: 0, clicks: 0 };
  const ctrOf = (id) => { const s = statsOf(id); return s.impressions > 0 ? ((s.clicks / s.impressions) * 100).toFixed(2) : '0.00'; };

  function flash(m) { setMsg(m); setTimeout(() => { if (msg === m) setMsg(''); }, 6000); }

  function newAd() { setForm(NEW_AD); setEditing(true); setPreview(null); }
  function editAd(ad) {
    setForm({ ...NEW_AD, ...ad, video: ad.video || {}, product: ad.product || null });
    setEditing(true); setPreview(null);
  }
  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function saveAd() {
    setBusy(true);
    try {
      const ad = cleanAd({ ...form, id: form.id, createdAt: form.createdAt });
      const j = await call({ action: 'saveAd', ad });
      setMsg(`Saved "${j.ad.name}".`);
      await load();
      await revalidateSite(undefined, ['ads']);
      setEditing(false);
    } catch (e) { setMsg(`Could not save: ${e.message}`); }
    setBusy(false);
  }

  async function delAd(id) {
    if (!confirm('Delete this ad? Its stats will go with it.')) return;
    try { await call({ action: 'deleteAd', id }); flash('Ad deleted.'); await load(); }
    catch (e) { setMsg(e.message); }
  }

  async function createKey(e) {
    e.preventDefault();
    const f = e.target;
    const j = await call({
      action: 'createKey',
      name: f.name.value,
      expiresDays: Number(f.expiresDays.value),
      allowedAds: (f.allowedAds.value || 'all').split(',').map((s) => s.trim()).filter(Boolean),
    });
    setNewKey(j);
    await load();
  }

  async function revokeKey(id) {
    try { await call({ action: 'revokeKey', id }); flash('Key revoked.'); await load(); }
    catch (e) { setMsg(e.message); }
  }

  async function setConfig(patch) {
    const j = await call({ action: 'setConfig', config: { ...data.config, ...patch } });
    setData((d) => ({ ...d, config: j.config }));
    flash('Saved.');
    await revalidateSite(undefined, ['ads']);
  }

  async function resetAll() {
    if (!confirm('Clear ALL ad statistics?')) return;
    const j = await call({ action: 'resetStats' });
    flash(`Stats cleared (${j.cleared}).`);
    await load();
  }

  async function runPreview() {
    try {
      const ad = cleanAd({ ...form, id: form.id });
      const t = await token();
      const r = await fetch('/api/admin/ads', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ action: 'preview', ad }),
      });
      const j = await r.json();
      if (j.ok) setPreview(j.creative); else setMsg(j.error);
    } catch (e) { setMsg(e.message); }
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-extrabold"><Megaphone className="text-gold" /> Ads API</h1>
          <p className="mt-1 text-sm text-dim">Banner, video and animation ads for MIZANORA products - on the shop itself AND on any other website, with auto-optimisation.</p>
        </div>
        <div className="flex gap-2">
          {tab === 'ads' && <button type="button" className="btn-gold" onClick={newAd}><Plus size={16} /> New ad</button>}
          {tab === 'stats' && <button type="button" className="btn-ghost" onClick={resetAll}><RotateCw size={15} /> Clear stats</button>}
        </div>
      </div>
      {msg && <p role="status" className="rounded-xl bg-raised p-3 text-sm text-cream">{msg}</p>}

      <div className="flex gap-1.5 overflow-x-auto rounded-2xl border border-line bg-surface p-1.5">
        {TABS.map((t) => { const I = t.icon; return (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${tab === t.id ? 'bg-gold text-[#073D28]' : 'text-dim hover:bg-raised'}`}>
            <I size={15} /> {t.label}
          </button>); })}
      </div>

      {!data && <p className="text-dim">Loading...</p>}

      {tab === 'ads' && data && <AdsTab data={data} statsOf={statsOf} ctrOf={ctrOf} onEdit={editAd} onDel={delAd} />}
      {tab === 'keys' && data && <KeysTab data={data} newKey={newKey} setNewKey={setNewKey} onRevoke={revokeKey} onCreate={createKey} flash={flash} />}
      {tab === 'stats' && data && <StatsTab data={data} statsOf={statsOf} ctrOf={ctrOf} onConfig={setConfig} />}
      {tab === 'embed' && data && <EmbedTab data={data} />}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={() => setEditing(false)}>
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border border-line bg-ink p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-extrabold">{form.id ? 'Edit ad' : 'New ad'}</h2>
              <button type="button" aria-label="Close" onClick={() => setEditing(false)}><X size={20} /></button>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm"><span className="label">Name</span><input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Eid collection - 30% off" /></label>
                <label className="block text-sm"><span className="label">Type</span>
                  <select className="input" value={form.type} onChange={(e) => set('type', e.target.value)}>
                    {AD_TYPES.map((t) => <option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm"><span className="label">Headline</span><input className="input" value={form.headline} onChange={(e) => set('headline', e.target.value)} placeholder="Best deals of the week" /></label>
                <label className="block text-sm"><span className="label">Button text</span><input className="input" value={form.cta} onChange={(e) => set('cta', e.target.value)} placeholder="Shop now" /></label>
              </div>
              <label className="block text-sm"><span className="label">Link (product page or any URL). Leave empty for product ads.</span><input className="input" value={form.href} onChange={(e) => set('href', e.target.value)} placeholder="/deals or https://..." /></label>
              <p className="text-xs text-dim">{AD_TYPES.find((t) => t.id === form.type)?.desc}</p>

              {form.type === 'banner' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm"><span className="label">Background image URL</span><input className="input" value={form.img} onChange={(e) => set('img', e.target.value)} placeholder="https://..." /></label>
                  <label className="block text-sm"><span className="label">Background colour</span><input className="input" value={form.bg} onChange={(e) => set('bg', e.target.value)} placeholder="#0B6B45" /></label>
                </div>
              )}

              {form.type === 'animation' && (
                <label className="block text-sm"><span className="label">Animation</span>
                  <select className="input" value={form.anim} onChange={(e) => set('anim', e.target.value)}>
                    {ANIM_PRESETS.map((a) => <option key={a.id} value={a.id}>{a.label} - {a.desc}</option>)}
                  </select>
                </label>
              )}

              {form.type === 'video' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm"><span className="label">Video URL (mp4 / webm)</span><input className="input" value={form.videoUrl} onChange={(e) => set('videoUrl', e.target.value)} placeholder="https://.../ad.mp4" /></label>
                  <label className="block text-sm"><span className="label">Poster image URL</span><input className="input" value={form.poster} onChange={(e) => set('poster', e.target.value)} placeholder="https://..." /></label>
                  <label className="block text-sm"><span className="label">Skip countdown (seconds)</span><input className="input" type="number" min="0" max="30" value={form.skipAfter} onChange={(e) => set('skipAfter', Number(e.target.value))} /></label>
                  <div className="flex gap-4 text-sm">
                    <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[#0B6B45]" checked={form.muted} onChange={(e) => set('muted', e.target.checked)} /> Muted (autoplays on every phone)</label>
                    <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[#0B6B45]" checked={form.loop} onChange={(e) => set('loop', e.target.checked)} /> Loop</label>
                  </div>
                </div>
              )}

              {form.type === 'html' && (
                <label className="block text-sm"><span className="label">HTML creative (scripts &amp; handlers are stripped)</span>
                  <textarea className="input font-mono !text-xs" rows={8} spellCheck={false} value={form.html} onChange={(e) => set('html', e.target.value)} placeholder='<div style="...">Your creative</div>' /></label>
              )}

              {(form.type === 'product') && (
                <ProductPicker form={form} set={set} firebaseConfigured={firebaseConfigured} />
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm"><span className="label">Sub text (small line under the headline)</span><input className="input" value={form.sub} onChange={(e) => set('sub', e.target.value)} /></label>
                <label className="block text-sm"><span className="label">Daily impression cap (0 = unlimited)</span><input className="input" type="number" min="0" value={form.dailyImpressions} onChange={(e) => set('dailyImpressions', Number(e.target.value))} /></label>
                <label className="block text-sm"><span className="label">Priority (0-10, higher shows more)</span><input className="input" type="number" min="0" max="10" value={form.priority} onChange={(e) => set('priority', Number(e.target.value))} /></label>
                <div className="text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-[#0B6B45]" checked={form.autoOptimize} onChange={(e) => set('autoOptimize', e.target.checked)} /> Auto-optimise (learns from clicks)</label>
                  <label className="flex items-center gap-2 mt-2"><input type="checkbox" className="h-4 w-4 accent-[#0B6B45]" checked={form.status === 'active'} onChange={(e) => set('status', e.target.checked ? 'active' : 'paused')} /> Active (paused ads never show)</label>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm"><span className="label">Start date (optional)</span><input className="input" type="datetime-local" value={form.startAt ? new Date(form.startAt).toISOString().slice(0, 16) : ''} onChange={(e) => set('startAt', e.target.value ? Date.parse(e.target.value) : 0)} /></label>
                <label className="block text-sm"><span className="label">End date (optional)</span><input className="input" type="datetime-local" value={form.endAt ? new Date(form.endAt).toISOString().slice(0, 16) : ''} onChange={(e) => set('endAt', e.target.value ? Date.parse(e.target.value) : 0)} /></label>
              </div>

              {preview && <PreviewBox creative={preview} />}

              <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-ink/95 p-3 shadow-lg backdrop-blur">
                <button type="button" className="btn-gold" disabled={busy} onClick={saveAd}>{busy ? 'Saving...' : form.id ? 'Save changes' : 'Create ad'}</button>
                <button type="button" className="btn-ghost" onClick={runPreview}><Sparkles size={15} /> Preview creative</button>
                <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Ads list ---------------------------------------------------
function AdsTab({ data, statsOf, ctrOf, onEdit, onDel }) {
  return (
    <div className="space-y-4">
      {data.ads.length === 0 && <p className="text-sm text-dim">No ads yet. Create your first one - a product ad takes two minutes.</p>}
      {data.ads.map((ad) => {
        const s = statsOf(ad.id);
        return (
          <div key={ad.id} className="card flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-raised px-2 py-0.5 text-[0.65rem] font-bold uppercase text-gold">{ad.type}</span>
                <span className={`rounded-lg px-2 py-0.5 text-[0.65rem] font-bold uppercase ${ad.status === 'active' ? 'bg-green-900/50 text-green-300' : 'bg-raised text-faint'}`}>{ad.status}</span>
                {ad.autoOptimize && <span className="rounded-lg bg-raised px-2 py-0.5 text-[0.65rem] font-bold uppercase text-dim">auto</span>}
                <b className="truncate font-semibold">{ad.name}</b>
              </div>
              <p className="mt-1 line-clamp-1 text-xs text-dim">
                {ad.headline || ad.product && ad.product.name || '(no headline)'}
                {ad.productId ? ` · ${ad.productId}` : ''}
                {ad.videoUrl ? ' · video' : ''}
              </p>
            </div>
            <div className="flex gap-6 text-right">
              <div><p className="text-lg font-extrabold">{s.impressions}</p><p className="text-[0.65rem] uppercase text-faint">views</p></div>
              <div><p className="text-lg font-extrabold">{s.clicks}</p><p className="text-[0.65rem] uppercase text-faint">clicks</p></div>
              <div><p className="text-lg font-extrabold">{ctrOf(ad.id)}%</p><p className="text-[0.65rem] uppercase text-faint">CTR</p></div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => onEdit(ad)} className="btn-ghost !px-3 !py-2 text-xs">Edit</button>
              <button type="button" onClick={() => onDel(ad.id)} className="text-red-400 p-2" aria-label="Delete"><Trash2 size={17} /></button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------- Product picker (for product ads) --------------------------
function ProductPicker({ form, set, firebaseConfigured }) {
  const [hits, setHits] = useState([]);
  const [q, setQ] = useState('');

  async function search(e) {
    e.preventDefault();
    if (!firebaseConfigured) return;
    try {
      const { collection, getDocs, query, orderBy, limit } = await import('firebase/firestore');
      const snap = await getDocs(query(collection(dbClient(), 'products'), orderBy('createdAt', 'desc'), limit(300)));
      const t = q.trim().toLowerCase();
      setHits(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => !t || (p.name || '').toLowerCase().includes(t)).slice(0, 40));
    } catch (e) { setHits([]); }
  }

  function pick(p) {
    set('productId', p.id);
    set('product', { name: p.name, price: Number(p.price) || 0, comparePrice: Number(p.comparePrice) || 0, img: (p.images && p.images[0]) || p.image || '', slug: p.slug || p.id });
    if (!form.headline) set('headline', p.name);
    if (!form.cta) set('cta', 'Buy now');
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <p className="text-sm font-semibold">Product this ad shows</p>
      {form.product ? (
        <div className="mt-2 flex items-center gap-3 rounded-xl bg-raised p-2.5">
          {form.product.img && <img src={form.product.img} alt="" className="h-12 w-12 rounded-lg object-cover" referrerPolicy="no-referrer" />}
          <div className="min-w-0 flex-1"><b className="block truncate text-sm">{form.product.name}</b><small className="text-dim">Rs {form.product.price}{form.product.comparePrice > form.product.price ? ` · was Rs ${form.product.comparePrice}` : ''}</small></div>
          <button type="button" onClick={() => { set('productId', ''); set('product', null); }} className="text-red-400"><X size={16} /></button>
        </div>
      ) : (
        <>
          <form onSubmit={search} className="mt-2 flex gap-2">
            <div className="relative flex-1">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
              <input className="input !py-2.5 !pl-9 text-sm" placeholder="Search products..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <button type="submit" className="btn-ghost !px-4 !py-2.5 text-sm">Search</button>
          </form>
          {!firebaseConfigured && <p className="mt-2 text-xs text-faint">Firebase is not configured - you can still fill the fields below manually.</p>}
          {hits.length > 0 && (
            <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto rounded-xl bg-raised p-1.5">
              {hits.map((p) => (
                <li key={p.id}><button type="button" onClick={() => pick(p)} className="flex w-full items-center gap-3 rounded-lg p-2 text-left hover:bg-gold/10">
                  {p.images && p.images[0] ? <img src={p.images[0]} alt="" className="h-10 w-10 rounded object-cover" referrerPolicy="no-referrer" /> : <span className="grid h-10 w-10 place-items-center rounded bg-ink font-bold text-gold">M</span>}
                  <span className="min-w-0 flex-1"><b className="block truncate text-sm">{p.name}</b><small className="text-dim">Rs {Number(p.price) || 0}</small></span>
                </button></li>
              ))}
            </ul>
          )}
          {hits.length === 0 && q && <p className="mt-2 text-xs text-faint">No match. You can also type the product fields manually below.</p>}
        </>
      )}
      <details className="mt-2">
        <summary className="text-xs text-faint">Set product fields manually</summary>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <input className="input !py-2 text-sm" placeholder="Product name" value={form.product?.name || ''} onChange={(e) => set('product', { ...(form.product || {}), name: e.target.value })} />
          <input className="input !py-2 text-sm" placeholder="Price" type="number" value={form.product?.price || ''} onChange={(e) => set('product', { ...(form.product || {}), price: Number(e.target.value) || 0 })} />
          <input className="input !py-2 text-sm" placeholder="Compare price" type="number" value={form.product?.comparePrice || ''} onChange={(e) => set('product', { ...(form.product || {}), comparePrice: Number(e.target.value) || 0 })} />
          <input className="input !py-2 text-sm" placeholder="Image URL" value={form.product?.img || ''} onChange={(e) => set('product', { ...(form.product || {}), img: e.target.value })} />
        </div>
      </details>
    </div>
  );
}

// ---------------- Keys --------------------------------------------------------
function KeysTab({ data, newKey, setNewKey, onRevoke, onCreate, flash }) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (_) { flash('Copy failed - select and copy manually.'); }
  };
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <div className="card">
          <h2 className="mb-3 text-lg font-extrabold"><KeyRound size={18} className="inline" /> API Keys</h2>
          <p className="text-sm text-dim">Each key authorises a website. The secret is shown ONCE when it is created - only its hash stays in Firestore. Revoke a key any time to stop its ads instantly.</p>
          {data.keys.length === 0 && <p className="mt-3 text-sm text-dim">No keys yet. Create one on the right.</p>}
          {data.keys.map((k) => (
            <div key={k.id} className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-line p-3">
              <div className="min-w-0 flex-1">
                <b className="block truncate">{k.name}</b>
                <small className="text-dim">{k.prefix} · {k.revoked ? 'revoked' : k.expiresAt ? `expires ${new Date(k.expiresAt).toLocaleDateString()}` : 'no expiry'} · {k.stats.impressions} views / {k.stats.clicks} clicks</small>
                {k.lastSeen > 0 && <small className="text-faint">last seen {new Date(k.lastSeen).toLocaleString()}</small>}
              </div>
              {!k.revoked && <button type="button" onClick={() => onRevoke(k.id)} className="text-red-400 text-xs font-semibold">Revoke</button>}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="card">
          <h2 className="mb-3 text-lg font-extrabold"><Plus size={18} className="inline" /> New key</h2>
          <form onSubmit={onCreate} className="space-y-3 text-sm">
            <label className="block"><span className="label">Name (which site)</span><input className="input" name="name" required placeholder="My blog" /></label>
            <label className="block"><span className="label">Expires after</span>
              <select className="input" name="expiresDays" defaultValue="365">
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="365">1 year</option>
                <option value="0">Never</option>
              </select>
            </label>
            <label className="block"><span className="label">Ads this key may show (ids, or "all")</span><input className="input" name="allowedAds" defaultValue="all" placeholder="all" /></label>
            <button type="submit" className="btn-gold w-full">Create key</button>
          </form>
        </div>

        {newKey && (
          <div className="card border-gold bg-gold/5">
            <h2 className="mb-2 flex items-center gap-2 text-lg font-extrabold"><Sparkles size={17} className="text-gold" /> Your new key - copy NOW</h2>
            <p className="text-xs text-dim">It will never be shown again. Store it in the other website's settings.</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-xl bg-ink p-3 font-mono text-xs text-gold">{newKey.key}</code>
              <button type="button" onClick={() => copy(newKey.key)} className="btn-gold !px-4 !py-3">{copied ? <Check size={15} /> : <Copy size={15} />}</button>
            </div>
            <div className="mt-3 rounded-xl bg-raised p-3 font-mono text-[0.65rem] leading-5 text-dim">
              &lt;script async src=&quot;{origin}/api/ads/embed.js?key={newKey.key}&quot;&gt;&lt;/script&gt;
            </div>
            <button type="button" onClick={() => setNewKey(null)} className="mt-2 text-xs text-faint underline">Hide</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- Stats & auto-optimise -------------------------------------
function StatsTab({ data, statsOf, ctrOf, onConfig }) {
  const sorted = useMemo(() => [...data.ads].sort((a, b) => Number(ctrOf(b.id)) - Number(ctrOf(a.id)) || statsOf(b.id).impressions - statsOf(a.id).impressions), [data.ads]);
  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="mb-3 text-lg font-extrabold"><Sparkles size={18} className="inline" /> Auto-optimisation &amp; delivery</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle label="Ads API enabled" hint="The master switch. Off = no ad is served anywhere." v={data.config.enabled} onChange={(v) => onConfig({ enabled: v })} />
          <Toggle label="Auto-optimise" hint="Ads with the best click rate show up more often." v={data.config.autoOptimize} onChange={(v) => onConfig({ autoOptimize: v })} />
          <Toggle label="Show ads on the shop itself" hint="Home + deals pages run the shop's own ads (key=self)." v={data.config.showOnShop} onChange={(v) => onConfig({ showOnShop: v })} />
          <label className="block text-sm"><span className="label">Rotation speed (seconds)</span>
            <input className="input" type="number" min="2" max="60" value={data.config.rotateMs / 1000} onChange={(e) => onConfig({ rotateMs: Math.max(2000, Math.min(60000, Number(e.target.value) * 1000)) })} /></label>
          <label className="block text-sm"><span className="label">Max ads per slot request</span>
            <input className="input" type="number" min="1" max="10" value={data.config.perView} onChange={(e) => onConfig({ perView: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })} /></label>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-3 text-lg font-extrabold"><StatsIcon size={18} className="inline" /> Performance</h2>
        {data.ads.length === 0 ? <p className="text-sm text-dim">No ads yet - create one to see live clicks here.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-faint"><th className="py-2">Ad</th><th>Views</th><th>Clicks</th><th>CTR</th><th>Score</th></tr></thead>
            <tbody>
              {sorted.map((ad) => {
                const s = statsOf(ad.id);
                const score = Math.round(50 + ad.priority * 12 + Math.min(1, (s.impressions > 0 ? s.clicks / s.impressions : 0) * 3) * 40 + (s.clicks > 0 ? Math.min(20, Math.log10(s.clicks + 1) * 8) : 0));
                return (
                  <tr key={ad.id} className="border-t border-line">
                    <td className="py-2"><b className="block truncate">{ad.name}</b><small className="text-faint">{ad.type}</small></td>
                    <td>{s.impressions}</td><td>{s.clicks}</td><td className="font-semibold text-gold">{ctrOf(ad.id)}%</td><td>{score}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Toggle({ label, hint, v, onChange }) {
  return (
    <label className="flex items-start gap-3 rounded-xl border border-line p-3 text-sm">
      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#0B6B45]" checked={v} onChange={(e) => onChange(e.target.checked)} />
      <span><b className="block text-cream">{label}</b><small className="text-dim">{hint}</small></span>
    </label>
  );
}

// ---------------- Embed snippet ----------------------------------------------
function EmbedTab({ data }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const sampleKey = data.keys.find((k) => !k.revoked)?.prefix || 'mza_xxxxxxxx…';
  const snippet = `<!-- 1) Load the Ads API once in the <head> of your website -->
<script async src="${origin}/api/ads/embed.js?key=YOUR_API_KEY"></script>

<!-- 2) Drop slots where ads should appear -->
<div data-mz-ads></div>          <!-- auto: server picks the best ad -->
<div data-mz-ads="video"></div>  <!-- video ad -->
<div data-mz-ads="animation"></div>
<div data-mz-ads="product"></div>`;
  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="mb-2 text-lg font-extrabold"><Layers size={18} className="inline" /> Give this to the other website</h2>
        <p className="text-sm text-dim">The other website adds ONE line to its <code>&lt;head&gt;</code>, then drops <code>&lt;div data-mz-ads&gt;&lt;/div&gt;</code> wherever ads should appear. Video ads, animation ads, product cards - all types, auto-optimised.</p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-ink p-4 font-mono text-[0.7rem] leading-5 text-gold">{snippet}</pre>
      </div>
      <div className="card">
        <h2 className="mb-2 text-lg font-extrabold"><KeyRound size={18} className="inline" /> Slot types</h2>
        <ul className="space-y-2 text-sm">
          {AD_TYPES.map((t) => <li key={t.id} className="flex gap-2"><code className="rounded bg-raised px-1.5 py-0.5 text-xs">{`data-mz-ads="${t.id}"`}</code><span className="text-dim">{t.desc}</span></li>)}
        </ul>
        <p className="mt-3 rounded-xl bg-raised p-3 text-xs text-dim">Optional: set <code>window.MZADS = {`{ key: 'mza_…', rotate: 8000, auto: true }`}</code> before the script for auto-inserted top banners, and use <code>window.MZADS_API.refresh()</code> after adding slots late.</p>
      </div>
      <div className="card">
        <h2 className="mb-2 text-lg font-extrabold"><ExternalLink size={18} className="inline" /> Live test</h2>
        <p className="text-sm text-dim">This shop itself can show ads (Admin &gt; Stats &amp; Auto &gt; &quot;Show ads on the shop itself&quot;). Turn it on, then open the home page.</p>
      </div>
    </div>
  );
}

// ---------------- Creative preview ------------------------------------------
function PreviewBox({ creative }) {
  const a = creative || {};
  let node = null;
  if (a.type === 'product' && a.product) {
    node = <div className="mza-card mza-anim-pop">
      {a.product.img && <div className="mza-pimg" style={{ backgroundImage: `url('${a.product.img}')` }} />}
      <div className="mza-pbody"><div className="mza-pname">{a.product.name}</div>
        <div className="mza-prow">{a.product.price > 0 && <span className="mza-pprice">Rs {a.product.price}</span>}{a.product.comparePrice > a.product.price && <span className="mza-pcmp">Rs {a.product.comparePrice}</span>}</div>
        <span className="mza-pcta">{a.cta}</span></div>
    </div>;
  } else if (a.type === 'video' && a.video) {
    node = <div className="mza-video" style={{ minHeight: 220 }}>
      {a.video.url && <video src={a.video.url} poster={a.video.poster} muted loop playsInline preload="metadata" className="mza-vposter" style={{ height: 220 }} />}
      {!a.video.url && a.video.poster && <img src={a.video.poster} alt="" className="mza-vposter" style={{ height: 220, width: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />}
      <div className="mza-vshade" />
      <div className="mza-vlabel">{a.headline || a.name}</div>
      <span className="mza-badge">Ad</span>
    </div>;
  } else if (a.type === 'html') {
    node = <div className="mza-slot mza-anim-pop" dangerouslySetInnerHTML={{ __html: a.html || '(empty creative)' }} />;
  } else {
    node = <a className={'mza-creative mza-anim-pop mza-anim-' + (a.anim || 'float')} href={a.href || '#'} target="_blank" rel="noopener sponsored nofollow" style={a.bg ? { background: a.bg } : undefined}>
      {a.img && <div className="mza-pic" style={{ backgroundImage: `url('${a.img}')` }} />}
      <div className="mza-shade" />
      <div className="mza-txt"><div className="mza-h">{a.headline || a.name}</div>{a.sub && <div className="mza-s">{a.sub}</div>}</div>
      {a.cta && <div className="mza-btn">{a.cta}</div>}
    </a>;
  }
  return (
    <div className="rounded-xl border border-line p-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-faint">Preview (what the visitor sees)</p>
      <div className="rounded-xl bg-ink p-3">{node}</div>
    </div>
  );
}
