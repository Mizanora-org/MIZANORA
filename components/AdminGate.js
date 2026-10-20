'use client';
import { useEffect, useState } from 'react';
import { GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import { AlertTriangle, CheckCircle2, Plug, ShieldCheck } from 'lucide-react';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import Link from 'next/link';
import { authClient, dbClient, firebaseConfigured } from '@/lib/firebase-client';
import { AdminSearchProvider } from '@/components/AdminSearch';
import AdminNav from '@/components/AdminNav';

const AUTH_HELP = {
  'auth/unauthorized-domain': (h) => `This website (${h}) is not in Firebase "Authorized domains". Firebase Console > Authentication > Settings > Authorized domains > Add domain.`,
  'auth/operation-not-allowed': () => 'This sign-in method is switched off. Firebase Console > Authentication > Sign-in method > enable Google and Email/Password.',
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.': () => 'NEXT_PUBLIC_FIREBASE_API_KEY in Vercel is wrong. Copy it again from Firebase > Project settings, then Redeploy.',
  'auth/invalid-api-key': () => 'NEXT_PUBLIC_FIREBASE_API_KEY in Vercel is missing or wrong. Copy it again from Firebase > Project settings, then Redeploy.',
  'auth/configuration-not-found': () => 'Authentication is not started yet. Firebase Console > Authentication > Get started.',
  'auth/invalid-credential': () => 'Wrong email or password. Or this user was never created: Firebase > Authentication > Users > Add user. You can also use Continue with Google.',
  'auth/wrong-password': () => 'Wrong password.',
  'auth/user-not-found': () => 'No user with this email. Firebase > Authentication > Users > Add user, or use Continue with Google.',
  'auth/invalid-email': () => 'This email address is not valid.',
  'auth/user-disabled': () => 'This user is disabled in Firebase > Authentication > Users.',
  'auth/too-many-requests': () => 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': () => 'No internet or the connection was blocked. Check your connection and try again.',
  'auth/popup-blocked': () => 'The browser blocked the Google window. Allow pop-ups for this site and try again.',
  'auth/web-storage-unsupported': () => 'This browser blocks storage. Open the site in Chrome or Safari (not inside Facebook/Instagram) and try again.',
};
const explain = (e) => {
  const code = (e && e.code) || '';
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const fn = AUTH_HELP[code];
  return `${fn ? fn(host) : 'Sign-in failed.'} [${code || (e && e.message) || 'unknown'}]`;
};
const inAppBrowser = () => typeof navigator !== 'undefined' && /FBAN|FBAV|Instagram|Line\/|; wv\)/i.test(navigator.userAgent);

// The owner's own visits are not counted in the visitor statistics.
const rememberNoTrack = () => { try { localStorage.setItem('mz_notrack', '1'); } catch (_) { /* ignore */ } };

// Admin access is decided by Firestore itself (the same rules that protect the orders): reading ONE order is enough.
// The answer is remembered for 15 minutes per browser session so every admin page does not pay that read again.
const OK_KEY = 'mz_admin_ok';
const okFresh = () => {
  try { const j = JSON.parse(sessionStorage.getItem(OK_KEY) || 'null'); return Boolean(j && j.uid && Date.now() - j.t < 15 * 60e3 ? j : false); } catch (_) { return false; }
};
const rememberOk = (uid) => { try { sessionStorage.setItem(OK_KEY, JSON.stringify({ uid, t: Date.now() })); localStorage.setItem('mz_admin_uid', uid); } catch (_) { /* ignore */ } };
const forgetOk = () => { try { sessionStorage.removeItem(OK_KEY); } catch (_) { /* ignore */ } };

// Compact setup banner. The FULL test of every connection (Firestore, Realtime Database, GitHub) lives in Admin > Connections.
function SetupCheck() {
  const [h, setH] = useState(null);
  useEffect(() => { fetch('/api/health', { cache: 'no-store' }).then((r) => r.json()).then(setH).catch(() => {}); }, []);
  if (!h) return null;
  const todo = [];
  if (!h.firebaseWebConfig) todo.push('NEXT_PUBLIC_FIREBASE_API_KEY and NEXT_PUBLIC_FIREBASE_PROJECT_ID are missing in Vercel (the shop cannot read products).');
  if (!h.imgbbKey) todo.push('IMGBB_API_KEY is missing in Vercel, so photo upload will fail. Add it, then Redeploy.');
  if (h.ordersCanBeSaved === false) todo.push(`ORDERS ARE FAILING: ${h.ordersProblem}`);
  if (!h.metaPixel) todo.push('NEXT_PUBLIC_META_PIXEL_ID is missing, so Meta Pixel is off.');
  const fine = !todo.length;
  return (
    <div className={`mb-4 flex flex-wrap items-start gap-2.5 rounded-xl border p-3 text-sm ${fine ? 'border-line bg-surface' : 'border-saffron/60 bg-saffron/10'}`}>
      {fine ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-gold" /> : <AlertTriangle size={17} className="mt-0.5 shrink-0 text-saffron" />}
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{fine ? 'Setup looks fine' : `Setup check: ${todo.length} thing${todo.length === 1 ? '' : 's'} to fix`}</p>
        {fine ? (
          <p className="text-xs text-dim">{h.totalProducts} product{h.totalProducts === 1 ? '' : 's'} in the shop · {h.firebaseAdminKey ? 'server key OK' : 'server key missing (admin tools need it)'}</p>
        ) : (
          <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-dim">{todo.map((t) => <li key={t}>{t}</li>)}</ul>
        )}
      </div>
      <Link href="/admin/connections" className="btn-ghost !px-3.5 !py-1.5 text-xs"><Plug size={14} /> Test connections</Link>
    </div>
  );
}

export default function AdminGate({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still checking
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [access, setAccess] = useState('checking'); // checking | ok | denied
  useEffect(() => { rememberNoTrack(); }, []);

  useEffect(() => {
    if (!firebaseConfigured) { setUser(null); return undefined; }
    return onAuthStateChanged(authClient(), (u) => setUser(u || null));
  }, []);

  // Ask Firestore itself whether this account is the admin. No environment variable is needed for this check.
  useEffect(() => {
    if (!user) { setAccess('checking'); return undefined; }
    if (okFresh()) { setAccess('ok'); return undefined; }
    let live = true;
    setAccess('checking');
    getDocs(query(collection(dbClient(), 'orders'), limit(1)))
      .then(() => { if (!live) return; rememberOk(user.uid); setAccess('ok'); })
      .catch((e) => {
        if (!live) return;
        // permission-denied is the real "not the admin". Other errors (offline) keep the panel open, the rules still protect the data.
        if (e && e.code === 'permission-denied') { forgetOk(); setAccess('denied'); } else setAccess('ok');
      });
    return () => { live = false; };
  }, [user]);

  async function google() {
    setBusy(true); setErr('');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      // Facebook/Instagram in-app browsers cannot open pop-ups, so go straight to the redirect flow there.
      if (inAppBrowser()) { await signInWithRedirect(authClient(), provider); return; }
      await signInWithPopup(authClient(), provider);
    } catch (e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
        try { await signInWithRedirect(authClient(), provider); return; } catch (e2) { setErr(explain(e2)); setBusy(false); return; }
      }
      if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') setErr(explain(e));
    }
    setBusy(false);
  }

  async function login(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await signInWithEmailAndPassword(authClient(), email.trim(), pw); }
    catch (e2) { setErr(explain(e2)); }
    setBusy(false);
  }

  function GoogleG() {
    return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.3 6.5v5.4h7c4.1-3.8 6.6-9.4 6.6-15.9z"/><path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-7-5.4c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.7-3.9-12.4-9.2H4.4v5.6C8 41.4 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.6 28.2c-.4-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.6H4.4C2.9 17.2 2 20.5 2 24s.9 6.8 2.4 9.8l7.2-5.6z"/><path fill="#EA4335" d="M24 10.6c3.3 0 6.2 1.1 8.5 3.3l6.4-6.4C34.9 3.9 29.9 2 24 2 15.4 2 8 6.6 4.4 14.2l7.2 5.6c1.7-5.3 6.6-9.2 12.4-9.2z"/></svg>;
  }

  if (!firebaseConfigured) {
    return <div className="mx-auto max-w-lg p-8"><p className="card text-dim">Firebase is not configured yet. Add the NEXT_PUBLIC_FIREBASE_* variables in Vercel and redeploy.</p></div>;
  }
  if (user === undefined) return <p className="p-8 text-dim">Loading...</p>;

  if (user && access === 'checking') return <p className="p-8 text-dim">Checking access...</p>;
  const allowed = Boolean(user) && access === 'ok';
  if (!user || !allowed) {
    return (
      <div className="mx-auto max-w-md px-4 py-14">
        <div className="mb-6 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gold text-xl font-extrabold text-white shadow-lg">M</span>
          <h1 className="mt-3 font-display text-3xl font-extrabold">MIZANORA Admin</h1>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-dim"><ShieldCheck size={14} className="text-gold" /> Only the store owner can open this panel</p>
        </div>
        {user && !allowed && (
          <div className="mb-3 rounded-xl border border-red-300 bg-red-500/10 p-3 text-sm text-red-700">
            <p>This account is not the store admin.</p>
            <p className="mt-1 break-all">Signed in as: <b>{user.email || 'unknown'}</b></p>
            <p className="mt-1 break-all text-xs text-red-700/80">Your UID: {user.uid}<br />Firestore rules only allow the UID or the verified email you pasted in the rules. Add this account there and click Publish.</p>
            <button type="button" onClick={() => signOut(authClient())} className="mt-2 rounded-full border border-red-400 px-4 py-1.5 font-semibold">Sign out and try again</button>
          </div>
        )}
        <div className="card space-y-4">
          <button type="button" onClick={google} disabled={busy} className="btn-gold w-full"><GoogleG /> Continue with Google</button>
          {err && <p role="alert" className="field-err">{err}</p>}
          <p className="text-center text-xs text-faint">or sign in with email</p>
        </div>
        <form onSubmit={login} className="card mt-3 space-y-4">
          <div><label htmlFor="em" className="label">Email</label><input id="em" type="email" autoComplete="username" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div><label htmlFor="pw" className="label">Password</label><input id="pw" type="password" autoComplete="current-password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} required /></div>
          <button className="btn-gold w-full" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
        </form>
      </div>
    );
  }

  // -------------------------------------------------------------------------------------------------------------
  // THE ADMIN SHELL: sidebar (desktop) / drawer (phone) + the page. Everything shares one search provider, so the
  // search box in the sidebar filters the list that is open (products, orders...).
  // -------------------------------------------------------------------------------------------------------------
  return (
    <AdminSearchProvider>
      <div className="mx-auto w-full max-w-[1600px] min-w-0 px-3 py-3 sm:px-5 sm:py-5">
        <div className="lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start lg:gap-6">
          <AdminNav email={user.email || ''} />
          <div className="min-w-0">
            <SetupCheck />
            <div className="mz-page">{children}</div>
          </div>
        </div>
      </div>
    </AdminSearchProvider>
  );
}
