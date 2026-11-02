'use client';
import { useCallback, useEffect, useState } from 'react';
import { authClient } from '@/lib/firebase-client';
import { Archive, ExternalLink, Loader2, Megaphone, Save, ShieldCheck } from 'lucide-react';

// Admin > IPTV > Tools: GitHub archive (poora panel aik commit mein) + ads (kisi bhi channel par).
export default function IptvToolsAdmin() {
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const [arch, setArch] = useState(null);
  const [repo, setRepo] = useState('');
  const [branch, setBranch] = useState('main');
  const [token, setToken] = useState('');

  const [ads, setAds] = useState({ enabled: false, all: true, channels: '', prerollUrl: '', imageUrl: '', clickUrl: '', title: '', note: '', skipAfter: 5 });

  const call = useCallback(async (url, body, method = 'POST') => {
    const u = authClient().currentUser;
    if (!u) return { ok: false, error: 'Signed out.' };
    const t = await u.getIdToken();
    try {
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: method === 'GET' ? undefined : JSON.stringify(body),
      });
      return await r.json().catch(() => ({ ok: false, error: `Server ${r.status}` }));
    } catch (e) { return { ok: false, error: e.message }; }
  }, []);

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      call('/api/admin/iptv/archive', null, 'GET'),
      call('/api/admin/iptv/ads', null, 'GET'),
    ]);
    if (a.ok) { setArch(a); setRepo(a.repo || ''); }
    if (b.ok) setAds({ ...b.ads, channels: (b.ads.channels || []).join(', ') });
  }, [call]);

  useEffect(() => { load(); }, [load]);

  async function push() {
    setBusy('push'); setMsg(''); setErr('');
    const j = await call('/api/admin/iptv/archive', { action: 'push', repo, branch, token });
    setBusy(''); setToken('');
    if (!j.ok) { setErr(j.error || 'Push nahi hua.'); return; }
    setMsg(`Archive push — ${j.stats.channels} channels, ${j.stats.movies} movies, ${j.stats.series} series, ${j.lines} lines. Commit ${String(j.commit).slice(0, 7)}.`);
    load();
  }

  async function preview() {
    setBusy('preview'); setMsg(''); setErr('');
    const j = await call('/api/admin/iptv/archive', { action: 'preview' });
    setBusy('');
    if (!j.ok) { setErr(j.error || 'Preview nahi bana.'); return; }
    setMsg(`Preview: ${j.files.length} files — ${j.files.map((f) => `${f.path.split('/').pop()} (${f.kb} KB)`).join(', ')}`);
  }

  async function saveAds() {
    setBusy('ads'); setMsg(''); setErr('');
    const j = await call('/api/admin/iptv/ads', { action: 'save', ads: { ...ads, channels: String(ads.channels || '').split(',').map((x) => x.trim()).filter(Boolean) } });
    setBusy('');
    if (!j.ok) { setErr(j.error || 'Ads save nahi hue.'); return; }
    setAds({ ...j.ads, channels: (j.ads.channels || []).join(', ') });
    setMsg('Ads save ho gaye — player /api/gw/ad se uthata hai.');
  }

  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 font-display text-base font-bold"><Archive size={16} className="text-gold" /> GitHub archive</h2>
            <p className="text-xs text-dim">Catalogue + VOD + M3U + lines CSV aik commit mein private repo mein. Password archive mein nahi jata.</p>
          </div>
          {arch?.tokenSet && <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">token set (env)</span>}
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <input className="input" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="owner/repo (private)" />
          <input className="input" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="branch (main)" />
          <input className="input" value={token} onChange={(e) => setToken(e.target.value)} placeholder="token (optional, save nahi hota)" type="password" />
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-gold" onClick={push} disabled={!!busy || !repo.trim()}>
            {busy === 'push' ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />} Push to GitHub
          </button>
          <button type="button" className="btn-ghost" onClick={preview} disabled={!!busy}>
            {busy === 'preview' ? <Loader2 size={14} className="animate-spin" /> : null} Preview files
          </button>
          {arch?.last?.url && (
            <a className="btn-ghost" href={arch.last.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Last commit</a>
          )}
        </div>

        <p className="flex items-start gap-1.5 text-[11px] text-faint">
          <ShieldCheck size={12} className="mt-0.5 shrink-0" />
          Vercel par <code>GITHUB_ARCHIVE_TOKEN</code> (repo scope) aur <code>GITHUB_ARCHIVE_REPO</code> set karein — phir token paste karne ki zaroorat nahi.
          Encrypted links Firestore mein waise hi rehte hain; archive sirf backup hai.
        </p>
        {arch?.last?.tag && <p className="text-[11px] text-dim">Aakhri: {arch.last.tag} · {arch.last.lines} lines · {new Date(arch.last.at).toLocaleString('en-GB')}</p>}
      </section>

      <section className="card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 font-display text-base font-bold"><Megaphone size={16} className="text-gold" /> Ads (kisi bhi channel par)</h2>
            <p className="text-xs text-dim">Preroll video ya banner. Khali chhorein to "sab channels"; warna ids comma se (12,44,90).</p>
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs">
            <input type="checkbox" className="h-4 w-4 accent-[#0B6B45]" checked={ads.enabled} onChange={(e) => setAds((a) => ({ ...a, enabled: e.target.checked }))} />
            Ads ON
          </label>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <input className="input" value={ads.prerollUrl} onChange={(e) => setAds((a) => ({ ...a, prerollUrl: e.target.value }))} placeholder="Preroll video — https://.../ad.mp4" />
          <input className="input" value={ads.imageUrl} onChange={(e) => setAds((a) => ({ ...a, imageUrl: e.target.value }))} placeholder="Banner image — https://.../banner.jpg" />
          <input className="input" value={ads.clickUrl} onChange={(e) => setAds((a) => ({ ...a, clickUrl: e.target.value }))} placeholder="Click link (WhatsApp / offer)" />
          <input className="input" value={ads.channels} onChange={(e) => setAds((a) => ({ ...a, channels: e.target.value }))} placeholder="Channel ids: 12,44,90 (khali = sab)" />
          <input className="input" value={ads.title} onChange={(e) => setAds((a) => ({ ...a, title: e.target.value }))} placeholder="Ad title (optional)" />
          <input className="input" type="number" min={0} max={30} value={ads.skipAfter} onChange={(e) => setAds((a) => ({ ...a, skipAfter: e.target.value }))} placeholder="Skip after (sec)" />
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-gold" onClick={saveAds} disabled={busy === 'ads'}>
            {busy === 'ads' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save ads
          </button>
          <button type="button" className="btn-ghost" onClick={() => setAds({ enabled: false, all: true, channels: '', prerollUrl: '', imageUrl: '', clickUrl: '', title: '', note: '', skipAfter: 5 })}>Reset</button>
        </div>
      </section>

      {msg && <p className="rounded-xl border border-gold/30 bg-gold/[0.06] px-3 py-2 text-xs font-semibold text-gold">{msg}</p>}
      {err && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{err}</p>}
    </div>
  );
}
