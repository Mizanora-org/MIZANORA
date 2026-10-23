'use client';
import { useEffect, useMemo, useState } from 'react';
import { Copy1, Field, Note, NumIn, Result, Row, Sel, TextIn } from './kit';
import * as L from '@/lib/toolsLogic';
const { num, money } = L;

export function Zakat() {
  const [s, set] = useState({ cash: '', goldG: '', silverG: '', goldPerG: '', silverPerG: '', business: '', receivable: '', other: '', debts: '', basis: 'silver', unit: 'gram' });
  const up = (k) => (v) => set((x) => ({ ...x, [k]: v }));
  const f = s.unit === 'tola' ? L.GRAMS_PER_TOLA : 1;
  const r = L.zakat({ ...s, goldG: num(s.goldG) * f, silverG: num(s.silverG) * f, goldPerG: num(s.goldPerG) / f, silverPerG: num(s.silverPerG) / f });
  return (
    <div className="space-y-3">
      <Row><Sel label="Gold and silver are entered in" value={s.unit} onChange={up('unit')} options={[['gram', 'Grams'], ['tola', 'Tola']]} /><Sel label="Nisab to use" value={s.basis} onChange={up('basis')} options={[['silver', 'Silver nisab (52.5 tola) - lower'], ['gold', 'Gold nisab (7.5 tola)']]} /></Row>
      <Row><NumIn label="Cash, bank, savings (Rs)" value={s.cash} onChange={up('cash')} /><NumIn label="Business stock and goods (Rs)" value={s.business} onChange={up('business')} /></Row>
      <Row><NumIn label={`Gold you own (${s.unit})`} value={s.goldG} onChange={up('goldG')} /><NumIn label={`Today's gold price per ${s.unit} (Rs)`} value={s.goldPerG} onChange={up('goldPerG')} hint="Type the market price of today." /></Row>
      <Row><NumIn label={`Silver you own (${s.unit})`} value={s.silverG} onChange={up('silverG')} /><NumIn label={`Today's silver price per ${s.unit} (Rs)`} value={s.silverPerG} onChange={up('silverPerG')} hint="Needed for the silver nisab." /></Row>
      <Row><NumIn label="Money others owe you and will return (Rs)" value={s.receivable} onChange={up('receivable')} /><NumIn label="Other zakatable wealth (Rs)" value={s.other} onChange={up('other')} /></Row>
      <NumIn label="Debts you must pay now (Rs)" value={s.debts} onChange={up('debts')} />
      <Result big={r.known ? `Zakat: Rs ${money(r.zakat)}` : 'Enter the price of gold/silver'} rows={[['Total wealth', `Rs ${money(r.assets)}`], ['After debts', `Rs ${money(r.net)}`], r.known && ['Nisab value', `Rs ${money(r.nisabValue)}`], r.known && ['Zakat farz?', r.due ? 'Yes (2.5%)' : 'No, below nisab']]} />
      <Note>This is a guide. Zakat is due on wealth that stayed above nisab for one lunar year. Ask a trusted scholar about your own case (shares, property for sale, gold jewellery for use).</Note>
    </div>
  );
}

export function HijriConverter() {
  const [d, setD] = useState(() => new Date().toISOString().slice(0, 10));
  const [off, setOff] = useState('-1');
  const [h, setH] = useState({ y: '', m: '1', d: '' });
  const [res, setRes] = useState(null);
  const names = ['Muharram', 'Safar', "Rabi' ul Awwal", "Rabi' ul Thani", 'Jumada ul Awwal', 'Jumada ul Thani', 'Rajab', "Sha'ban", 'Ramadan', 'Shawwal', "Dhul Qa'dah", 'Dhul Hijjah'];
  const hj = useMemo(() => { const t = new Date(`${d}T00:00:00Z`); return isNaN(t) ? null : L.hijriOf(t, Number(off)); }, [d, off]);
  return (
    <div className="space-y-5">
      <div><h2 className="mb-2 font-bold">English date to Hijri</h2>
        <Row><Field label="English date"><input type="date" className="input" value={d} onChange={(e) => setD(e.target.value)} /></Field><Sel label="Moon sighting adjustment" value={off} onChange={setOff} options={[['-1', 'Pakistan (usually 1 day after Saudi)'], ['0', 'Saudi Arabia (Umm al-Qura)'], ['-2', '2 days behind'], ['1', '1 day ahead']]} /></Row>
        {hj && <Result big={`${hj.day} ${names[hj.month - 1]} ${hj.year} AH`} rows={[['Day', hj.day], ['Month', `${names[hj.month - 1]} (${hj.month})`], ['Year', hj.year]]} />}
      </div>
      <div><h2 className="mb-2 font-bold">Hijri date to English</h2>
        <Row><NumIn label="Hijri year" value={h.y} onChange={(v) => setH({ ...h, y: v })} placeholder="1448" /><Sel label="Month" value={h.m} onChange={(v) => setH({ ...h, m: v })} options={names.map((n, i) => [String(i + 1), n])} /></Row>
        <div className="mt-3 flex items-end gap-3"><div className="flex-1"><NumIn label="Day" value={h.d} onChange={(v) => setH({ ...h, d: v })} placeholder="1" /></div><button type="button" className="btn-gold" onClick={() => { const t = L.gregorianFromHijri(num(h.y), num(h.m), num(h.d), Number(off)); setRes(t ? t.toDateString() : 'Not found: check the numbers (year 1300 to 1600, day 1 to 30).'); }}>Convert</button></div>
        {res && <Result big={res} rows={[]} />}
      </div>
      <Note>The result is a calculation. The real start of a month is decided by moon sighting.</Note>
    </div>
  );
}

export function IslamicCalendar() {
  const now = new Date();
  const [ym, setYm] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [off, setOff] = useState('-1');
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)); const days = new Date(Date.UTC(y, m, 0)).getUTCDate(); const lead = first.getUTCDay();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => { const dt = new Date(Date.UTC(y, m - 1, i + 1)); return { g: i + 1, h: L.hijriOf(dt, Number(off)) }; })];
  const today = new Date(); const isToday = (g) => today.getFullYear() === y && today.getMonth() + 1 === m && today.getDate() === g;
  const shift = (k) => { const t = new Date(Date.UTC(y, m - 1 + k, 1)); setYm(`${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`); };
  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <button type="button" className="btn-ghost" onClick={() => shift(-1)}>Previous</button>
        <Field label="Month"><input type="month" className="input" value={ym} onChange={(e) => e.target.value && setYm(e.target.value)} /></Field>
        <button type="button" className="btn-ghost" onClick={() => shift(1)}>Next</button>
        <div className="min-w-[12rem] flex-1"><Sel label="Moon sighting" value={off} onChange={setOff} options={[['-1', 'Pakistan'], ['0', 'Saudi Arabia']]} /></div>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-bold text-gold">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((x) => <div key={x}>{x}</div>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((c, i) => c ? <div key={i} className={`rounded-xl border p-1.5 text-center ${isToday(c.g) ? 'border-gold bg-gold/10' : 'border-line bg-surface'}`}><div className="text-base font-extrabold">{c.g}</div><div className="font-arabic text-[11px] text-gold">{c.h ? `${c.h.day}/${c.h.month}` : ''}</div></div> : <div key={i} />)}
      </div>
      <Note>Small text under each date is the Hijri day/month. Months: 1 Muharram, 9 Ramadan, 10 Shawwal, 12 Dhul Hijjah.</Note>
    </div>
  );
}

export function Qibla() {
  const [pos, setPos] = useState({ lat: '31.11', lng: '74.45' });
  const [msg, setMsg] = useState('');
  const r = L.qibla(num(pos.lat), num(pos.lng));
  const locate = () => { if (!navigator.geolocation) { setMsg('Your browser cannot give the location. Type it below.'); return; } setMsg('Finding...'); navigator.geolocation.getCurrentPosition((p) => { setPos({ lat: p.coords.latitude.toFixed(4), lng: p.coords.longitude.toFixed(4) }); setMsg('Location found. Nothing was sent anywhere.'); }, () => setMsg('Location not allowed. Type your latitude and longitude.'), { timeout: 10000 }); };
  return (
    <div className="space-y-3">
      <button type="button" className="btn-gold w-full" onClick={locate}>Use my location</button>
      {msg && <p className="text-sm text-dim">{msg}</p>}
      <Row><NumIn label="Latitude" value={pos.lat} onChange={(v) => setPos({ ...pos, lat: v })} /><NumIn label="Longitude" value={pos.lng} onChange={(v) => setPos({ ...pos, lng: v })} /></Row>
      <div className="mx-auto grid h-56 w-56 place-items-center rounded-full border-4 border-gold bg-gradient-to-br from-white to-raised shadow-inner" aria-label="Compass">
        <div className="relative h-full w-full"><span className="absolute left-1/2 top-1 -translate-x-1/2 text-xs font-bold">N</span><span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs font-bold">S</span><span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold">W</span><span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold">E</span>
          <div className="absolute inset-0 grid place-items-center" style={{ transform: `rotate(${r.bearing}deg)` }}><div className="flex h-44 flex-col items-center"><span className="text-3xl">🕋</span><span className="h-16 w-1.5 rounded bg-gold" /></div></div></div>
      </div>
      <Result big={`${r.bearing.toFixed(1)}° from North`} rows={[['Distance to Kaaba', `${Math.round(r.km).toLocaleString()} km`], ['Hold the phone', 'flat, North up, face the arrow']]} />
      <Note>The arrow points from North (top of the dial). For the real direction on the ground use a compass app and turn to the same angle.</Note>
    </div>
  );
}

export function Tasbih() {
  const [n, setN] = useState(0); const [t, setT] = useState(33); const [ready, setReady] = useState(false);
  useEffect(() => { try { const j = JSON.parse(localStorage.getItem('mz_tasbih') || '{}'); if (j.n) setN(j.n); if (j.t) setT(j.t); } catch (_) { /* none */ } setReady(true); }, []);
  useEffect(() => { if (ready) try { localStorage.setItem('mz_tasbih', JSON.stringify({ n, t })); } catch (_) { /* blocked */ } }, [n, t, ready]);
  const tap = () => { const v = n + 1; setN(v); try { if (navigator.vibrate) navigator.vibrate(v % t === 0 ? [60, 40, 60] : 12); } catch (_) { /* no vibration */ } };
  return (
    <div className="text-center">
      <button type="button" onClick={tap} aria-label="Count" className="mx-auto grid h-56 w-56 select-none place-items-center rounded-full bg-gradient-to-br from-[#0E8556] to-[#06402a] text-white shadow-2xl active:scale-95"><span className="text-6xl font-extrabold">{n}</span></button>
      <p className="mt-3 text-sm text-dim">Round {Math.floor(n / t) + 1} · {n % t}/{t}</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">{[33, 99, 100, 313, 1000].map((x) => <button key={x} type="button" onClick={() => setT(x)} className={`rounded-full border px-4 py-1.5 text-sm font-bold ${t === x ? 'border-gold bg-gold text-white' : 'border-line bg-surface'}`}>{x}</button>)}</div>
      <button type="button" className="btn-ghost mt-4" onClick={() => setN(0)}>Reset</button>
    </div>
  );
}

export function SciCalc() {
  const [e, setE] = useState('');
  const r = e.trim() ? L.calc(e) : null;
  const keys = ['7', '8', '9', '/', '(', ')', '4', '5', '6', '*', '^', '%', '1', '2', '3', '-', 'sqrt(', 'pi', '0', '.', '+', 'sin(', 'cos(', 'tan(', 'log(', 'ln(', 'e', 'abs('];
  return (
    <div className="mx-auto max-w-md">
      <input className="input font-mono text-lg" value={e} onChange={(x) => setE(x.target.value)} placeholder="(12+8)*5/4" aria-label="Expression" />
      <p className={`mt-2 min-h-[2.5rem] text-right text-3xl font-extrabold ${r && !r.ok ? 'text-base text-red-600' : 'text-gold'}`}>{r ? (r.ok ? r.value.toLocaleString('en-US', { maximumFractionDigits: 10 }) : r.error) : ''}</p>
      <div className="mt-2 grid grid-cols-6 gap-1.5">{keys.map((k) => <button key={k} type="button" onClick={() => setE((v) => v + k)} className="rounded-xl border border-line bg-surface py-3 font-bold active:bg-gold/10">{k}</button>)}
        <button type="button" onClick={() => setE((v) => v.slice(0, -1))} className="col-span-3 rounded-xl border border-line bg-raised py-3 font-bold">Back</button><button type="button" onClick={() => setE('')} className="col-span-3 rounded-xl border border-line bg-raised py-3 font-bold">Clear</button></div>
      <p className="mt-2 text-xs text-faint">Angles are in degrees. 50% means 0.5.</p>
    </div>
  );
}

export function Percentage() {
  const [a, setA] = useState({ p: '', n: '', x: '', y: '', o: '', w: '' });
  const u = (k) => (v) => setA((s) => ({ ...s, [k]: v }));
  return (
    <div className="space-y-6">
      <div><h2 className="mb-2 font-bold">What is X% of Y?</h2><Row><NumIn label="Percent" value={a.p} onChange={u('p')} /><NumIn label="Number" value={a.n} onChange={u('n')} /></Row><Result big={money(L.percentOf(a.p, a.n))} rows={[]} /></div>
      <div><h2 className="mb-2 font-bold">X is what % of Y? (marks, shares)</h2><Row><NumIn label="X (obtained)" value={a.x} onChange={u('x')} /><NumIn label="Y (total)" value={a.y} onChange={u('y')} /></Row><Result big={`${money(L.whatPercent(a.x, a.y))}%`} rows={[]} /></div>
      <div><h2 className="mb-2 font-bold">Percent increase / decrease</h2><Row><NumIn label="Old value" value={a.o} onChange={u('o')} /><NumIn label="New value" value={a.w} onChange={u('w')} /></Row><Result big={`${money(L.percentChange(a.o, a.w))}%`} rows={[]} /></div>
    </div>
  );
}

export function Discount() {
  const [s, set] = useState({ p: '', d: '', d2: '' }); const u = (k) => (v) => set((x) => ({ ...x, [k]: v }));
  const r = L.discount(s.p, s.d, s.d2);
  return (<div className="space-y-3"><NumIn label="Original price (Rs)" value={s.p} onChange={u('p')} /><Row><NumIn label="Discount %" value={s.d} onChange={u('d')} /><NumIn label="Extra discount % (optional)" value={s.d2} onChange={u('d2')} /></Row><Result big={`Pay Rs ${money(r.final)}`} rows={[['You save', `Rs ${money(r.saved)}`], ['Total discount', `${money(r.total)}%`]]} /></div>);
}

export function Margin() {
  const [s, set] = useState({ c: '', s: '' }); const u = (k) => (v) => set((x) => ({ ...x, [k]: v }));
  const r = L.margin(s.c, s.s);
  return (<div className="space-y-3"><Row><NumIn label="Total cost (Rs): product + delivery + ads" value={s.c} onChange={u('c')} /><NumIn label="Selling price (Rs)" value={s.s} onChange={u('s')} /></Row><Result big={`Profit Rs ${money(r.profit)}`} rows={[['Margin', `${money(r.margin)}%`], ['Markup', `${money(r.markup)}%`]]} /></div>);
}

export function Emi() {
  const [s, set] = useState({ p: '', r: '', m: '' }); const u = (k) => (v) => set((x) => ({ ...x, [k]: v }));
  const r = L.emi(s.p, s.r, s.m || 1);
  return (<div className="space-y-3"><NumIn label="Loan amount (Rs)" value={s.p} onChange={u('p')} /><Row><NumIn label="Yearly interest / profit rate %" value={s.r} onChange={u('r')} /><NumIn label="Months" value={s.m} onChange={u('m')} /></Row><Result big={`Rs ${money(r.emi)} / month`} rows={[['Total payment', `Rs ${money(r.total)}`], ['Total interest', `Rs ${money(r.interest)}`]]} /></div>);
}

export function Bmi() {
  const [s, set] = useState({ kg: '', cm: '' }); const u = (k) => (v) => set((x) => ({ ...x, [k]: v }));
  const r = L.bmi(s.kg, s.cm);
  return (<div className="space-y-3"><Row><NumIn label="Weight (kg)" value={s.kg} onChange={u('kg')} /><NumIn label="Height (cm)" value={s.cm} onChange={u('cm')} hint="5 ft 7 in is about 170 cm" /></Row>{r && <Result big={`BMI ${r.bmi.toFixed(1)}: ${r.cat}`} rows={[['Normal range', '18.5 to 24.9']]} />}<Note>A rough guide for adults only. See a doctor for health advice.</Note></div>);
}

export function Age() {
  const [d, setD] = useState('');
  const r = d ? L.ageOf(d) : null;
  return (<div className="space-y-3"><Field label="Date of birth"><input type="date" className="input" value={d} onChange={(e) => setD(e.target.value)} /></Field>{r && <Result big={`${r.years} years, ${r.months} months, ${r.days} days`} rows={[['Total days lived', r.totalDays.toLocaleString()], ['Next birthday in', `${r.nextBirthdayIn} days`]]} />}<Note>Your date of birth is not saved or sent anywhere.</Note></div>);
}

export function DateDiff() {
  const t = new Date().toISOString().slice(0, 10); const [a, setA] = useState(t); const [b, setB] = useState('');
  const r = a && b ? L.daysBetween(a, b) : null;
  return (<div className="space-y-3"><Row><Field label="From"><input type="date" className="input" value={a} onChange={(e) => setA(e.target.value)} /></Field><Field label="To"><input type="date" className="input" value={b} onChange={(e) => setB(e.target.value)} /></Field></Row>{r && <Result big={`${r.days} days`} rows={[['Weeks', r.weeks.toFixed(1)], ['Months (approx.)', r.months.toFixed(1)]]} />}</div>);
}

export function SalesTax() {
  const [s, set] = useState({ a: '', r: '18', inc: 'no' }); const u = (k) => (v) => set((x) => ({ ...x, [k]: v }));
  const r = L.tax(s.a, s.r, s.inc === 'yes');
  return (<div className="space-y-3"><NumIn label="Amount (Rs)" value={s.a} onChange={u('a')} /><Row><NumIn label="Tax rate %" value={s.r} onChange={u('r')} hint="Check the official rate for your goods." /><Sel label="The amount already includes tax?" value={s.inc} onChange={u('inc')} options={[['no', 'No, add tax'], ['yes', 'Yes, take tax out']]} /></Row><Result big={`Total Rs ${money(r.total)}`} rows={[['Price without tax', `Rs ${money(r.base)}`], ['Tax', `Rs ${money(r.tax)}`]]} /></div>);
}

export function Words() {
  const [v, setV] = useState('');
  const w = L.rupeesInWords(v);
  return (<div className="space-y-3"><NumIn label="Amount (Rs)" value={v} onChange={setV} placeholder="1250000.50" />{num(v) !== 0 && <><Result big={w} rows={[['Amount', `Rs ${money(num(v))}`]]} /><Copy1 text={w} /></>}</div>);
}

export function Units() {
  const groups = Object.keys(L.UNITS);
  const [g, setG] = useState('Land'); const [from, setFrom] = useState('kanal'); const [to, setTo] = useState('marla'); const [v, setV] = useState('1');
  const pick = (x) => { setG(x); const k = Object.keys(L.UNITS[x].u); setFrom(k[0]); setTo(k[1] || k[0]); };
  const out = L.convertUnit(g, from, to, num(v));
  const keys = Object.keys(L.UNITS[g].u);
  return (<div className="space-y-3"><div className="flex flex-wrap gap-2">{groups.map((x) => <button key={x} type="button" onClick={() => pick(x)} className={`rounded-full border px-4 py-1.5 text-sm font-bold ${g === x ? 'border-gold bg-gold text-white' : 'border-line bg-surface'}`}>{x}</button>)}</div>
    <NumIn label="Value" value={v} onChange={setV} /><Row><Sel label="From" value={from} onChange={setFrom} options={keys} /><Sel label="To" value={to} onChange={setTo} options={keys} /></Row>
    <Result big={`${Number.isFinite(out) ? Number(out.toPrecision(10)).toLocaleString('en-US', { maximumFractionDigits: 6 }) : '-'} ${to}`} rows={[]} />
    <Note>{g === 'Land' ? '1 marla = 272.25 sq ft, 1 kanal = 20 marla. A local marla can differ: check your record.' : g === 'Gold' ? '1 tola = 11.664 g = 12 masha = 96 ratti.' : 'Values are standard conversions.'}</Note></div>);
}
