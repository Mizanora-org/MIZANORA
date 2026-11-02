'use client';
import { useCallback, useEffect, useState } from 'react';
import { Copy, Database, Loader2, PlugZap, Save, Trash2 } from 'lucide-react';
import { authClient } from '@/lib/firebase-client';

// Admin > IPTV > Source: jahan se asli channels aate hain (Xtream panel ya M3U link).
// Ye detail SIRF server par rehti hai — client ko kabhi nahi jati. Gateway (v42) isi se chalta hai.
export default function IptvSourceAdmin() {
  const [state, setState] = useState({ loading: true, source: null });
  const [form, setForm] = useState({ mode: 'xtream', name: '', host: '', username: '', password: '', url: '' });
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [test, setTest] = useState(null);
  const [copied, setCopied] = useState('');

  const call = useCallback(async (body, method = 'POST') => {
    const u = authClient().currentUser;
    if (!u) return { ok: false, error: 'Signed out.' };
    const token = await u.getIdToken();
    try {
      const r = await fetch('/api/admin/iptv/source', {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: method === 'GET' ? undefined : JSON.stringify(body),
      });
      return await r.json().catch(() => ({ ok: false, error: `Server ${r.status}` }));
    } catch (e) { return { ok: false, error: e.message }; }
  }, []);

  const load = useCallback(async () => {
    const j = await call(null, 'GET');
    if (j.ok) {
      setState({ loading: false, source: j.source });
      setForm((f) => ({
        ...f,
        mode: j.source.mode || 'xtream',
        name: j.source.name || '',
        host: j.source.host || '',
        username: j.source.username || '',
        url: j.source.url || '',
      }));
    } else { setState({ loading: false, source: null }); setErr(j.error || 'Load nahi hua.'); }
  }, [call]);

  useEffect(() => { load(); }, [load]);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErr(''); setMsg(''); };

  async function run(action) {
    setBusy(action); setMsg(''); setErr(''); setTest(null);
    const j = await call({ action, ...form });
    setBusy('');
    if (!j.ok) { setErr(j.error || 'Nahi hua.'); return; }
    if (action === 'test') { setTest(j); setMsg('Connection theek hai.'); return; }
    if (action === 'save') { setMsg('Source save ho gaya — ab lines ka gateway chalega.'); load(); }
    if (action === 'clear') { setMsg('Source hata diya.'); load(); }
  }

  const copy = async (text, k) => { try { await navigator.clipboard.writeText(text); setCopied(k); setTimeout(() => setCopied(''), 1500); } catch { /* blocked */ } };
  const s = state.source;

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-bold"><Database size={16} className="text-gold" /> Upstream backup (optional)</h2>
          <p className="text-xs text-dim">
            v43 ke baad Mizanora apna panel hai — channels upar wali list se chaltay hain. Yeh card sirf tab
            kaam ka hai jab aap kisi purane Xtream panel ya M3U se jaldi channels laana chahein (test/import).
            Detail sirf server par rehti hai, client ko kabhi nahi dikhti.
          </p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${s?.ready ? 'border-gold/40 bg-gold/10 text-gold' : 'border-line bg-raised text-dim'}`}>
          {s?.ready ? `connected · ${s.mode}` : 'not set'}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[['xtream', 'Xtream panel'], ['m3u', 'M3U link']].map(([id, label]) => (
          <button key={id} type="button" onClick={() => set('mode', id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold ${form.mode === id ? 'border-gold bg-gold/10 text-gold' : 'border-line bg-surface text-dim'}`}>
            {label}
          </button>
        ))}
      </div>

      {form.mode === 'xtream' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="label">Panel host</span>
            <input className="input" value={form.host} onChange={(e) => set('host', e.target.value)} placeholder="http://panel.example.com:8080" />
          </label>
          <label className="block"><span className="label">Username</span>
            <input className="input" value={form.username} onChange={(e) => set('username', e.target.value)} placeholder="source user" autoComplete="off" />
          </label>
          <label className="block"><span className="label">Password {s?.hasPassword ? <span className="text-faint">(save hai — khali chhorein to wohi rahega)</span> : null}</span>
            <input className="input" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="••••••••" autoComplete="off" />
          </label>
          <label className="block"><span className="label">Naam (pehchaan ke liye)</span>
            <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Mera source" />
          </label>
        </div>
      ) : (
        <label className="block"><span className="label">M3U link</span>
          <input className="input" value={form.url} onChange={(e) => set('url', e.target.value)} placeholder="https://.../playlist.m3u" />
        </label>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-ghost" onClick={() => run('test')} disabled={!!busy}>
          {busy === 'test' ? <Loader2 size={14} className="animate-spin" /> : <PlugZap size={14} />} Test connection
        </button>
        <button type="button" className="btn-gold" onClick={() => run('save')} disabled={!!busy}>
          {busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save source
        </button>
        <button type="button" className="btn-ghost" onClick={() => run('clear')} disabled={!!busy || !s?.ready}>
          {busy === 'clear' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Clear
        </button>
      </div>

      {msg && <p className="rounded-xl border border-gold/30 bg-gold/[0.06] px-3 py-2 text-xs font-semibold text-gold">{msg}</p>}
      {err && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{err}</p>}

      {test && (
        <div className="rounded-xl border border-line bg-raised p-3 text-xs">
          <p className="font-bold text-cream">{test.channels} channels mile · mode {test.mode}</p>
          {test.account && (
            <p className="mt-1 text-dim">
              account: {test.account.username} · {test.account.status}
              {test.account.maxConnections ? ` · ${test.account.maxConnections} connections` : ''}
            </p>
          )}
          {test.sample?.length > 0 && (
            <p className="mt-1 text-faint">misaal: {test.sample.map((c) => `${c.name} (${c.group})`).join(' · ')}</p>
          )}
        </div>
      )}

      <div className="rounded-xl border border-line bg-surface p-3 text-[11px]">
        <p className="font-bold text-cream">Client ko kya dena hai</p>
        <p className="mt-1 text-dim">
          Server: <code>mizanora.vercel.app</code> · Xtream login: line ka username/password.
          App khud <code>/player_api.php</code> aur <code>/live/...</code> maangega — sab isi domain par.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[['player_api.php', '/player_api.php'], ['get.php (M3U)', '/get.php'], ['xmltv.php (EPG)', '/xmltv.php']].map(([label, path]) => (
            <button key={path} type="button" onClick={() => copy(`https://mizanora.vercel.app${path}`, path)}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-raised px-2 py-1 font-mono">
              <Copy size={10} /> {label} {copied === path ? '✓' : ''}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
