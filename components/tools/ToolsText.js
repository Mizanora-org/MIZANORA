'use client';
import { useState } from 'react';
import { Copy1, Field, Note, Result, Row, TextIn } from './kit';
import * as L from '@/lib/toolsLogic';

export function WordCount() {
  const [t, setT] = useState(''); const s = L.textStats(t);
  return (<div className="space-y-3"><TextIn label="Your text" rows={9} value={t} onChange={setT} placeholder="Type or paste here. Urdu works too." /><Result big={`${s.words} words`} rows={[['Characters', s.chars], ['Without spaces', s.noSpaces], ['Sentences', s.sentences], ['Lines', s.lines], ['Reading time', `${s.minutes} min`]]} /></div>);
}

export function CaseConv() {
  const [t, setT] = useState(''); const [out, setOut] = useState('');
  const modes = [['upper', 'UPPERCASE'], ['lower', 'lowercase'], ['title', 'Title Case'], ['sentence', 'Sentence case'], ['camel', 'camelCase'], ['snake', 'snake_case'], ['kebab', 'kebab-case']];
  return (<div className="space-y-3"><TextIn label="Your text" rows={6} value={t} onChange={(v) => { setT(v); setOut(''); }} /><div className="flex flex-wrap gap-2">{modes.map(([k, l]) => <button key={k} type="button" className="btn-ghost !px-3 !py-1.5 text-sm" onClick={() => setOut(L.caseConvert(t, k))}>{l}</button>)}</div>{out && <><textarea className="input" rows={5} readOnly value={out} /><Copy1 text={out} /></>}</div>);
}

export function Slug() {
  const [t, setT] = useState(''); const s = L.slugify(t);
  return (<div className="space-y-3"><TextIn label="Title" value={t} onChange={setT} placeholder="Best Winter Shoes for Men in Pakistan 2026" />{s && <><Result big={`/${s}`} rows={[['Length', `${s.length} characters`]]} /><Copy1 text={s} /></>}</div>);
}

export function Keywords() {
  const [seed, setSeed] = useState(''); const [list, setList] = useState([]);
  return (<div className="space-y-3"><div className="flex gap-2"><input className="input" value={seed} onChange={(e) => setSeed(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setList(L.keywordIdeas(seed))} placeholder="one word or phrase: sandal, zakat, laptop" aria-label="Seed keyword" /><button type="button" className="btn-gold" onClick={() => setList(L.keywordIdeas(seed))}>Generate</button></div>
    {list.length > 0 && <><p className="text-sm text-dim">{list.length} ideas. Tap one to copy.</p><div className="flex flex-wrap gap-2">{list.map((k) => <button key={k} type="button" className="rounded-full border border-line bg-surface px-3 py-1 text-sm hover:border-gold" onClick={() => navigator.clipboard && navigator.clipboard.writeText(k)}>{k}</button>)}</div><Copy1 text={list.join('\n')} label="Copy all" /></>}
    <Note>These are ideas built from patterns people use. They do not show real search numbers: check them in Google Search Console or Keyword Planner.</Note></div>);
}

export function Meta() {
  const [t, setT] = useState(''); const [d, setD] = useState(''); const [u, setU] = useState('mizanora.vercel.app');
  const m = L.metaLen(t, d);
  const tag = `<title>${t}</title>\n<meta name="description" content="${d.replace(/"/g, '&quot;')}">`;
  return (<div className="space-y-3"><TextIn label={`Title (${m.title}/60)`} value={t} onChange={setT} /><TextIn label={`Description (${m.desc}/160)`} rows={3} value={d} onChange={setD} /><TextIn label="Your website" value={u} onChange={setU} />
    <div className="rounded-2xl border border-line bg-white p-4"><p className="truncate text-xs text-[#202124]">{u}</p><p className="truncate text-xl text-[#1a0dab]">{t || 'Your page title appears here'}</p><p className="line-clamp-2 text-sm text-[#4d5156]">{d || 'Your page description appears here. Write what the visitor will get.'}</p></div>
    <p className="text-sm">{m.titleOk ? 'Title length is good.' : 'Title: aim for 30 to 60 characters.'} {m.descOk ? 'Description length is good.' : 'Description: aim for 110 to 160 characters.'}</p>
    <textarea className="input font-mono text-sm" rows={3} readOnly value={tag} /><Copy1 text={tag} /></div>);
}

export function WhatsApp() {
  const [p, setP] = useState(''); const [m, setM] = useState(''); const link = L.waLink(p, m);
  return (<div className="space-y-3"><TextIn label="WhatsApp number with country code" value={p} onChange={setP} placeholder="923001234567 or 0300 1234567" hint="Pakistan: 92 then the number without the first 0." /><TextIn label="Ready message (optional)" rows={3} value={m} onChange={setM} />{link ? <><Result big="Your link is ready" rows={[]} /><p className="break-all rounded-xl bg-raised p-3 text-sm">{link}</p><div className="flex gap-2"><Copy1 text={link} /><a className="btn-gold !py-1.5 text-sm" href={link} target="_blank" rel="noopener noreferrer">Test it</a></div></> : <p className="text-sm text-dim">Enter a number to get your link.</p>}</div>);
}
