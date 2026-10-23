'use client';
import { useEffect, useMemo, useState } from 'react';
import { Copy1, Field, Note, NumIn, Result, Row, Sel, TextIn } from './kit';
import * as L from '@/lib/toolsLogic';
import { LINUX, LINUX_GROUPS } from '@/lib/linuxCommands';

export function LinuxSheet() {
  const [q, setQ] = useState(''); const [g, setG] = useState('All'); const [n, setN] = useState(60);
  const list = useMemo(() => { const w = q.toLowerCase().split(/\s+/).filter(Boolean); return LINUX.filter((x) => (g === 'All' || x.g === g) && w.every((t) => `${x.c} ${x.d} ${x.g}`.toLowerCase().includes(t))); }, [q, g]);
  return (
    <div>
      <input className="input" placeholder="Search: copy, port, permission, log, zip..." value={q} onChange={(e) => { setQ(e.target.value); setN(60); }} aria-label="Search commands" />
      <div className="no-sb mt-2 flex gap-2 overflow-x-auto pb-1">{['All', ...LINUX_GROUPS].map((x) => <button key={x} type="button" onClick={() => { setG(x); setN(60); }} className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${g === x ? 'border-gold bg-gold text-white' : 'border-line bg-surface'}`}>{x}</button>)}</div>
      <p className="mt-2 text-xs text-faint">{list.length} commands</p>
      <ul className="mt-2 divide-y divide-line rounded-2xl border border-line bg-surface">
        {list.slice(0, n).map((x) => <li key={x.c + x.d} className="flex items-start justify-between gap-3 p-3"><div className="min-w-0"><code className="block break-all rounded bg-[#10241b] px-2 py-1 text-sm text-[#7CF2B2]">{x.c}</code><p className="mt-1 text-sm text-dim">{x.d} <span className="text-xs text-faint">· {x.g}</span></p></div><Copy1 text={x.c} /></li>)}
        {!list.length && <li className="p-4 text-sm text-dim">No command found. Try another word.</li>}
      </ul>
      {list.length > n && <button type="button" className="btn-ghost mt-3 w-full" onClick={() => setN(n + 60)}>Show more</button>}
      <Note>Be careful with rm, chmod -R and anything with sudo: read the command twice before you press Enter.</Note>
    </div>
  );
}

export function Chmod() {
  const [p, setP] = useState({ r: [1, 1, 1], w: [1, 0, 0], x: [1, 1, 1] });
  const tog = (k, i) => setP((s) => ({ ...s, [k]: s[k].map((v, j) => (j === i ? (v ? 0 : 1) : v)) }));
  const r = L.chmod(p);
  const rows = [['Read (4)', 'r'], ['Write (2)', 'w'], ['Execute (1)', 'x']];
  return (<div><div className="overflow-x-auto"><table className="w-full text-center text-sm"><thead><tr className="text-gold"><th className="p-2 text-left" /><th>Owner</th><th>Group</th><th>Others</th></tr></thead><tbody>{rows.map(([l, k]) => <tr key={k} className="border-t border-line"><td className="p-2 text-left font-semibold">{l}</td>{[0, 1, 2].map((i) => <td key={i}><input type="checkbox" className="h-6 w-6 accent-[#0B6B45]" checked={!!p[k][i]} onChange={() => tog(k, i)} aria-label={`${l} ${['owner', 'group', 'others'][i]}`} /></td>)}</tr>)}</tbody></table></div>
    <Result big={`chmod ${r.octal} file`} rows={[['Number', r.octal], ['Symbolic', r.symbolic]]} /><div className="mt-2"><Copy1 text={`chmod ${r.octal} file`} /></div>
    <Note>755 for folders and programs, 644 for normal files. Avoid 777.</Note></div>);
}

export function Cron() {
  const [f, setF] = useState(['*/5', '*', '*', '*', '*']);
  const expr = f.join(' ');
  const pre = [['Every minute', '* * * * *'], ['Every 5 minutes', '*/5 * * * *'], ['Every hour', '0 * * * *'], ['Daily at 3:00', '0 3 * * *'], ['Weekdays at 9:30', '30 9 * * 1-5'], ['Every Sunday at midnight', '0 0 * * 0'], ['1st of each month', '0 0 1 * *']];
  const names = ['Minute (0-59)', 'Hour (0-23)', 'Day of month (1-31)', 'Month (1-12)', 'Day of week (0-6, 0 = Sunday)'];
  return (<div className="space-y-3"><div className="flex flex-wrap gap-2">{pre.map(([l, v]) => <button key={v} type="button" onClick={() => setF(v.split(' '))} className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-bold hover:border-gold">{l}</button>)}</div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{f.map((v, i) => <Field key={i} label={names[i]}><input className="input font-mono" value={v} onChange={(e) => setF(f.map((x, j) => (j === i ? e.target.value.replace(/\s/g, '') : x)))} /></Field>)}</div>
    <Result big={expr} rows={[['In words', L.cronText(expr)]]} /><Copy1 text={expr} />
    <Note>Use * for every, */5 for every 5, 1-5 for a range, 1,15 for a list.</Note></div>);
}

export function Base64() {
  const [t, setT] = useState(''); const [mode, setMode] = useState('enc');
  let out = ''; let err = '';
  try { out = t ? (mode === 'enc' ? L.b64.enc(t) : L.b64.dec(t)) : ''; } catch { err = 'This is not valid Base64.'; }
  return (<div className="space-y-3"><div className="flex gap-2">{[['enc', 'Encode'], ['dec', 'Decode']].map(([k, l]) => <button key={k} type="button" onClick={() => setMode(k)} className={`rounded-full border px-5 py-1.5 font-bold ${mode === k ? 'border-gold bg-gold text-white' : 'border-line bg-surface'}`}>{l}</button>)}</div>
    <TextIn label="Input" rows={5} value={t} onChange={setT} mono /><Field label="Output"><textarea className="input font-mono text-sm" rows={5} readOnly value={err || out} /></Field>{out && <Copy1 text={out} />}</div>);
}

export function UrlCoder() {
  const [t, setT] = useState(''); const [mode, setMode] = useState('enc');
  let out = ''; try { out = mode === 'enc' ? encodeURIComponent(t) : decodeURIComponent(t); } catch { out = 'This text cannot be decoded.'; }
  return (<div className="space-y-3"><div className="flex gap-2">{[['enc', 'Encode'], ['dec', 'Decode']].map(([k, l]) => <button key={k} type="button" onClick={() => setMode(k)} className={`rounded-full border px-5 py-1.5 font-bold ${mode === k ? 'border-gold bg-gold text-white' : 'border-line bg-surface'}`}>{l}</button>)}</div>
    <TextIn label="Input" rows={4} value={t} onChange={setT} mono /><Field label="Output"><textarea className="input font-mono text-sm" rows={4} readOnly value={t ? out : ''} /></Field>{t && <Copy1 text={out} />}</div>);
}

export function Json() {
  const [t, setT] = useState(''); const [out, setOut] = useState(''); const [err, setErr] = useState('');
  const run = (indent) => { try { const v = JSON.parse(t); setOut(JSON.stringify(v, null, indent)); setErr(''); } catch (e) { setErr(String(e.message || e)); setOut(''); } };
  return (<div className="space-y-3"><TextIn label="Paste JSON" rows={8} value={t} onChange={setT} mono /><div className="flex flex-wrap gap-2"><button type="button" className="btn-gold" onClick={() => run(2)}>Format</button><button type="button" className="btn-ghost" onClick={() => run(0)}>Minify</button></div>
    {err && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Invalid JSON: {err}</p>}{out && <><textarea className="input font-mono text-sm" rows={10} readOnly value={out} /><Copy1 text={out} /></>}</div>);
}

export function Sha() {
  const [t, setT] = useState(''); const [alg, setAlg] = useState('SHA-256'); const [out, setOut] = useState('');
  useEffect(() => { let dead = false; (async () => { if (!t || !(window.crypto && crypto.subtle)) { setOut(''); return; } const b = await crypto.subtle.digest(alg, new TextEncoder().encode(t)); if (!dead) setOut([...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')); })(); return () => { dead = true; }; }, [t, alg]);
  return (<div className="space-y-3"><Sel label="Algorithm" value={alg} onChange={setAlg} options={['SHA-256', 'SHA-1', 'SHA-512']} /><TextIn label="Text" rows={4} value={t} onChange={setT} mono />{out && <><Result big="" rows={[['Hash', '']]} /><p className="break-all rounded-xl bg-[#10241b] p-3 font-mono text-sm text-[#7CF2B2]">{out}</p><Copy1 text={out} /></>}</div>);
}

const SETS = { lower: 'abcdefghijkmnopqrstuvwxyz', upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ', digit: '23456789', sym: '!@#$%^&*()-_=+?' };
export function Password() {
  const [len, setLen] = useState(16); const [o, setO] = useState({ lower: true, upper: true, digit: true, sym: true }); const [pw, setPw] = useState('');
  const gen = () => { const pool = Object.keys(SETS).filter((k) => o[k]).map((k) => SETS[k]).join('') || SETS.lower; const a = new Uint32Array(len); crypto.getRandomValues(a); setPw([...a].map((x) => pool[x % pool.length]).join('')); };
  useEffect(gen, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (<div className="space-y-3"><div className="break-all rounded-2xl bg-[#10241b] p-4 font-mono text-xl text-[#7CF2B2]">{pw}</div><div className="flex gap-2"><button type="button" className="btn-gold" onClick={gen}>New password</button><Copy1 text={pw} /></div>
    <Field label={`Length: ${len}`}><input type="range" min="8" max="64" value={len} onChange={(e) => setLen(Number(e.target.value))} className="w-full accent-[#0B6B45]" /></Field>
    <div className="flex flex-wrap gap-4 text-sm">{[['lower', 'abc'], ['upper', 'ABC'], ['digit', '123'], ['sym', '#$%']].map(([k, l]) => <label key={k} className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5 accent-[#0B6B45]" checked={o[k]} onChange={() => setO({ ...o, [k]: !o[k] })} />{l}</label>)}</div>
    <Note>Made in your browser with secure random numbers. It is never sent or saved. Keep passwords in a password manager.</Note></div>);
}

export function Uuid() {
  const [n, setN] = useState('5'); const [list, setList] = useState([]);
  const gen = () => setList(Array.from({ length: Math.min(100, Math.max(1, Math.floor(Number(n)) || 1)) }, () => crypto.randomUUID()));
  useEffect(gen, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (<div className="space-y-3"><div className="flex items-end gap-3"><div className="w-32"><NumIn label="How many" value={n} onChange={setN} /></div><button type="button" className="btn-gold" onClick={gen}>Generate</button></div><textarea className="input font-mono text-sm" rows={Math.min(12, list.length + 1)} readOnly value={list.join('\n')} /><Copy1 text={list.join('\n')} /></div>);
}

export function Regex() {
  const [p, setP] = useState('\\d+'); const [fl, setFl] = useState('g'); const [t, setT] = useState('Order 123 shipped on 2026-10-23');
  let m = []; let err = '';
  try { if (p) { const re = new RegExp(p, fl.includes('g') ? fl : fl + 'g'); let x; let guard = 0; while ((x = re.exec(t)) && guard++ < 500) { m.push({ i: x.index, v: x[0], g: x.slice(1) }); if (x[0] === '') re.lastIndex++; } } } catch (e) { err = String(e.message); }
  return (<div className="space-y-3"><Row><TextIn label="Pattern" value={p} onChange={setP} mono /><TextIn label="Flags (g i m)" value={fl} onChange={(v) => setFl(v.replace(/[^gimsuy]/g, ''))} mono /></Row><TextIn label="Test text" rows={5} value={t} onChange={setT} mono />
    {err ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p> : <Result big={`${m.length} match${m.length === 1 ? '' : 'es'}`} rows={m.slice(0, 20).map((x, i) => [`#${i + 1} at ${x.i}`, x.v + (x.g.length ? `  [${x.g.join(', ')}]` : '')])} />}</div>);
}

export function Timestamp() {
  const [ts, setTs] = useState(String(Math.floor(Date.now() / 1000))); const [d, setD] = useState('');
  const n = Number(ts); const ms = ts.length >= 13 ? n : n * 1000; const dt = Number.isFinite(n) && ts ? new Date(ms) : null; const ok = dt && !isNaN(dt);
  const back = d ? Math.floor(new Date(d).getTime() / 1000) : null;
  return (<div className="space-y-5"><div><NumIn label="Unix timestamp (seconds or milliseconds)" value={ts} onChange={setTs} />{ok && <Result big={dt.toUTCString()} rows={[['Local time', dt.toLocaleString()], ['Pakistan', dt.toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })], ['ISO', dt.toISOString()]]} />}<button type="button" className="btn-ghost mt-2" onClick={() => setTs(String(Math.floor(Date.now() / 1000)))}>Now</button></div>
    <div><Field label="Date and time to timestamp"><input type="datetime-local" className="input" value={d} onChange={(e) => setD(e.target.value)} /></Field>{back != null && !isNaN(back) && <Result big={String(back)} rows={[['Milliseconds', String(back * 1000)]]} />}</div></div>);
}

export function Color() {
  const [hex, setHex] = useState('#0B6B45');
  const rgb = L.hexToRgb(hex); const hsl = rgb ? L.rgbToHsl(rgb) : null;
  return (<div className="space-y-3"><Row><TextIn label="HEX" value={hex} onChange={setHex} mono /><Field label="Pick"><input type="color" className="h-12 w-full rounded-xl border border-line" value={rgb ? L.rgbToHex(rgb) : '#000000'} onChange={(e) => setHex(e.target.value)} /></Field></Row>
    <div className="h-20 rounded-2xl border border-line" style={{ background: rgb ? L.rgbToHex(rgb) : '#fff' }} />
    {rgb ? <Result rows={[['HEX', L.rgbToHex(rgb)], ['RGB', `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`], ['HSL', `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`]]} /> : <p className="text-sm text-red-600">Type a HEX colour such as #0af or #0B6B45.</p>}
    {rgb && <Copy1 text={L.rgbToHex(rgb)} label="Copy HEX" />}</div>);
}
