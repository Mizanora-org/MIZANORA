'use client';
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, DownloadCloud, Loader2, Save, Trash2, Tv } from 'lucide-react';
import { authClient } from '@/lib/firebase-client';

// Admin > IPTV > Channel list: IPTV ka apna catalogue (free Live TV se alag).
// M3U link ya paste se import, phir Save — uske baad /iptv/channels isi list se banta hai.
export default function IptvCatalogueAdmin() {
  const [state, setState] = useState({ loading: true, channels: [], enabled: false, stats: null, updatedAt: 0 });
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const call = useCallback(async (body, method = 'POST') => {
    const u = authClient().currentUser;
    if (!u) return { ok: false, error: 'Signed out.' };
    const token = await u.getIdToken();
    try {
      const r = await fetch('/api/admin/iptv/channels', {
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
    if (j.ok) setState({ loading: false, channels: j.channels || [], enabled: j.enabled === true, stats: j.stats || null, updatedAt: j.updatedAt || 0 });
    else setErr(j.error || 'Load nahi hua.');
    setBusy('');
  }, [call]);

  useEffect(() => { load(); }, [load]);

  async function importNow() {
    setBusy('import'); setMsg(''); setErr('');
    const j = await call({ action: 'import', url: url.trim(), text });
    setBusy('');
    if (!j.ok) { setErr(j.error || 'Import nahi hua.'); return; }
    setState((s) => ({ ...s, channels: j.channels, stats: j.stats, enabled: true }));
    setMsg(`${j.channels.length.toLocaleString('en-PK')} channels mile${j.skipped ? `, ${j.skipped} skip huye` : ''} — ab "Save" dabayein.`);
    setText(''); setUrl('');
  }

  async function save() {
    setBusy('save'); setMsg(''); setErr('');
    const j = await call({ action: 'save', channels: state.channels, enabled: state.enabled });
    setBusy('');
    if (!j.ok) { setErr(j.error || 'Save nahi hua.'); return; }
    setMsg(`Catalogue save — ${j.stats.live} channels live, ${j.stats.groups} groups (/iptv/channels par 10 minute mein).`);
    setState((s) => ({ ...s, stats: j.stats, updatedAt: Date.now() }));
  }

  async function clear() {
    if (!confirm('Poora IPTV catalogue hata dein? /iptv/channels phir free Live TV ki list dikhayega.')) return;
    setBusy('clear'); setMsg(''); setErr('');
    const j = await call({ action: 'clear' });
    setBusy('');
    if (!j.ok) { setErr(j.error || 'Clear nahi hua.'); return; }
    setState({ loading: false, channels: [], enabled: false, stats: { total: 0, live: 0, off: 0, groups: 0 }, updatedAt: 0 });
    setMsg('Catalogue khali — ab free Live TV ki list chalti hai.');
  }

  const st = state.stats || { total: state.channels.length, live: state.channels.filter((c) => !c.off).length, groups: 0 };

  return (
    <section className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-display text-base font-bold"><Tv size={16} className="text-gold" /> IPTV channel list</h2>
          <p className="text-xs text-dim">
            Yeh IPTV ka apna catalogue hai — free Live TV se alag. Save karne par <code>/iptv/channels</code> isi list se banta hai.
          </p>
        </div>
        <span className="rounded-full border border-line bg-raised px-2.5 py-1 text-[11px] font-bold text-dim">
          {st.live || 0} live · {st.groups || 0} groups
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="M3U link — https://.../playlist.m3u" />
        <button type="button" className="btn-ghost" onClick={importNow} disabled={!!busy || (!url.trim() && !text.trim())}>
          {busy === 'import' ? <Loader2 size={14} className="animate-spin" /> : <DownloadCloud size={14} />} Import link
        </button>
      </div>

      <textarea
        className="input min-h-[92px] font-mono text-[11px]"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'Ya M3U text paste karein:\n#EXTM3U\n#EXTINF:-1 tvg-logo="..." group-title="News",Channel name\nhttp://...'}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-ghost" onClick={importNow} disabled={!!busy || (!text.trim() && !url.trim())}>
          {busy === 'import' ? <Loader2 size={14} className="animate-spin" /> : null} Paste se import
        </button>
        <button type="button" className="btn-gold" onClick={save} disabled={!!busy || !state.channels.length}>
          {busy === 'save' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save catalogue
        </button>
        <button type="button" className="btn-ghost" onClick={clear} disabled={!!busy || !state.channels.length}>
          {busy === 'clear' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Clear
        </button>
        <label className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs">
          <input type="checkbox" className="h-4 w-4 accent-[#0B6B45]" checked={state.enabled} onChange={(e) => setState((s) => ({ ...s, enabled: e.target.checked }))} />
          IPTV catalogue ON
        </label>
      </div>

      {msg && <p className="rounded-xl border border-gold/30 bg-gold/[0.06] px-3 py-2 text-xs font-semibold text-gold">{msg}</p>}
      {err && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{err}</p>}
      {state.loading && <p className="flex items-center gap-2 text-xs text-dim"><Loader2 size={13} className="animate-spin" /> Load ho raha hai…</p>}

      {state.channels.length > 0 && (
        <div className="rounded-xl border border-line bg-raised p-2">
          <p className="text-[11px] font-bold text-cream">Preview (pehle 12)</p>
          <ul className="mt-1 grid gap-1 sm:grid-cols-2">
            {state.channels.slice(0, 12).map((c, i) => (
              <li key={`${c.url}-${i}`} className="flex items-center gap-2 truncate text-[11px] text-dim">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-surface text-[9px] font-black text-gold">{String(c.name || '?').slice(0, 2).toUpperCase()}</span>
                <span className="truncate">{c.name}</span>
                <span className="ml-auto shrink-0 text-faint">{c.group}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="flex items-start gap-1.5 text-[11px] text-faint">
        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
        Sirf woh channels daalein jinke rights aap ke paas hain (FTA ya authorised). Source links sirf server par rehte hain — client ko kabhi nahi dikhte.
      </p>
    </section>
  );
}
