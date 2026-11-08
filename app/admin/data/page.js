'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Archive, CheckCircle2, Database, ShieldAlert } from 'lucide-react';
import { authClient } from '@/lib/firebase-client';

const editor = { livetv: '/admin/tv', movies: '/admin/movies', 'movie-servers': '/admin/play-servers', deals: '/admin/deals', 'app-music': '/admin/music', 'reel-music': '/admin/music', theme: '/admin/ai', banners: '/admin/banners', reels: '/admin/reels' };
const when = (ms) => ms ? new Date(ms).toLocaleString() : '—';

export default function ArchiveData() {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [checks, setChecks] = useState({});
  const api = useCallback(async (body) => {
    const u = authClient().currentUser;
    if (!u) throw new Error('Sign in again.');
    const r = await fetch('/api/admin/snapshots', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await u.getIdToken()}` }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) throw new Error(j.error || `Error ${r.status}`);
    return j;
  }, []);
  const load = useCallback(async () => { try { setState(await api({ action: 'status' })); } catch (e) { setMsg(e.message); } }, [api]);
  useEffect(() => { load(); }, [load]);
  const run = async (kind, action) => {
    if (action === 'capture' && !window.confirm(`Archive ${kind} into PUBLIC GitHub history? Anyone can read this file and all its previous versions forever. No orders, customer data or secret keys should go there. Live Firebase data is NOT deleted. Continue?`)) return;
    setBusy(kind); setMsg('');
    try {
      const j = await api({ action, kind, ...(action === 'capture' ? { confirm: 'PUBLIC' } : {}) });
      if (action === 'verify') setChecks((v) => ({ ...v, [kind]: j }));
      setMsg(j.message || `${kind} checked.`);
      await load();
    } catch (e) { setMsg(e.message); }
    setBusy('');
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-extrabold"><Archive className="text-gold" /> Data archive (repo files)</h1>
        <p className="mt-1 text-sm text-dim">Public configuration ko GitHub JSON file mein ek baar capture karo. File <b>deployment ke baad</b> active hoti hai; phir public reads aur us setting ki admin edits Firestore ko touch nahi karte. Pehle se saved Firestore copy delete nahi hoti.</p>
      </div>
      <div className="rounded-xl border border-amber-400 bg-amber-50 p-4 text-sm text-amber-950">
        <p className="flex items-center gap-2 font-extrabold"><ShieldAlert size={17} /> Important: repository PUBLIC hai</p>
        <p className="mt-1">Sirf public settings archive karein. Stream/panel passwords, signed URLs, API keys, KYC, orders, users, coupons, customer data, security logs aur live control state ko Git history mein kabhi commit na karein. Migration secret-like URLs ko reject karti hai. Archive se restore GitHub history se ho sakta hai, lekin secrets history se delete karna mushkil hota hai.</p>
      </div>
      <div className="card flex flex-wrap items-center justify-between gap-2 !p-3 text-sm">
        <p>GitHub: <b>{state?.github?.ready ? `${state.github.repo} / ${state.github.branch}` : 'GITHUB_TOKEN / GITHUB_REPO not configured'}</b></p>
        <button type="button" className="btn-ghost !px-3 !py-1.5 text-xs" onClick={load}>Refresh status</button>
      </div>
      {msg && <p role="status" className="rounded-xl border border-line bg-raised p-3 text-sm">{msg}</p>}
      {!state ? <p className="text-sm text-dim">Loading archive status...</p> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {state.types.map((t) => {
            const result = checks[t.kind];
            return (
              <section key={t.kind} className="card space-y-2 !p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-bold">{t.label}</h2>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${t.deployed ? 'bg-emerald-100 text-emerald-800' : 'bg-raised text-dim'}`}>
                    {t.deployed ? 'Deployed file · 0 public Firestore reads' : 'Still on Firestore'}
                  </span>
                </div>
                <p className="text-xs text-dim">Source: {t.firestore} · {t.deployed ? `captured ${when(t.at)}` : 'no deployed file'}</p>
                <div className="flex flex-wrap gap-2">
                  {t.deployed ? <button type="button" disabled={!!busy} onClick={() => run(t.kind, 'verify')} className="btn-ghost !px-3 !py-1.5 text-xs">{busy === t.kind ? 'Checking...' : 'Verify deployed ↔ repo ↔ old Firestore'}</button>
                    : <button type="button" disabled={!!busy || !state.github.ready} onClick={() => run(t.kind, 'capture')} className="btn-gold !px-3 !py-1.5 text-xs">{busy === t.kind ? 'Capturing...' : 'Capture public setting'}</button>}
                  <Link href={editor[t.kind] || '/admin'} className="btn-ghost !px-3 !py-1.5 text-xs">Open editor</Link>
                </div>
                {result && (
                  <p className="text-xs text-dim">
                    {result.repoMatches ? <CheckCircle2 size={13} className="mr-1 inline text-emerald-700" /> : <Database size={13} className="mr-1 inline text-amber-600" />}
                    {result.count} record(s) · repo {result.repoMatches ? 'matches deployment' : 'newer/different'} · old Firestore {result.liveMatches === null ? `not checked (${result.liveError})` : result.liveMatches ? 'matches' : 'differs (may contain older data)'}. No deletion performed.
                  </p>
                )}
              </section>
            );
          })}
        </div>
      )}
      <div className="card space-y-2 text-sm text-dim">
        <h2 className="font-extrabold text-cream">Products aur private data</h2>
        <p>Products ki bari tadaad pehle se <code>data/catalog</code> mein hai; live count aur exact archive count <Link className="underline" href="/admin/archive">Archive status</Link> par dekhein. Jo live duplicates hain unko sirf <Link className="underline" href="/admin/archive">Admin → Archive</Link> ki deployed-part verification ke baad clear karein. Counts deploy par badal sakte hain — status wahan se check karein. Customer orders, payments, coupons, KYC aur secrets ko public repo mein migrate nahi kiya jata; inhein private Firebase/RTDB ya dedicated private store mein hi rakhein.</p>
        <p>Live Quran control, stream keys, ad keys/stats aur visitor/security telemetry real-time/private hain; inhein static file banana unsafe ya stale hoga. Unka use separately limited/cached rakha gaya hai.</p>
      </div>
    </div>
  );
}
