'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Archive, CheckCircle2, Database, GitBranch, Loader2, Plug, RefreshCw, Send, ShieldCheck, Upload, Wifi, XCircle } from 'lucide-react';
import { authClient } from '@/lib/firebase-client';

// Admin > Connections. One screen that really TESTS every connection the shop needs and tells you in plain words
// what to fix. Everything here is read-only except one tiny document (_health/conn) that is written and deleted again.
const PILL = {
  ok: 'bg-emerald-500/15 text-emerald-800 border-emerald-300',
  bad: 'bg-red-500/15 text-red-700 border-red-300',
  off: 'bg-raised text-dim border-line',
  wait: 'bg-raised text-dim border-line',
};
const Badge = ({ state, children }) => (
  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[0.7rem] font-bold ${PILL[state] || PILL.off}`}>
    {state === 'ok' ? <CheckCircle2 size={13} /> : state === 'bad' ? <XCircle size={13} /> : state === 'wait' ? <Loader2 size={13} className="animate-spin" /> : <AlertTriangle size={13} />}
    {children}
  </span>
);

function Card({ icon: Icon, title, what, test, state, extra }) {
  return (
    <section className="card !p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-raised text-gold"><Icon size={18} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-extrabold">{title}</h2>
            <Badge state={state}>{state === 'ok' ? 'Working' : state === 'bad' ? 'Problem' : state === 'wait' ? 'Testing...' : 'Not set up'}</Badge>
            {test && test.ok && <span className="text-[0.7rem] text-faint">{test.ms} ms</span>}
          </div>
          <p className="mt-0.5 text-xs text-dim">{what}</p>
          {test && test.ok && <dl className="mt-2 grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">{Object.entries(extra || {}).filter(([, v]) => v !== '' && v !== null && v !== undefined).map(([k, v]) => <div key={k} className="flex gap-1 truncate"><dt className="text-faint">{k}:</dt><dd className="truncate font-medium text-dim">{String(v)}</dd></div>)}</dl>}
          {test && !test.ok && (
            <p className="mt-2 rounded-lg border border-saffron/50 bg-saffron/10 p-2 text-xs text-[#7A5100]">
              {test.error}
              {test.fix ? <><br /><b>Fix:</b> {test.fix}</> : null}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export default function Connections() {
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const run = useCallback(async () => {
    setBusy(true); setErr('');
    try {
      const token = await authClient().currentUser.getIdToken();
      const r = await fetch('/api/admin/connections', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: '{}' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error || `Error ${r.status}`);
      setD(j);
    } catch (e) { setErr((e && e.message) || 'Test failed.'); } finally { setBusy(false); }
  }, []);

  useEffect(() => { run(); }, [run]);

  const stateOf = (t) => (!t ? 'wait' : t.ok ? 'ok' : 'bad');
  const c = d && d.config;
  const env = c && [
    ['Firebase project', c.project],
    ['Web API key (NEXT_PUBLIC_FIREBASE_API_KEY)', c.webKey],
    ['Auth domain', c.authDomain],
    ['App id', c.appId],
    ['Server key (FIREBASE_SERVICE_ACCOUNT / CLIENT_EMAIL + PRIVATE_KEY)', c.adminKey],
    ['Realtime Database address', c.databaseUrl, c.databaseUrlFromEnv ? 'from env' : 'derived from project id'],
    ['GitHub token (GITHUB_TOKEN) + repo (GITHUB_REPO)', c.github.ready, c.github.repo || ''],
    ['Photo upload key (IMGBB_API_KEY)', c.imgbb],
    ['AI key (GEMINI_API_KEY)', c.gemini],
    ['Meta Pixel id', c.metaPixel],
    ['Meta conversions API token', c.metaCapi],
    ['Site URL', c.siteUrl],
  ];

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold sm:text-4xl">Connections</h1>
          <p className="mt-1 text-sm text-dim">Real tests of Firestore, the Realtime Database and GitHub - the three things the shop runs on.</p>
        </div>
        <button type="button" onClick={run} disabled={busy} className="btn-gold !px-5 !py-2.5">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} {busy ? 'Testing...' : 'Test again'}
        </button>
      </div>

      {err && <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-700">{err}</p>}

      {d && (
        <div className={`flex flex-wrap items-center gap-3 rounded-2xl border-2 p-3 ${d.verdict === 'healthy' ? 'border-emerald-300 bg-emerald-500/10' : d.verdict === 'partial' ? 'border-saffron/60 bg-saffron/10' : 'border-red-300 bg-red-500/10'}`}>
          {d.verdict === 'healthy' ? <ShieldCheck size={22} className="text-gold" /> : <AlertTriangle size={22} className="text-saffron" />}
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-bold">
              {d.verdict === 'healthy' ? 'Everything is connected.' : d.verdict === 'partial' ? 'The shop works, but not every connection is on.' : 'The main database is NOT reachable - orders cannot be saved.'}
            </p>
            <p className="text-xs text-dim">
              Tested {new Date(d.at).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })} · Firestore {d.critical.firestore ? 'OK' : 'FAILING'} · Realtime Database {d.critical.rtdb ? 'OK' : 'not reachable'} · GitHub {d.critical.github ? 'OK' : 'not connected'}
              {d.quotaTripped ? ' · Firestore quota marked as used up for a few minutes' : ''}
            </p>
          </div>
          <Link href="/admin/import" className="btn-ghost !px-4 !py-2 text-xs"><Upload size={14} /> Product CSV</Link>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <Card icon={Database} title="Firestore (server key)" what="Orders, admin saves, new products. Through FIREBASE_SERVICE_ACCOUNT." test={d && d.firestoreSdk} state={stateOf(d && d.firestoreSdk)}
          extra={d && d.firestoreSdk && d.firestoreSdk.ok ? { project: d.firestoreSdk.project, write: 'OK', read: 'OK', 'live products': d.firestoreSdk.products } : null} />
        <Card icon={Wifi} title="Firestore (web/browser key)" what="Public reads when the server key is missing; also what the admin login uses." test={d && d.firestoreRest} state={stateOf(d && d.firestoreRest)}
          extra={d && d.firestoreRest && d.firestoreRest.ok ? { project: d.firestoreRest.project, 'page read': `${d.firestoreRest.docs} doc(s)`, 'more pages': d.firestoreRest.next ? 'yes' : 'no' } : null} />
        <Card icon={Send} title="Realtime Database (server key)" what="Live visitors, daily counters, order backup and the shut-down switch. Its quota is separate from Firestore." test={d && d.rtdbSdk} state={stateOf(d && d.rtdbSdk)}
          extra={d && d.rtdbSdk && d.rtdbSdk.ok ? { url: d.rtdbSdk.url, write: 'OK', read: d.rtdbSdk.seen ? 'OK' : 'empty' } : null} />
        <Card icon={Plug} title="Realtime Database (public REST)" what="The copy the website reads first for the shut-down switch - this is why the site can close even on a day the Firestore quota is finished." test={d && d.rtdbRest} state={stateOf(d && d.rtdbRest)}
          extra={d && d.rtdbRest && d.rtdbRest.ok ? { url: d.rtdbRest.url, 'status written': d.rtdbRest.hasStatus ? `yes (${d.rtdbRest.mode || 'normal'})` : 'not yet (normal)' } : null} />
        <Card icon={GitBranch} title="GitHub (archive + big CSV)" what="Lets big CSV imports and Admin > Archive save products as JSON files in your repository - 50,000+ products without touching the free Firebase quota." test={d && d.github} state={stateOf(d && d.github)}
          extra={d && d.github && d.github.ok ? { repo: d.github.repo, branch: d.github.branch, private: d.github.private ? 'yes' : 'no', 'can write': d.github.canPush ? 'yes' : 'NO - read only', head: d.github.head } : null} />
        <section className="card !p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-raised text-gold"><Archive size={18} /></span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-extrabold">Product CSV import</h2>
              <p className="mt-0.5 text-xs text-dim">{d ? d.csv.text : 'Checking what the CSV import can do right now...'}</p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                <Link href="/admin/import" className="btn-ghost !px-3.5 !py-1.5 text-xs"><Upload size={14} /> Import CSV</Link>
                <Link href="/admin/convert" className="btn-ghost !px-3.5 !py-1.5 text-xs">Convert a supplier CSV</Link>
                <Link href="/admin/archive" className="btn-ghost !px-3.5 !py-1.5 text-xs"><Archive size={14} /> Archive</Link>
              </div>
              {d && d.csv.mode === 'archive' && (
                <p className="mt-2 rounded-lg bg-raised p-2 text-[0.7rem] text-dim">
                  Tip: keep the supplier CSV on your computer and upload it from <b>Import CSV</b>. Files with 2,000+ products switch to the
                  archive mode by themselves and are committed into <b>data/catalog</b> of your repository in 500-product parts.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>

      <section className="card !p-4">
        <h2 className="mb-2 text-base font-extrabold">Environment variables found on this deployment</h2>
        {!env ? <p className="text-sm text-dim">Testing...</p> : (
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {env.map(([label, val, note]) => {
              const on = typeof val === 'boolean' ? val : Boolean(val);
              const raw = String(val);
              const hidden = ['NEXT_PUBLIC_FIREBASE_API_KEY', 'IMGBB_API_KEY', 'GEMINI_API_KEY', 'META_CAPI_TOKEN'];
              const shown = typeof val === 'boolean' ? (val ? 'set' : 'missing') : (hidden.includes(label) ? (on ? 'set' : 'missing') : raw || 'missing');
              return (
                <li key={label} className="flex items-center gap-2 rounded-lg bg-raised px-2.5 py-1.5 text-xs">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${on ? 'bg-emerald-500' : 'bg-red-400'}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-dim">{label}</span>
                  <span className={`shrink-0 font-semibold ${on ? 'text-gold' : 'text-red-600'}`}>{shown}{note ? ` · ${note}` : ''}</span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-[0.7rem] leading-5 text-faint">
          Variables are set in Vercel &gt; your project &gt; Settings &gt; Environment Variables; after adding one, press <b>Redeploy</b>.
          Never put secret values in GitHub or in a <code>NEXT_PUBLIC_</code> variable (those are visible to visitors).
        </p>
      </section>
    </div>
  );
}
