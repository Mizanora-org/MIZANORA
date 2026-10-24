'use client';
import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Field, Note, NumIn, Result, Row, Sel, TextIn } from './kit';
import * as L from '@/lib/toolsLogic';

const { money } = L;

export function CodProfit() {
  const [s, set] = useState({ price: '', cost: '', pack: '', ship: '', returnShip: '', ad: '', returnRate: '25', orders: '100' });
  const u = (k) => (v) => set((x) => ({ ...x, [k]: v }));
  const r = L.codProfit(s); const has = L.num(s.price) > 0;
  return (
    <div className="space-y-3">
      <Row><NumIn label="Selling price (Rs)" value={s.price} onChange={u('price')} /><NumIn label="Product cost (Rs)" value={s.cost} onChange={u('cost')} /></Row>
      <Row><NumIn label="Packing per parcel (Rs)" value={s.pack} onChange={u('pack')} /><NumIn label="Delivery charge you pay (Rs)" value={s.ship} onChange={u('ship')} /></Row>
      <Row><NumIn label="Return delivery charge (Rs)" value={s.returnShip} onChange={u('returnShip')} hint="What the courier charges to bring a refused parcel back." /><NumIn label="Ad cost per order (Rs)" value={s.ad} onChange={u('ad')} /></Row>
      <Row><NumIn label="Return / refused parcels (%)" value={s.returnRate} onChange={u('returnRate')} hint="In Pakistan COD this is often 15 to 35 percent." /><NumIn label="Orders to calculate" value={s.orders} onChange={u('orders')} /></Row>
      {has && <Result big={`${r.net >= 0 ? 'Profit' : 'Loss'} Rs ${money(Math.abs(r.net))}`} rows={[['Profit on one delivered parcel', `Rs ${money(r.perDelivered)}`], ['Loss on one returned parcel', `Rs ${money(-r.perReturned)}`], ['Delivered / returned', `${r.delivered} / ${r.returned}`], ['Average per order placed', `Rs ${money(r.perOrder)}`], ['Break-even return rate', `${money(r.breakEvenReturnPct)}%`]]} />}
      <Note>Break-even return rate is the share of refused parcels at which you earn nothing. Stay well below it. Honest photos and a confirmation call or WhatsApp message before dispatch lower returns.</Note>
    </div>
  );
}

const UNITS = [['g', 'gram'], ['kg', 'kg'], ['ml', 'ml'], ['l', 'litre'], ['pc', 'piece']];
const TO_BASE = { g: 1, kg: 1000, ml: 1, l: 1000, pc: 1 };
export function UnitPrice() {
  const [rows, setRows] = useState([{ name: 'Pack A', price: '', qty: '', unit: 'g' }, { name: 'Pack B', price: '', qty: '', unit: 'kg' }]);
  const patch = (i, p) => setRows((a) => a.map((x, n) => (n === i ? { ...x, ...p } : x)));
  const items = rows.map((x) => ({ name: x.name, price: x.price, qty: L.num(x.qty) * TO_BASE[x.unit] }));
  const res = L.unitCompare(items);
  const baseOf = (u) => (u === 'kg' || u === 'g' ? 'per 100 g' : u === 'l' || u === 'ml' ? 'per 100 ml' : 'per piece');
  return (
    <div className="space-y-3">
      <p className="text-sm text-dim">Put the price and the size of each pack. Use the same kind of unit (all weight, or all volume, or all pieces).</p>
      {rows.map((x, i) => (
        <div key={i} className="grid gap-2 rounded-2xl border border-line bg-surface p-3 sm:grid-cols-[1fr_1fr_1fr_8rem_auto]">
          <TextIn label="Name" value={x.name} onChange={(v) => patch(i, { name: v })} />
          <NumIn label="Price (Rs)" value={x.price} onChange={(v) => patch(i, { price: v })} />
          <NumIn label="Size" value={x.qty} onChange={(v) => patch(i, { qty: v })} />
          <Sel label="Unit" value={x.unit} onChange={(v) => patch(i, { unit: v })} options={UNITS} />
          {rows.length > 2 && <button type="button" className="self-end pb-2 text-red-600" onClick={() => setRows((a) => a.filter((_, n) => n !== i))} aria-label="Remove"><Trash2 size={18} /></button>}
        </div>
      ))}
      {rows.length < 6 && <button type="button" className="btn-ghost" onClick={() => setRows((a) => [...a, { name: `Pack ${String.fromCharCode(65 + a.length)}`, price: '', qty: '', unit: a[0].unit }])}>Add another pack</button>}
      {res.length > 0 && <Result big={`${res[0].name} is cheapest`} rows={res.map((x) => [x.name, `Rs ${money(x.per * (rows[0].unit === 'pc' ? 1 : 100))} ${baseOf(rows[0].unit)}${x.moreThanBestPct > 0.05 ? ` (+${money(x.moreThanBestPct)}%)` : ''}`])} />}
    </div>
  );
}

const KEY = 'mz_khata_v1';
export function Khata() {
  const [list, setList] = useState([]); const [name, setName] = useState(''); const [amt, setAmt] = useState(''); const [dir, setDir] = useState('get'); const [ready, setReady] = useState(false);
  useEffect(() => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); if (Array.isArray(v)) setList(v.slice(0, 500)); } catch (_) { /* storage blocked */ } setReady(true); }, []);
  useEffect(() => { if (ready) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (_) { /* storage blocked */ } } }, [list, ready]);
  const add = () => { const n = name.trim().slice(0, 40); const a = L.num(amt); if (!n || !a) return; setList((l) => [{ name: n, amount: dir === 'get' ? Math.abs(a) : -Math.abs(a), at: Date.now() }, ...l].slice(0, 500)); setAmt(''); };
  const t = L.khataTotals(list);
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_9rem_auto] sm:items-end">
        <TextIn label="Name" value={name} onChange={setName} placeholder="Ali bhai" />
        <NumIn label="Amount (Rs)" value={amt} onChange={setAmt} />
        <Sel label="Type" value={dir} onChange={setDir} options={[['get', 'Unho ne dene hain'], ['give', 'Mujhe dene hain']]} />
        <button type="button" className="btn-gold" onClick={add}>Add</button>
      </div>
      <Result big={`Milna hai Rs ${money(t.toReceive)}`} rows={[['Dena hai', `Rs ${money(t.toPay)}`], ['Net', `Rs ${money(t.toReceive - t.toPay)}`], ['People', String(t.people.length)]]} />
      {t.people.length > 0 && <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">{t.people.map((p) => <li key={p.name} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"><span className="font-semibold">{p.name}</span><span className={p.balance > 0 ? 'font-bold text-emerald-700' : 'font-bold text-red-600'}>{p.balance > 0 ? 'Milna' : 'Dena'} Rs {money(Math.abs(p.balance))}</span><button type="button" className="text-xs text-dim underline" onClick={() => setList((l) => l.filter((e) => String(e.name).trim().toLowerCase() !== p.name.toLowerCase()))}>Clear</button></li>)}</ul>}
      <Note>Your khata is saved only in this browser on this device. It is never sent anywhere. If you clear browser data it is gone, so write the important ones down too.</Note>
    </div>
  );
}

export function ImageShrink() {
  const [file, setFile] = useState(null); const [w, setW] = useState('1200'); const [q, setQ] = useState('0.8'); const [fmt, setFmt] = useState('image/jpeg');
  const [out, setOut] = useState(null); const [err, setErr] = useState(''); const url = useRef('');
  useEffect(() => () => { if (url.current) URL.revokeObjectURL(url.current); }, []);
  const run = async () => {
    setErr(''); setOut(null);
    if (!file) return;
    try {
      const bmp = await createImageBitmap(file);
      const maxW = Math.max(100, Math.min(4000, Math.floor(L.num(w)) || 1200));
      const k = Math.min(1, maxW / bmp.width);
      const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise((res) => c.toBlob(res, fmt, Number(q)));
      if (!blob) throw new Error('This browser could not make that format.');
      if (url.current) URL.revokeObjectURL(url.current);
      url.current = URL.createObjectURL(blob);
      setOut({ href: url.current, size: blob.size, w: c.width, h: c.height, ext: fmt === 'image/webp' ? 'webp' : 'jpg' });
    } catch (e) { setErr(e.message || 'This image could not be read.'); }
  };
  const kb = (n) => `${(n / 1024).toFixed(n > 1048576 ? 0 : 1)} KB`;
  return (
    <div className="space-y-3">
      <Field label="Choose a photo (it stays on your phone, nothing is uploaded)"><input type="file" accept="image/*" className="input" onChange={(e) => { setFile(e.target.files && e.target.files[0]); setOut(null); }} /></Field>
      <Row><NumIn label="Maximum width (pixels)" value={w} onChange={setW} /><Sel label="Quality" value={q} onChange={setQ} options={[['0.9', 'High (90%)'], ['0.8', 'Good (80%)'], ['0.6', 'Small (60%)'], ['0.4', 'Smallest (40%)']]} /></Row>
      <Sel label="Format" value={fmt} onChange={setFmt} options={[['image/jpeg', 'JPG (works everywhere)'], ['image/webp', 'WebP (smaller)']]} />
      <button type="button" className="btn-gold" disabled={!file} onClick={run}>Make it smaller</button>
      {err && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {out && <Result big={`${kb(out.size)}${file ? `  (was ${kb(file.size)})` : ''}`} rows={[['Size', `${out.w} x ${out.h}`], ['Saved', file ? `${Math.max(0, Math.round((1 - out.size / file.size) * 100))}%` : '']]} />}
      {out && <a href={out.href} download={`photo-small.${out.ext}`} className="btn-ghost inline-block">Download</a>}
      <Note>Smaller product photos load faster, so your page and WhatsApp sharing feel quicker. For the web, 800 to 1200 pixels wide at 80% quality is a good start.</Note>
    </div>
  );
}
