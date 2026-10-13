'use client';
import { useCallback, useEffect, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { dbClient, authClient } from '@/lib/firebase-client';
import { formatPKR, slugify } from '@/lib/format';
import ImageUploader from '@/components/ImageUploader';
import ProductPromo from '@/components/ProductPromo';
import { catsOf, splitCats } from '@/lib/cats';
import { DEPARTMENTS } from '@/lib/departments';
import { parseVideo } from '@/lib/video';
import { readCache, writeCache, revalidateSite } from '@/lib/admin-cache';
import { optionsOf, optionsToText, templateFor, textToOptions, textToSpecs } from '@/lib/options';

const EMPTY = { name: '', slug: '', price: '', comparePrice: '', category: '', description: '', images: '', videos: '', options: '', specs: '', inStock: true, featured: false, active: true, affOn: true, affRate: '' };
const SAMPLE = {
  name: 'Tactical Boots', slug: 'tactical-boots', price: 3500, comparePrice: 0, category: 'Footwear',
  description: 'Lace-up, side-zip tactical boots in sand colour for work, hiking and everyday wear.\n\nEdit this text, the price and the photos in the admin panel.',
  images: [], options: 'Size: 40, 41, 42, 43, 44, 45', specs: '', inStock: true, featured: true, active: true,
};

export default function AdminProducts() {
  const [list, setList] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [catDraft, setCatDraft] = useState('');

  const byNew = (a, b) => (b.createdAt || 0) - (a.createdAt || 0);
  // Reads Firestore only when there is no fresh copy in this browser session (or when you press Refresh).
  const load = useCallback(async (force) => {
    const hit = !force && readCache('products');
    if (hit) { setList(hit); return; }
    const snap = await getDocs(collection(dbClient(), 'products'));
    const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byNew);
    writeCache('products', rows);
    setList(rows);
  }, []);
  useEffect(() => { load().catch((e) => setMsg(e.message)); }, [load]);
  // After a save/delete we update the list in memory instead of re-reading every product.
  const patchList = (fn) => setList((cur) => { const next = fn(cur || []).sort(byNew); writeCache('products', next); return next; });

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: v, ...(k === 'name' && !editing ? { slug: slugify(v) } : {}) }));
  };

  const revalidate = revalidateSite;

  async function save(data, isNew) {
    const slug = slugify(data.slug || data.name);
    if (!data.name || !slug) { setMsg('Name is required.'); return; }
    const price = Number(data.price);
    if (!(price > 0)) { setMsg('Enter a valid price in PKR.'); return; }
    setBusy(true); setMsg('');
    try {
      const existing = (list || []).find((p) => p.id === slug);
      if (isNew && existing) { setMsg('A product with this slug already exists. Edit it from the list.'); setBusy(false); return; }
      const now = Date.now();
      const toArr = (v) => (Array.isArray(v) ? v : String(v || '').split(/[\n,]/)).map((x) => String(x).trim()).filter(Boolean);
      const payload = {
        name: data.name.trim(), price, comparePrice: Number(data.comparePrice) || 0, category: splitCats(data.category)[0] || '', categories: splitCats(data.category),
        description: (data.description || '').trim(), images: toArr(data.images), videos: toArr(data.videos), options: textToOptions(data.options), sizes: [], specs: textToSpecs(data.specs),
        inStock: Boolean(data.inStock), featured: Boolean(data.featured), active: Boolean(data.active),
        affOn: data.affOn !== false, affRate: Math.min(50, Math.max(0, Number(data.affRate) || 0)),
        createdAt: existing ? existing.createdAt || now : now, updatedAt: now,
      };
      await setDoc(doc(dbClient(), 'products', slug), payload);
      patchList((cur) => [...cur.filter((x) => x.id !== slug), { id: slug, ...payload }]);
      await revalidate(slug);
      setMsg(`Saved "${data.name}". It is live on the shop now.`);
      setForm(EMPTY); setEditing(false); setShowForm(false);
    } catch (e) { setMsg(e && e.code === 'permission-denied' ? 'Permission denied: your account is not the admin in Firestore rules. Paste your UID/email in firestore.rules and click Publish.' : (e && e.message) || 'Could not save.'); }
    setBusy(false);
  }

  // One-tap changes from the list (no need to open the form): sold out / in stock, hide / show.
  async function flip(p, field) {
    const next = field === 'active' ? p.active === false : p.inStock === false;
    try {
      const now = Date.now();
      await updateDoc(doc(dbClient(), 'products', p.id), { [field]: next, updatedAt: now });
      patchList((cur) => cur.map((x) => (x.id === p.id ? { ...x, [field]: next, updatedAt: now } : x)));
      await revalidate(p.id);
      setMsg(`${p.name}: ${field === 'active' ? (next ? 'now visible' : 'now hidden') : (next ? 'now in stock' : 'now sold out')}.`);
    } catch (e) { setMsg((e && e.message) || 'Could not update.'); }
  }
  // Start a new product from an existing one (same photos, options, details). Change the name and save.
  const duplicate = (p) => {
    setEditing(false);
    setForm({ ...EMPTY, ...p, name: `${p.name} (copy)`, slug: slugify(`${p.name} copy`), category: catsOf(p).join(', '), price: p.price, comparePrice: p.comparePrice || '', images: (p.images || []).join('\n'), videos: (p.videos || []).join('\n'), options: optionsToText(optionsOf(p)), specs: (p.specs || []).join('\n') });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const edit = (p) => {
    setEditing(true);
    setForm({ ...EMPTY, ...p, category: catsOf(p).join(', '), slug: p.id, price: p.price, comparePrice: p.comparePrice || '', images: (p.images || []).join('\n'), videos: (p.videos || []).join('\n'), options: optionsToText(optionsOf(p)), specs: (p.specs || []).join('\n') });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  async function remove(p) {
    if (!confirm(`Delete "${p.name}" permanently?`)) return;
    await deleteDoc(doc(dbClient(), 'products', p.id)); patchList((cur) => cur.filter((x) => x.id !== p.id)); await revalidate(p.id);
  }

  return (
    <div className="grid min-w-0 gap-8 lg:grid-cols-[1fr_24rem]">
      <section className={`min-w-0 ${showForm ? 'hidden lg:block' : ''}`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-3xl font-extrabold sm:text-4xl">Products</h1>
          <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => load(true).catch((e) => setMsg(e.message))}>Refresh list</button>
          <button type="button" className="btn-gold !px-5 !py-2.5 lg:hidden" onClick={() => { setForm(EMPTY); setEditing(false); setShowForm(true); window.scrollTo({ top: 0 }); }}>+ Add product</button>
        </div>
        {msg && <p role="status" className="mb-3 rounded-xl bg-raised p-3 text-sm text-cream">{msg}</p>}
        {!list ? <p className="text-dim">Loading...</p> : list.length === 0 ? (
          <div className="card text-center">
            <p className="text-dim">No products yet.</p>
            <button className="btn-ghost mt-3" disabled={busy} onClick={() => save(SAMPLE, true)}>Add a sample product (Tactical Boots)</button>
          </div>
        ) : (
          <ul className="space-y-2">
            {list.map((p) => (
              <li key={p.id} className="card !p-3">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{p.name} {p.active === false && <span className="text-xs text-red-700">(hidden)</span>}</p>
                    <p className="truncate text-sm text-dim">{formatPKR(p.price)} · {p.inStock === false ? 'Sold out' : 'In stock'}{p.featured ? ' · Featured' : ''}{catsOf(p).length ? ` · ${catsOf(p).join(', ')}` : ''}</p>
                  </div>
                  <button className="btn-ghost !px-4 !py-2 text-sm" onClick={() => edit(p)}>Edit</button>
                  <button className="px-2 text-sm text-red-700" onClick={() => remove(p)}>Delete</button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-semibold">
                  <button type="button" className="rounded-full bg-raised px-3 py-1.5 text-dim hover:text-gold" onClick={() => flip(p, 'inStock')}>{p.inStock === false ? 'Mark in stock' : 'Mark sold out'}</button>
                  <button type="button" className="rounded-full bg-raised px-3 py-1.5 text-dim hover:text-gold" onClick={() => flip(p, 'active')}>{p.active === false ? 'Show on shop' : 'Hide from shop'}</button>
                  <button type="button" className="rounded-full bg-raised px-3 py-1.5 text-dim hover:text-gold" onClick={() => duplicate(p)}>Duplicate</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form className={`card h-fit min-w-0 space-y-3 lg:sticky lg:top-24 ${showForm ? '' : 'hidden lg:block'}`} onSubmit={(e) => { e.preventDefault(); save({ ...form, category: splitCats([form.category, catDraft].join(',')).join(', ') }, !editing); setCatDraft(''); }}>
        <button type="button" className="text-sm font-bold text-gold lg:hidden" onClick={() => { setForm(EMPTY); setEditing(false); setShowForm(false); }}>&larr; Back to products</button>
        <h2 className="text-2xl font-extrabold">{editing ? 'Edit product' : 'Add product'}</h2>
        <div><label className="label" htmlFor="pn">Name</label><input id="pn" className="input" value={form.name} onChange={set('name')} required /></div>
        <div><label className="label" htmlFor="ps">URL slug</label><input id="ps" className="input" value={form.slug} onChange={set('slug')} disabled={editing} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="pp">Price (PKR)</label><input id="pp" type="number" min="1" className="input" value={form.price} onChange={set('price')} required /></div>
          <div><label className="label" htmlFor="pc">Old price</label><input id="pc" type="number" min="0" className="input" value={form.comparePrice} onChange={set('comparePrice')} /></div>
        </div>
        {(() => {
          const chosen = splitCats(form.category);
          const known = [...new Set([...(list || []).flatMap((x) => catsOf(x)), ...DEPARTMENTS.map((d) => d.name)])].filter((c) => !chosen.some((x) => x.toLowerCase() === c.toLowerCase()));
          const write = (arr) => setForm((f) => ({ ...f, category: arr.join(', ') }));
          const add = (name) => { const next = splitCats([...chosen, name].join(',')); write(next); setCatDraft(''); };
          return (
            <div>
              <label className="label" htmlFor="pk">Categories <span className="font-normal text-faint">(a product can be in many)</span></label>
              {chosen.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {chosen.map((c, n) => (
                    <span key={c} className="inline-flex items-center gap-1 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-white">
                      {c}{n === 0 && <span className="rounded bg-white/25 px-1 text-[0.6rem]">main</span>}
                      <button type="button" aria-label={`Remove ${c}`} onClick={() => write(chosen.filter((x) => x !== c))} className="ml-0.5 font-bold">x</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input id="pk" className="input !py-2.5" value={catDraft} onChange={(e) => setCatDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (catDraft.trim()) add(catDraft); } }} placeholder="Type a category, press Enter" />
                <button type="button" className="btn-ghost !px-4 !py-2.5 text-sm" onClick={() => catDraft.trim() && add(catDraft)}>Add</button>
              </div>
              {known.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {known.slice(0, 24).map((c) => <button key={c} type="button" onClick={() => add(c)} className="rounded-full bg-raised px-3 py-1.5 text-xs font-semibold text-dim hover:text-gold">+ {c}</button>)}
                </div>
              )}
            </div>
          );
        })()}
        <div><label className="label" htmlFor="pd">Description</label><textarea id="pd" rows={5} className="input" value={form.description} onChange={set('description')} /></div>
        <div>
          <label className="label" htmlFor="pi">Photos (first photo is the main one)</label>
          <ImageUploader onUploaded={(urls) => setForm((f) => ({ ...f, images: [f.images, ...urls].filter(Boolean).join('\n') }))} />
          {String(form.images || '').split('\n').filter(Boolean).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {String(form.images).split('\n').filter(Boolean).map((u, i) => (
                <div key={u + i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" className="h-16 w-16 rounded-lg bg-raised object-cover" />
                  <button type="button" aria-label="Remove photo" onClick={() => setForm((f) => ({ ...f, images: String(f.images).split('\n').filter((x, n) => x && n !== i).join('\n') }))}
                    className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-red-600 text-xs text-white">x</button>
                </div>
              ))}
            </div>
          )}
          <textarea id="pi" rows={2} className="input mt-2" value={form.images} onChange={set('images')} placeholder="Or paste image links here, one per line" />
        </div>
        <div>
          <label className="label" htmlFor="pv">Video links (optional, one per line)</label>
          <textarea id="pv" rows={2} className="input" value={form.videos} onChange={set('videos')} placeholder="YouTube, Facebook, Instagram reel, TikTok or .mp4 link" />
          {String(form.videos || '').split('\n').map((x) => x.trim()).filter(Boolean).map((u) => (
            <p key={u} className={`mt-1 truncate text-xs ${parseVideo(u) ? 'text-gold' : 'text-red-600'}`}>{parseVideo(u) ? `OK: ${parseVideo(u).label}` : 'Not supported'} - {u}</p>
          ))}
        </div>
        {(() => {
          const t = templateFor(splitCats(form.category)[0] || '');
          const parsed = textToOptions(form.options);
          const addLine = (key, line) => setForm((f) => ({ ...f, [key]: [String(f[key] || '').trim(), line].filter(Boolean).join('\n') }));
          return (
            <>
              <div>
                <label className="label" htmlFor="po">Options shoppers choose (colour, size, storage ...)</label>
                <p className="mb-1.5 text-xs text-faint">One option per line, like <b>Color: Red, Blue, Black</b>. Tap a suggestion for this category:</p>
                <div className="mb-2 flex flex-wrap gap-1.5">{t.options.map((o) => <button key={o} type="button" onClick={() => addLine('options', o)} className="rounded-full bg-raised px-3 py-1.5 text-xs font-semibold text-dim hover:text-gold">+ {o.split(':')[0]}</button>)}</div>
                <textarea id="po" rows={3} className="input" value={form.options} onChange={set('options')} placeholder={'Color: Red, Blue, Black\nSize: S, M, L'} />
                {parsed.map((o) => <p key={o.name} className="mt-1 text-xs text-gold">{o.name}: {o.values.length} choice{o.values.length > 1 ? 's' : ''}</p>)}
              </div>
              <div>
                <label className="label" htmlFor="pq">Product details (material, brand, warranty ...)</label>
                <p className="mb-1.5 text-xs text-faint">One per line, like <b>Material: Katan silk</b>. Tap to add a line:</p>
                <div className="mb-2 flex flex-wrap gap-1.5">{t.specs.map((k) => <button key={k} type="button" onClick={() => addLine('specs', `${k}: `)} className="rounded-full bg-raised px-3 py-1.5 text-xs font-semibold text-dim hover:text-gold">+ {k}</button>)}</div>
                <textarea id="pq" rows={3} className="input" value={form.specs} onChange={set('specs')} placeholder={'Fabric: Katan silk\nPieces: 3'} />
              </div>
            </>
          );
        })()}
        <div className="flex flex-wrap gap-4 text-sm">
          {[['inStock', 'In stock'], ['featured', 'Featured on home'], ['active', 'Visible']].map(([k, l]) => (
            <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={Boolean(form[k])} onChange={set(k)} className="h-4 w-4 accent-[#0B6B45]" /> {l}</label>
          ))}
        </div>
        <div className="rounded-xl bg-raised p-3 text-sm">
          <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={form.affOn !== false} onChange={set('affOn')} className="h-4 w-4 accent-[#0B6B45]" /> Workers can earn commission on this product</label>
          {form.affOn !== false && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label htmlFor="afr" className="text-dim">Max commission % for this product (blank = worker's level rate, 10% to 50%)</label>
              <input id="afr" className="input !w-24 !py-2" inputMode="numeric" value={form.affRate} onChange={(e) => setForm((f) => ({ ...f, affRate: e.target.value.replace(/\D/g, '').slice(0, 2) }))} placeholder="e.g. 15" />
            </div>
          )}
        </div>
        {editing && form.slug ? <ProductPromo slug={form.slug} name={form.name} /> : <p className="rounded-xl bg-raised p-2.5 text-xs text-dim">Save the product first, then edit it to add promo codes for this product.</p>}
        <button className="btn-gold w-full" disabled={busy}>{busy ? 'Saving...' : 'Save product'}</button>
        {editing && <button type="button" className="btn-ghost w-full" onClick={() => { setForm(EMPTY); setEditing(false); setShowForm(false); }}>Cancel</button>}
      </form>
    </div>
  );
}
