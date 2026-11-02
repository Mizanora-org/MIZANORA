'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { authClient } from '@/lib/firebase-client';
import { CalendarClock, CheckCircle2, Loader2, Plus, RefreshCw, Save, Search, Trash2 } from 'lucide-react';

// Admin > IPTV > EPG guide.
// XMLTV link(s) do -> programmes aa jate hain; naam ka auto-map hota hai, jo reh jaye woh
// neeche table mein manually map karein. Source na ho to generated 2-ghante slots chalti hain
// (app mein guide khali nahi dikhti).
export default function IptvEpgAdmin() {
  const [data, setData] = useState(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [map, setMap] = useState({});
  const [q, setQ] = useState('');

  const call = useCallback(async (body, method = 'POST') => {
    const u = authClient().currentUser;
    if (!u) return { ok: false, error: 'Signed out.' };
    const token = await u.getIdToken();
    try {
      const r = await fetch('/api/admin/iptv/epg', {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: method === 'GET' ? undefined : JSON.stringify(body),
      });
      return await r.json().catch(() => ({ ok: false, error: `Server ${r.status}` }));
    } catch (e) { return { ok: false, error: e.message }; }
  }, []);

  const load = useCallback(async () => {
    setBusy('load'); setErr('');
    const j = await call(null, 'GET');
    if (j.ok) {
      setData(j);
      const m = {};
      for (const c of j.channels || []) m[c.id] = c.epg || '';
      setMap(m);
    } else setErr(j.error || 'EPG load nahi hui.');
    setBusy('');
  }, [call]);

  useEffect(() => { load(); }, [load]);

  async function test() {
    setBusy('test'); setMsg(''); setErr('');
    const j = await call({ action: 'test', url: url.trim() });
    setBusy('');
    if (!j.ok) { setErr(j.error || 'Guide test fail.'); return; }
    setMsg(`Guide theek hai — ${j.channels} channels, ${j.programmes.toLocaleString('en-PK')} programmes.`);
  }

  async function addSource() {
    setBusy('add'); setMsg(''); setErr('');
    const j = await call({ action: 'addSource', url: url.trim() });
    setBusy('');
    if (!j.ok) { setErr(j.error || 'Source add nahi hua.'); return; }
    setMsg(`Source add — ${j.programmes.toLocaleString('en-PK')} programmes, ${j.mapped} channels auto-map hue${j.unmatched ? `, ${j.unmatched} manual mapping chahiye` : ''}.`);
    setUrl('');
    load();
  }

  async function removeSource(u) {
    if (!confirm('Yeh guide source hata dein?')) return;
    setBusy(`rm:${u}`);
    const j = await call({ action: 'removeSource', url: u });
    setBusy('');
    if (j.ok) { setMsg('Source hata diya.'); load(); }
  }

  async function saveMap() {
    setBusy('map'); setMsg(''); setErr('');
    const j = await call({ action: 'map', map });
    setBusy('');
    if (!j.ok) { setErr(j.error || 'Mapping save nahi hui.'); return; }
    setMsg(`Mapping save — ${j.mapped} channels EPG se juray.`);
    load();
  }

  async function clearAll() {
    if (!confirm('Poori EPG configuration hata dein?')) return;
    setBusy('clear');
    const j = await call({ action: 'clear' });
    setBusy('');
    if (j.ok) { setMsg('EPG clear — ab generated slots chal rahi hain.'); load(); }
  }

  const channels = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data?.channels || []).filter((c) => !term || `${c.name} ${c.group}`.toLowerCase().includes(term)).slice(0, 60);
  }, [data, q]);

  const counts = data?.counts || {};

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-bold"><CalendarClock size={16} className="text-gold" /> EPG guide</h2>
          <p className="text-xs text-dim">XMLTV source jodein — channel ka guide Xtream/Stalker/Player sab mein aata hai. Source na ho to generated slots.</p>
        </div>
        <span className="rounded-full border border-line bg-raised px-2.5 py-1 text-[11px] font-bold text-dim">
          {counts.mapped || 0}/{counts.channels || 0} mapped
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="XMLTV link — https://.../guide.xml (ya .xml.gz)" />
        <button type="button" className="btn-ghost" onClick={test} disabled={!!busy || !url.trim()}>
          {busy === 'test' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Test
        </button>
        <button type="button" className="btn-gold" onClick={addSource} disabled={!!busy || !url.trim()}>
          {busy === 'add' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add source
        </button>
      </div>

      {msg && <p className="rounded-xl border border-gold/30 bg-gold/[0.06] px-3 py-2 text-xs font-semibold text-gold">{msg}</p>}
      {err && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{err}</p>}

      {!!(data?.sources || []).length && (
        <ul className="space-y-1">
          {data.sources.map((s) => (
            <li key={s.url} className="flex items-center gap-2 rounded-xl border border-line bg-raised px-2.5 py-1.5 text-[11px]">
              <span className="flex-1 truncate font-mono text-dim">{s.url}</span>
              <span className="text-faint">{s.channels} ch · {(s.programmes || 0).toLocaleString('en-PK')} prog</span>
              <button type="button" className="text-faint hover:text-red-600" onClick={() => removeSource(s.url)} aria-label="Remove"><Trash2 size={12} /></button>
            </li>
          ))}
        </ul>
      )}

      {!!(data?.preview || []).length && (
        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-faint">Guide preview</p>
          <ul className="mt-1 space-y-1">
            {data.preview.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-[11px]">
                <span className="w-32 truncate text-cream">{p.name}</span>
                <span className="flex-1 truncate text-dim">{p.now}</span>
                <span className="font-mono text-[10px] text-faint">{p.epgId}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[12rem]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input className="input pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Channel dhundein…" />
        </div>
        <button type="button" className="btn-gold" onClick={saveMap} disabled={!!busy || !Object.keys(map).length}>
          {busy === 'map' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save mapping
        </button>
        <button type="button" className="btn-ghost" onClick={load} disabled={busy === 'load'}>
          {busy === 'load' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
        </button>
        <button type="button" className="btn-ghost" onClick={clearAll} disabled={!!busy}><Trash2 size={14} /> Clear EPG</button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead className="text-[10px] uppercase tracking-wider text-faint">
            <tr><th className="py-1">Channel</th><th>Group</th><th>EPG id (XMLTV)</th></tr>
          </thead>
          <tbody>
            {channels.map((c) => (
              <tr key={c.id} className="border-t border-line/60">
                <td className="max-w-[12rem] truncate py-1 text-xs font-semibold text-cream">{c.name}</td>
                <td className="text-xs text-dim">{c.group}</td>
                <td className="py-1">
                  <input
                    className="input !py-1 !text-[11px] font-mono"
                    value={map[c.id] ?? ''}
                    onChange={(e) => setMap((m) => ({ ...m, [c.id]: e.target.value }))}
                    placeholder={`mz-${c.id}.tv (auto)`}
                  />
                </td>
              </tr>
            ))}
            {!channels.length && <tr><td colSpan={3} className="py-3 text-xs text-faint">Channels nahi mile — pehle catalogue import karein.</td></tr>}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-faint">
        Player ke liye: <code>/api/gw/guide?username=…&amp;password=…</code> · apps ke liye: <code>/xmltv.php?username=…&amp;password=…</code>
      </p>
    </section>
  );
}
