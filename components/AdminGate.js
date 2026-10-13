'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth';
import { LogOut } from 'lucide-react';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { authClient, dbClient, firebaseConfigured } from '@/lib/firebase-client';

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

// Login wall for /admin. The REAL protection is in firestore.rules (only the admin UID can read orders).
function SetupCheck() {
  const [h, setH] = useState(null);
  useEffect(() => { fetch('/api/health', { cache: 'no-store' }).then((r) => r.json()).then(setH).catch(() => {}); }, []);
  if (!h) return null;
  const todo = [];
  if (!h.firebaseWebConfig) todo.push('NEXT_PUBLIC_FIREBASE_API_KEY and NEXT_PUBLIC_FIREBASE_PROJECT_ID are missing in Vercel (the shop cannot read products).');
  if (!h.imgbbKey) todo.push('IMGBB_API_KEY is missing in Vercel, so photo upload will fail. Add it, then Redeploy.');
  if (h.ordersCanBeSaved === false) todo.push(`ORDERS ARE FAILING: ${h.ordersProblem}`);
  if (!h.metaPixel) todo.push('NEXT_PUBLIC_META_PIXEL_ID is missing, so Meta Pixel is off.');
  if (!todo.length) return null;
  return (
    <div className="mb-5 rounded-xl border border-saffron/50 bg-saffron/10 p-3 text-sm text-cream">
      <p className="font-semibold">Setup check ({h.productsVisibleOnSite} product{h.productsVisibleOnSite === 1 ? '' : 's'} visible on the shop)</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-dim">{todo.map((t) => <li key={t}>{t}</li>)}</ul>
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
  const pathname = usePathname();

  useEffect(() => {
    if (!firebaseConfigured) { setUser(null); return undefined; }
    return onAuthStateChanged(authClient(), (u) => setUser(u || null));
  }, []);

  // Ask Firestore itself whether this account is the admin (same rules that protect the orders).
  // No environment variable is needed for this check.
  useEffect(() => {
    if (!user) { setAccess('checking'); return undefined; }
    let live = true;
    setAccess('checking');
    getDocs(query(collection(dbClient(), 'orders'), limit(1)))
      .then(() => live && setAccess('ok'))
      .catch((e) => live && setAccess(e && e.code === 'permission-denied' ? 'denied' : 'ok'));
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
      <div className="mx-auto max-w-sm px-4 py-16">
        <h1 className="mb-6 text-center text-4xl font-bold">Admin login</h1>
        {user && !allowed && (
          <div className="mb-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-700">
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

  const tab = (href, label) => (
    <Link href={href} className={`rounded-full px-4 py-2 text-sm font-semibold ${pathname.startsWith(href) ? 'bg-gold text-ink' : 'bg-raised text-dim'}`}>{label}</Link>
  );
  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 px-3 py-4 sm:px-4 sm:py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">{tab('/admin/orders', 'Orders')}{tab('/admin/products', 'Products')}{tab('/admin/banners', 'Banners')}{tab('/admin/reels', 'Reels')}{tab('/admin/coupons', 'Promo codes')}{tab('/admin/workers', 'Workers')}{tab('/admin/reviews', 'Reviews')}</div>
        <button onClick={() => signOut(authClient())} className="flex items-center gap-2 text-sm text-dim hover:text-gold"><LogOut size={16} /> Sign out</button>
      </div>
      <SetupCheck />
      {children}
    </div>
  );
}
