'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Copy,
  ExternalLink,
  Layers,
  Link2,
  Loader2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Save,
  Server,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { authClient } from '@/lib/firebase-client';
import {
  MAX_MOVIE_SERVERS,
  SERVER_KINDS,
  SERVER_QUALITIES,
  SERVER_SCOPES,
  SERVER_TEMPLATE_EXAMPLES,
  SERVER_TOKENS,
  buildServerUrl,
  describeServers,
  serverKindFromUrl,
} from '@/lib/movieServers';

const EMPTY = {
  id: '',
  name: '',
  template: '',
  kind: 'auto',
  quality: 'Auto',
  language: 'Urdu / English',
  scope: 'all',
  note: '',
  rightsConfirmed: false,
};

async function adminToken() {
  try {
    const a = authClient();
    const u = a && a.currentUser;
    return u ? await u.getIdToken() : '';
  } catch {
    return '';
  }
}

const KindBadge = ({ kind }) => {
  const map = {
    embed: 'bg-sky-500/15 text-sky-700',
    hls: 'bg-emerald-500/15 text-emerald-700',
    mp4: 'bg-violet-500/15 text-violet-700',
    dash: 'bg-amber-500/15 text-amber-700',
  };
  return <span className={`rounded px-1.5 py-0.5 text-[0.62rem] font-extrabold uppercase ${map[kind] || 'bg-raised text-dim'}`}>{kind || 'auto'}</span>;
};

export default function MovieServersAdmin({ onChanged }) {
  const [cfg, setCfg] = useState({ enabled: true, servers: [], ads: { enabled: true, seconds: 10, skipAfter: 5, headline: 'Mizanora Store', note: '' } });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [dbReady, setDbReady] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState('');
  const [previewId, setPreviewId] = useState('tt22084616');
  const [bulkText, setBulkText] = useState('');
  const [bulkRights, setBulkRights] = useState(false);
  const [bulkErrors, setBulkErrors] = useState([]);

  const call = useCallback(async (payload) => {
    const t = await adminToken();
    if (!t) return { ok: false, error: 'Aap signed out hain. Page reload karke dobara sign in karein.' };
    try {
      const res = await fetch('/api/admin/movie-servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!json) return { ok: false, error: `Server ne ${res.status} kaha (jawab samajh nahi aaya).` };
      return json;
    } catch (e) {
      return { ok: false, error: `Server tak nahi pohncha: ${e.message}` };
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    const r = await call({ action: 'load' });
    if (r.ok && r.cfg) {
      setCfg(r.cfg);
      setDbReady(r.dbReady !== false);
    } else {
      setErr(r.error || 'Play servers load nahi ho sake.');
    }
    setLoading(false);
  }, [call]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => describeServers(cfg.servers), [cfg.servers]);

  const applyResult = (r, okMessage) => {
    if (r && r.ok && r.cfg) {
      setCfg(r.cfg);
      setMsg(okMessage || r.message || 'Saved.');
      setErr('');
      if (onChanged) onChanged();
      return true;
    }
    setErr((r && r.error) || 'Kuch ghalat ho gaya — dobara koshish karein.');
    return false;
  };

  const submitForm = async () => {
    if (!form.name.trim() || !form.template.trim()) {
      setErr('Server ka naam aur link dono zaroori hain.');
      return;
    }
    if (!form.rightsConfirmed) {
      setErr('Rights confirmation tick karein — sirf apne ya licensed content ke server add karein.');
      return;
    }
    setBusy(editing ? 'update' : 'add');
    setMsg('');
    setErr('');
    const payload = {
      name: form.name.trim(),
      template: form.template.trim(),
      kind: form.kind,
      quality: form.quality,
      language: form.language,
      scope: form.scope,
      note: form.note,
      rightsConfirmed: true,
    };
    const r = editing
      ? await call({ action: 'update', id: editing, server: payload })
      : await call({ action: 'add', server: payload });
    if (applyResult(r)) {
      setForm(EMPTY);
      setEditing('');
    }
    setBusy('');
  };

  const runBulkAdd = async () => {
    const rows = bulkText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, MAX_MOVIE_SERVERS)
      .map((line) => {
        const parts = line.split('|').map((x) => x.trim());
        if (parts.length >= 2) return { name: parts[0].slice(0, 40), template: parts.slice(1).join('|').trim() };
        return { name: '', template: line };
      })
      .filter((r) => r.template);
    if (!rows.length) {
      setErr('Har line par ek link likhein (ya "Naam | link").');
      return;
    }
    if (!bulkRights) {
      setErr('Bulk add se pehle rights confirmation tick karein.');
      return;
    }
    setBusy('bulk');
    setErr('');
    setMsg('');
    setBulkErrors([]);
    const r = await call({ action: 'bulkAdd', servers: rows, rightsConfirmed: true });
    if (r && r.ok) {
      setCfg(r.cfg);
      setBulkText('');
      setBulkRights(false);
      setBulkErrors(Array.isArray(r.errors) ? r.errors : []);
      setMsg(r.message || `${r.added || rows.length} servers add ho gaye.`);
      if (onChanged) onChanged();
    } else {
      setErr((r && r.error) || 'Bulk add fail ho gaya.');
    }
    setBusy('');
  };

  const startEdit = (s) => {
    setEditing(s.id);
    setForm({
      id: s.id,
      name: s.name,
      template: s.template,
      kind: s.kind,
      quality: s.quality,
      language: s.language,
      scope: s.scope,
      note: s.note || '',
      rightsConfirmed: s.rightsConfirmed === true,
    });
    setErr('');
    setMsg('');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = async (s) => {
    if (typeof window !== 'undefined' && !window.confirm(`"${s.name}" delete karein? Yeh wapas nahi aayega.`)) return;
    setBusy(`del-${s.id}`);
    const r = await call({ action: 'delete', id: s.id });
    applyResult(r);
    setBusy('');
  };

  const toggle = async (s) => {
    setBusy(`tg-${s.id}`);
    const r = await call({ action: 'toggle', id: s.id });
    applyResult(r);
    setBusy('');
  };

  const move = async (s, dir) => {
    setBusy(`mv-${s.id}`);
    const r = await call({ action: 'move', id: s.id, dir });
    applyResult(r);
    setBusy('');
  };

  const duplicate = async (s) => {
    setBusy(`cp-${s.id}`);
    const r = await call({ action: 'duplicate', id: s.id });
    applyResult(r);
    setBusy('');
  };

  const saveAds = async () => {
    setBusy('ads');
    const r = await call({ action: 'save', cfg: { enabled: cfg.enabled, ads: cfg.ads } });
    applyResult(r, 'Ad settings save ho gaye.');
    setBusy('');
  };

  const setAd = (k, v) => setCfg((c) => ({ ...c, ads: { ...c.ads, [k]: v } }));

  const insertToken = (token) => {
    const input = typeof document !== 'undefined' ? document.getElementById('server-template-input') : null;
    if (!input) {
      setForm((f) => ({ ...f, template: `${f.template}${token}` }));
      return;
    }
    const start = input.selectionStart ?? form.template.length;
    const end = input.selectionEnd ?? form.template.length;
    const next = `${form.template.slice(0, start)}${token}${form.template.slice(end)}`;
    setForm((f) => ({ ...f, template: next }));
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const previewUrl = useMemo(() => {
    if (!form.template.trim()) return '';
    try {
      return buildServerUrl(form.template.trim(), {
        imdbId: /^tt\d{6,10}$/.test(previewId) ? previewId : 'tt22084616',
        slug: 'sample-title-2026',
        title: form.name || 'Sample Title',
        year: 2026,
        type: form.scope === 'series' ? 'series' : 'movie',
        season: 1,
        episode: 1,
      });
    } catch {
      return '';
    }
  }, [form.template, form.name, form.scope, previewId]);

  return (
    <div className="space-y-5">
      {/* header + stats */}
      <div className="rounded-3xl border-2 border-gold/40 bg-gradient-to-br from-[#052e1d] via-[#0B6B45] to-[#13293d] p-5 text-white shadow-xl sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-saffron px-3 py-1 text-[0.66rem] font-extrabold uppercase tracking-wider text-[#2B1B00]">
              <Server size={12} /> v51 Play Servers
            </p>
            <h2 className="mt-2.5 font-display text-xl font-extrabold sm:text-2xl">Apne Player ke Server — Add, Edit, Delete</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/85">
              Yahan ek dafa server add karein (jaise{' '}
              <code className="rounded bg-black/35 px-1.5 py-0.5 font-mono text-[0.75rem] text-[#F5B83D]">https://my-cdn.com/play/{'{imdbid}'}</code>
              ). Player khud har movie/series ki IMDb ID daal kar link bana lega — har title ke liye dobara kuch likhna nahi paray ga.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5 text-[0.66rem] font-bold">
              <span className="rounded-full bg-white/15 px-2.5 py-1">{stats.total} servers</span>
              <span className="rounded-full bg-white/15 px-2.5 py-1">{stats.on} ON</span>
              <span className="rounded-full bg-white/15 px-2.5 py-1">{stats.movies} movie-ready</span>
              <span className="rounded-full bg-white/15 px-2.5 py-1">{stats.series} series-ready</span>
              {stats.kinds.map((k) => <span key={k} className="rounded-full bg-white/15 px-2.5 py-1 uppercase">{k}</span>)}
            </div>
          </div>
          <button type="button" onClick={load} disabled={loading} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white/15 px-3.5 py-2 text-xs font-extrabold hover:bg-white/25">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Reload
          </button>
        </div>
      </div>

      {!dbReady && (
        <p className="rounded-xl border-2 border-amber-500 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
          Firestore abhi connect nahi hai — servers save nahi honge. Vercel par <code>FIREBASE_SERVICE_ACCOUNT</code> set karein.
        </p>
      )}
      {err && <p role="alert" className="rounded-xl border border-rose-400 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{err}</p>}
      {msg && <p role="status" className="rounded-xl border border-emerald-400 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{msg}</p>}

      {/* add / edit form */}
      <section className="space-y-3 rounded-3xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="inline-flex items-center gap-1.5 font-display text-lg font-extrabold text-cream">
            {editing ? <Pencil size={16} className="text-gold" /> : <Plus size={16} className="text-gold" />}
            {editing ? `Edit server: ${form.name || editing}` : 'Add a new play server'}
          </h3>
          {editing && (
            <button
              type="button"
              onClick={() => { setEditing(''); setForm(EMPTY); setErr(''); }}
              className="inline-flex items-center gap-1 rounded-full bg-raised px-3 py-1 text-xs font-bold text-cream hover:text-gold"
            >
              <X size={12} /> Cancel edit
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="label">Server ka naam</span>
            <input className="input" maxLength={40} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Mizanora CDN · HD" />
          </label>
          <label className="block text-sm">
            <span className="label">Quality label (viewer ko dikhega)</span>
            <select className="input" value={form.quality} onChange={(e) => setForm({ ...form, quality: e.target.value })}>
              {SERVER_QUALITIES.map((q) => <option key={q} value={q}>{q}</option>)}
            </select>
          </label>
        </div>

        <label className="block text-sm">
          <span className="label">Play link template — <b>{'{imdbid}'}</b> lazmi nahi, magar sab se aam</span>
          <input
            id="server-template-input"
            className="input font-mono text-xs sm:text-sm"
            value={form.template}
            onChange={(e) => setForm({ ...form, template: e.target.value, kind: form.kind === 'auto' ? 'auto' : form.kind })}
            placeholder="https://my-cdn.com/play/{imdbid}"
            spellCheck={false}
          />
        </label>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[0.66rem] font-extrabold uppercase tracking-wider text-faint">Insert</span>
          {SERVER_TOKENS.map(([token, hint]) => (
            <button
              key={token}
              type="button"
              title={hint}
              onClick={() => insertToken(token)}
              className="rounded-full border border-line bg-raised px-2 py-0.5 font-mono text-[0.66rem] font-bold text-cream transition hover:border-gold hover:text-gold"
            >
              {token}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {SERVER_TEMPLATE_EXAMPLES.map((ex) => (
            <button
              key={ex.template}
              type="button"
              onClick={() => setForm((f) => ({ ...f, template: ex.template }))}
              className="rounded-full border border-gold/30 bg-gold/5 px-2.5 py-1 text-[0.66rem] font-bold text-gold hover:bg-gold/15"
            >
              <Sparkles size={10} className="mr-1 inline" />{ex.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="label">Type</span>
            <select className="input" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              {SERVER_KINDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="label">Kis ke liye</span>
            <select className="input" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}>
              {SERVER_SCOPES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="label">Zubaan</span>
            <input className="input" maxLength={24} value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} placeholder="Urdu / English" />
          </label>
        </div>

        <label className="block text-sm">
          <span className="label">Note (optional, sirf admin ko dikhega)</span>
          <input className="input" maxLength={120} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Backup CDN · 1080p · EU region" />
        </label>

        {form.template && (
          <div className="rounded-xl border border-line bg-ink/60 p-3">
            <p className="flex flex-wrap items-center gap-1.5 text-[0.66rem] font-extrabold uppercase tracking-wider text-faint">
              <Link2 size={11} /> Live preview
              <input
                className="ml-auto w-28 rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[0.66rem] text-cream"
                value={previewId}
                onChange={(e) => setPreviewId(e.target.value.trim())}
                aria-label="Sample IMDb ID"
              />
            </p>
            <p className="mt-1.5 break-all font-mono text-[0.7rem] text-gold">{previewUrl || '—'}</p>
            <p className="mt-1 text-[0.66rem] text-dim">
              Detected type: <b>{form.kind === 'auto' ? serverKindFromUrl(previewUrl) : form.kind}</b>. Har movie page par yeh link us title ki IMDb ID ke saath banega.
            </p>
          </div>
        )}

        <label className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-[#0B6B45]"
            checked={form.rightsConfirmed}
            onChange={(e) => setForm({ ...form, rightsConfirmed: e.target.checked })}
          />
          <span>
            <b className="block">Main tasdeeq karta/karti hoon ke yeh server mera hai, ya mere paas is se stream karne ka licence / ijazat hai.</b>
            Mizanora sirf woh content dikhata hai jiske rights aapke paas hon. Unauthorized movies host karna copyright qanoon ke khilaf hai aur aapke domain par ban lag sakta hai.
          </span>
        </label>

        <button
          type="button"
          onClick={submitForm}
          disabled={busy === 'add' || busy === 'update' || loading}
          className="btn-gold inline-flex items-center gap-1.5 text-sm"
        >
          {busy === 'add' || busy === 'update' ? <Loader2 size={15} className="animate-spin" /> : editing ? <Save size={15} /> : <Plus size={15} />}
          {editing ? 'Save changes' : 'Add server'}
        </button>
      </section>

      {/* bulk paste */}
      <details className="rounded-3xl border border-line bg-surface p-5">
        <summary className="cursor-pointer font-display text-lg font-extrabold text-cream">
          Bulk add — ek saath kai servers paste karein
        </summary>
        <p className="mt-2 text-xs text-dim">
          Har line par ek link. Naam bhi dena ho to <code className="rounded bg-raised px-1 font-mono">Naam | link</code> likhein.
          Khali naam ho to host ka naam khud aa jata hai. Duplicate links aur ghalat links skip ho jate hain.
        </p>
        <textarea
          className="input mt-2 font-mono text-xs"
          rows={5}
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder={'Mizanora CDN | https://my-cdn.com/play/{imdbid}\nBackup HLS | https://backup.example.com/{imdbid}/master.m3u8'}
          spellCheck={false}
        />
        <label className="mt-2 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-[0.7rem] text-amber-900">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#0B6B45]" checked={bulkRights} onChange={(e) => setBulkRights(e.target.checked)} />
          <span>Main tasdeeq karta/karti hoon ke in tamam servers se stream karne ka haq mere paas hai.</span>
        </label>
        <button
          type="button"
          onClick={runBulkAdd}
          disabled={busy === 'bulk' || !bulkText.trim() || !bulkRights}
          className="btn-gold mt-2 inline-flex items-center gap-1.5 text-sm disabled:opacity-60"
        >
          {busy === 'bulk' ? <Loader2 size={15} className="animate-spin" /> : <Layers size={15} />} Add all links
        </button>
        {bulkErrors.length > 0 && (
          <ul className="mt-2 space-y-1 rounded-xl bg-rose-50 p-2.5 text-[0.68rem] text-rose-800">
            {bulkErrors.slice(0, 6).map((e) => <li key={e}>• {e}</li>)}
            {bulkErrors.length > 6 && <li>… {bulkErrors.length - 6} more</li>}
          </ul>
        )}
      </details>

      {/* list */}
      <section className="space-y-3 rounded-3xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="inline-flex items-center gap-1.5 font-display text-lg font-extrabold text-cream">
            <Layers size={16} className="text-gold" /> Your play servers ({cfg.servers.length}/{MAX_MOVIE_SERVERS})
          </h3>
          <label className="inline-flex items-center gap-2 text-xs font-bold text-cream">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#0B6B45]"
              checked={cfg.enabled !== false}
              onChange={async (e) => {
                const next = { ...cfg, enabled: e.target.checked };
                setCfg(next);
                setBusy('enabled');
                const r = await call({ action: 'save', cfg: { enabled: next.enabled, ads: next.ads } });
                applyResult(r, next.enabled ? 'Player servers ON.' : 'Player servers OFF — movie pages sirf trailer dikhayenge.');
                setBusy('');
              }}
            />
            Player ON
          </label>
        </div>

        {cfg.servers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-ink/40 p-5 text-center">
            <Server size={26} className="mx-auto text-faint" />
            <p className="mt-2 font-display text-base font-extrabold text-cream">Abhi koi server add nahi hua</p>
            <p className="mx-auto mt-1 max-w-lg text-sm text-dim">
              Upar form se pehla server add karein. Misaal: <code className="rounded bg-raised px-1 font-mono text-xs">https://my-cdn.com/play/{'{imdbid}'}</code>.
              Server add hone ke baad har movie detail page par “Watch Now” button aa jaye ga.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {cfg.servers.map((s, idx) => (
              <li key={s.id} className={`rounded-2xl border p-3 ${s.enabled === false ? 'border-line bg-ink/40 opacity-70' : 'border-line bg-ink/60'}`}>
                <div className="flex flex-wrap items-start gap-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gold/15 font-mono text-xs font-extrabold text-gold">{idx + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-sm font-extrabold text-cream">
                      {s.name}
                      <KindBadge kind={s.kind} />
                      <span className="rounded bg-raised px-1.5 py-0.5 text-[0.62rem] font-bold text-dim">{s.quality}</span>
                      <span className="rounded bg-raised px-1.5 py-0.5 text-[0.62rem] font-bold text-dim">{s.scope}</span>
                      {s.episodic && <span className="rounded bg-saffron/20 px-1.5 py-0.5 text-[0.62rem] font-bold text-amber-700">S/E</span>}
                    </p>
                    <p className="mt-0.5 break-all font-mono text-[0.66rem] text-dim">{s.template}</p>
                    <p className="mt-0.5 text-[0.64rem] text-faint">
                      {s.language}{s.note ? ` · ${s.note}` : ''}{s.rightsConfirmed ? ' · rights confirmed' : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button type="button" aria-label="Move up" title="Move up" onClick={() => move(s, 'up')} disabled={idx === 0 || busy === `mv-${s.id}`} className="rounded p-1.5 text-dim hover:bg-raised hover:text-gold disabled:opacity-30"><ArrowUp size={14} /></button>
                    <button type="button" aria-label="Move down" title="Move down" onClick={() => move(s, 'down')} disabled={idx === cfg.servers.length - 1 || busy === `mv-${s.id}`} className="rounded p-1.5 text-dim hover:bg-raised hover:text-gold disabled:opacity-30"><ArrowDown size={14} /></button>
                    <button
                      type="button"
                      aria-label="Test this server in a new tab"
                      title="Open this server with the sample IMDb ID"
                      onClick={() => {
                        const imdb = /^tt\d{6,10}$/.test(previewId) ? previewId : 'tt22084616';
                        const url = buildServerUrl(s.template, { imdbId: imdb, title: 'Test', year: 2024, type: s.scope === 'series' ? 'series' : 'movie', season: 1, episode: 1 });
                        if (url) window.open(url, '_blank', 'noopener,noreferrer');
                      }}
                      className="rounded p-1.5 text-dim hover:bg-raised hover:text-gold"
                    >
                      <ExternalLink size={14} />
                    </button>
                    <button type="button" aria-label="Duplicate" title="Duplicate" onClick={() => duplicate(s)} disabled={busy === `cp-${s.id}`} className="rounded p-1.5 text-dim hover:bg-raised hover:text-gold"><Copy size={14} /></button>
                    <button type="button" aria-label="Edit" title="Edit" onClick={() => startEdit(s)} className="rounded p-1.5 text-dim hover:bg-raised hover:text-gold"><Pencil size={14} /></button>
                    <button
                      type="button"
                      aria-label={s.enabled === false ? 'Switch on' : 'Switch off'}
                      title={s.enabled === false ? 'Switch on' : 'Switch off'}
                      onClick={() => toggle(s)}
                      disabled={busy === `tg-${s.id}`}
                      className={`rounded px-1.5 py-1 text-[0.66rem] font-extrabold ${s.enabled === false ? 'text-dim hover:text-gold' : 'text-emerald-700'}`}
                    >
                      {s.enabled === false ? 'OFF' : 'ON'}
                    </button>
                    <button type="button" aria-label="Delete" title="Delete" onClick={() => remove(s)} disabled={busy === `del-${s.id}`} className="rounded p-1.5 text-rose-600 hover:bg-rose-50"><Trash2 size={14} /></button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-raised p-3 text-[0.7rem] text-dim">
          <ShieldCheck size={14} className="shrink-0 text-emerald-700" />
          <span className="min-w-0 flex-1">
            Sirf apne ya licensed servers add karein. Har title ke page par <b>/licence</b> ka link bhi hai jahan streaming-rights policy likhi hai.
          </span>
          <a href="/licence" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-gold hover:underline">
            Licence page <ExternalLink size={11} />
          </a>
        </div>
      </section>

      {/* ads */}
      <section className="space-y-3 rounded-3xl border border-line bg-surface p-5">
        <h3 className="inline-flex items-center gap-1.5 font-display text-lg font-extrabold text-cream">
          <Play size={16} className="text-gold" /> Mizanora pre-roll ad (player se pehle)
        </h3>
        <p className="text-xs text-dim">
          Viewer jab Watch dabaye, pehle Mizanora products ka apna ad chalta hai, phir stream load hota hai. Ad ke baad wohi products sidebar mein bhi nazar aate hain.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-start gap-2.5 rounded-xl border border-line bg-surface p-3 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#0B6B45]" checked={cfg.ads.enabled !== false} onChange={(e) => setAd('enabled', e.target.checked)} />
            <span><b className="block text-cream">Pre-roll ad ON</b><small className="text-dim">Off: stream foran chalta hai.</small></span>
          </label>
          <label className="block text-sm">
            <span className="label">Ad ki lambai (seconds, 0–30)</span>
            <input type="number" min={0} max={30} className="input" value={cfg.ads.seconds} onChange={(e) => setAd('seconds', Number(e.target.value))} />
          </label>
          <label className="block text-sm">
            <span className="label">Skip kab se (seconds)</span>
            <input type="number" min={0} max={20} className="input" value={cfg.ads.skipAfter} onChange={(e) => setAd('skipAfter', Number(e.target.value))} />
          </label>
          <label className="block text-sm">
            <span className="label">Ad heading</span>
            <input className="input" maxLength={50} value={cfg.ads.headline || ''} onChange={(e) => setAd('headline', e.target.value)} placeholder="Mizanora Store" />
          </label>
        </div>
        <label className="block text-sm">
          <span className="label">Ad ke neeche ek line (COD waghera)</span>
          <input className="input" maxLength={180} value={cfg.ads.note || ''} onChange={(e) => setAd('note', e.target.value)} />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={saveAds} disabled={busy === 'ads'} className="btn-gold inline-flex items-center gap-1.5 text-sm">
            {busy === 'ads' ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save ad settings
          </button>
          <span className="inline-flex items-center gap-1 text-[0.68rem] text-dim">
            <AlertTriangle size={12} /> Ads are first-party only — no third-party ad network is loaded on movie pages.
          </span>
        </div>
      </section>
    </div>
  );
}
