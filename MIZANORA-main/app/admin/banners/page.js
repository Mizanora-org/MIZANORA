'use client';
import { useCallback, useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { authClient, dbClient } from '@/lib/firebase-client';
import { revalidateSite } from '@/lib/admin-cache';
import ImageUploader from '@/components/ImageUploader';

const EMPTY = { id: '', image: '', title: '', subtitle: '', link: '/products', cta: 'Shop now', order: 1, active: true };

export default function AdminBanners() {
  const [list, setList] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const snap = await getDocs(collection(dbClient(), 'banners'));
    setList(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order || 0) - (b.order || 0)));
  }, []);
  useEffect(() => { load().catch((e) => setMsg(e.message)); }, [load]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const revalidate = () => revalidateSite();

  async function save(e) {
    e.preventDefault();
    if (!/^https?:\/\//.test(form.image.trim())) { setMsg('Paste a full image link that starts with https://'); return; }
    setBusy(true); setMsg('');
    try {
      const data = {
        image: form.image.trim(), title: form.title.trim(), subtitle: form.subtitle.trim(),
        link: form.link.trim() || '/products', cta: form.cta.trim() || 'Shop now',
        order: Number(form.order) || 0, active: Boolean(form.active), updatedAt: Date.now(),
      };
      if (form.id) await setDoc(doc(dbClient(), 'banners', form.id), data);
      else await addDoc(collection(dbClient(), 'banners'), data);
      await revalidate();
      setMsg('Banner saved. It is live on the home page.');
      setForm(EMPTY);
      await load();
    } catch (err) { setMsg(err.message); }
    setBusy(false);
  }

  async function remove(b) {
    if (!confirm('Delete this banner?')) return;
    await deleteDoc(doc(dbClient(), 'banners', b.id)); await revalidate(); await load();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
      <section>
        <h1 className="mb-1 text-4xl font-bold">Home banners</h1>
        <p className="mb-4 text-sm text-dim">Banners slide at the top of the home page. Use a wide image, about 1600 x 640 pixels. Smallest order number shows first.</p>
        {msg && <p role="status" className="mb-3 rounded-xl bg-raised p-3 text-sm text-cream">{msg}</p>}
        {!list ? <p className="text-dim">Loading...</p> : list.length === 0 ? <p className="card text-center text-dim">No banners yet. The home page shows the default Mizanora banner.</p> : (
          <ul className="space-y-3">
            {list.map((b) => (
              <li key={b.id} className="card !p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.image} alt="" className="aspect-[16/6] w-full rounded-xl bg-raised object-cover" />
                <div className="mt-2 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{b.title || '(no title)'} {b.active === false && <span className="text-xs text-red-700">(hidden)</span>}</p>
                    <p className="truncate text-sm text-dim">Order {b.order} · links to {b.link}</p>
                  </div>
                  <button className="btn-ghost !px-4 !py-2 text-sm" onClick={() => { setForm({ ...EMPTY, ...b }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>
                  <button className="px-2 text-sm text-red-700" onClick={() => remove(b)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form onSubmit={save} className="card h-fit space-y-3 lg:sticky lg:top-24">
        <h2 className="text-2xl font-semibold">{form.id ? 'Edit banner' : 'Add banner'}</h2>
        <div>
          <label className="label" htmlFor="bi">Banner image</label>
          <ImageUploader multiple={false} max={2000} label="Upload banner image" onUploaded={(urls) => setForm((f) => ({ ...f, image: urls[0] }))} />
          {form.image && (/* eslint-disable-next-line @next/next/no-img-element */ <img src={form.image} alt="" className="mt-2 aspect-[16/6] w-full rounded-xl bg-raised object-cover" />)}
          <input id="bi" className="input mt-2" value={form.image} onChange={set('image')} placeholder="Or paste an image link (https://...)" required />
        </div>
        <div><label className="label" htmlFor="bt">Title (optional)</label><input id="bt" className="input" value={form.title} onChange={set('title')} /></div>
        <div><label className="label" htmlFor="bs">Small text (optional)</label><input id="bs" className="input" value={form.subtitle} onChange={set('subtitle')} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="bl">Opens page</label><input id="bl" className="input" value={form.link} onChange={set('link')} placeholder="/category/footwear" /></div>
          <div><label className="label" htmlFor="bc">Button text</label><input id="bc" className="input" value={form.cta} onChange={set('cta')} /></div>
        </div>
        <div className="grid grid-cols-2 items-end gap-3">
          <div><label className="label" htmlFor="bo">Order</label><input id="bo" type="number" className="input" value={form.order} onChange={set('order')} /></div>
          <label className="flex items-center gap-2 pb-3 text-sm"><input type="checkbox" checked={Boolean(form.active)} onChange={set('active')} className="h-4 w-4 accent-[#0B6B45]" /> Visible</label>
        </div>
        <button className="btn-gold w-full" disabled={busy}>{busy ? 'Saving...' : 'Save banner'}</button>
        {form.id && <button type="button" className="btn-ghost w-full" onClick={() => setForm(EMPTY)}>Cancel edit</button>}
      </form>
    </div>
  );
}
