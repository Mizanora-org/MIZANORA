'use client';
import { useEffect, useState } from 'react';
import { Images as ImagesIcon, Plus, Trash2, ExternalLink, RefreshCw } from 'lucide-react';
import { authClient } from '@/lib/firebase-client';
import { revalidateSite } from '@/lib/admin-cache';
import Link from 'next/link';

const GROUPS = [
  ['muaaz', 'Muaaz Iqbal — shows on /muaaz-iqbal, the home feed and the image sitemap'],
  ['site', 'Site — general pictures (footer, pages)'],
];

export default function AdminImages() {
  const [images, setImages] = useState([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ url: '', title: '', caption: '', group: 'muaaz' });
  const [adding, setAdding] = useState(false);

  async function token() { return (await authClient().currentUser.getIdToken()); }
  async function load() {
    const t = await token();
    const r = await fetch('/api/admin/images', { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (j.ok) setImages(j.images); else setMsg(j.error || 'Could not load');
  }
  useEffect(() => { load().catch((e) => setMsg(e.message)); }, []);

  function flash(m) { setMsg(m); setTimeout(() => { if (msg === m) setMsg(''); }, 6000); }

  async function add(e) {
    e.preventDefault();
    if (!form.url.trim()) return;
    setBusy(true); setAdding(true);
    try {
      const t = await token();
      const r = await fetch('/api/admin/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ action: 'add', ...form }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.ok === false) { setMsg(j.error || 'Could not add'); setAdding(false); setBusy(false); return; }
      setForm({ url: '', title: '', caption: '', group: form.group });
      await load();
      await revalidateSite(undefined, ['images']);
      flash(`Added. It appears on the shop within a minute.`);
    } catch (err) { setMsg(err.message); }
    setAdding(false); setBusy(false);
  }

  async function del(id) {
    if (!confirm('Delete this image link?')) return;
    try {
      const t = await token();
      const r = await fetch('/api/admin/images', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ action: 'delete', id }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg(j.error || 'Could not delete'); return; }
      await load();
      await revalidateSite(undefined, ['images']);
      flash('Image link deleted.');
    } catch (e) { setMsg(e.message); }
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-extrabold"><ImagesIcon className="text-gold" /> Images</h1>
          <p className="mt-1 text-sm text-dim">Add image links here. Muaaz Iqbal's pictures appear on his page, in the home feed and in the image sitemap (Google Images) automatically.</p>
        </div>
        <button type="button" className="btn-ghost" onClick={load}><RefreshCw size={15} /> Reload</button>
      </div>
      {msg && <p role="status" className="rounded-xl bg-raised p-3 text-sm text-cream">{msg}</p>}

      <div className="card">
        <h2 className="mb-3 text-lg font-extrabold"><Plus size={18} className="inline" /> Add an image link</h2>
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2"><span className="label">Image link (direct URL .jpg / .png / .webp)</span>
            <input className="input font-mono !text-sm" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://..." required /></label>
          <label className="block"><span className="label">Title (small line)</span>
            <input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Muaaz Iqbal, Kasur" /></label>
          <div className="block">
            <span className="label">Where it goes</span>
            <select className="input" value={form.group} onChange={(e) => setForm((f) => ({ ...f, group: e.target.value }))}>
              {GROUPS.map(([k, l]) => <option key={k} value={k}>{k}</option>)}
            </select>
            <p className="mt-1 text-[0.65rem] text-faint">{GROUPS.find((g) => g[0] === form.group)?.[1]}</p>
          </div>
          <label className="block sm:col-span-2"><span className="label">Caption (optional, shown under the photo)</span>
            <input className="input" value={form.caption} onChange={(e) => setForm((f) => ({ ...f, caption: e.target.value }))} /></label>
          <div className="sm:col-span-2 flex items-center gap-3">
            <button type="submit" className="btn-gold" disabled={busy}>{adding ? 'Adding...' : 'Add image'}</button>
            <span className="text-xs text-dim">Tip: use direct image links (ImgBB, Google Drive share link with /preview, your own hosting).</span>
          </div>
        </form>
      </div>

      <div className="card">
        <h2 className="mb-3 text-lg font-extrabold">Saved pictures ({images.length})</h2>
        {images.length === 0 ? <p className="text-sm text-dim">No pictures yet. Add Muaaz Iqbal's photos above - they show up on the shop and in the sitemap.</p> : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((im) => (
              <li key={im.id} className="rounded-xl border border-line p-2.5">
                <div className="overflow-hidden rounded-lg bg-raised">
                  {im.url ? <img src={im.url} alt={im.title || 'image'} loading="lazy" referrerPolicy="no-referrer" className="h-28 w-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : <div className="h-28 grid place-items-center text-faint text-xs">no image</div>}
                </div>
                <div className="mt-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <b className="block truncate text-sm">{im.title || 'Untitled'}</b>
                    <small className="text-dim">{im.group} · {im.url ? <a href={im.url} target="_blank" rel="noopener noreferrer" className="text-gold">open link</a> : 'no link'}</small>
                    {im.caption && <p className="mt-1 line-clamp-2 text-xs text-faint">{im.caption}</p>}
                  </div>
                  <button type="button" onClick={() => del(im.id)} className="text-red-400 p-1" aria-label="Delete"><Trash2 size={16} /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-dim">Want a full gallery page? <Link href="/muaaz-iqbal" className="text-gold underline">/muaaz-iqbal</Link> shows every picture added with the <code>muaaz</code> group.</p>
      </div>
    </div>
  );
}
