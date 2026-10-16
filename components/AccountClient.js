'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GoogleAuthProvider, createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, signOut, updateProfile } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, limit, query, setDoc, where } from 'firebase/firestore';
import { BadgePercent, ChevronDown, ChevronUp, Heart, KeyRound, LogOut, MapPin, Package, Pencil, Plus, RotateCcw, ShieldCheck, Smartphone, Star, Trash2, Truck, UserRound } from 'lucide-react';
import { authClient, dbClient, firebaseConfigured } from '@/lib/firebase-client';
import { explain, inAppBrowser } from '@/lib/authErrors';
import { CITIES, CITY_PROVINCE, PROVINCES } from '@/lib/constants';
import { validateCustomer } from '@/lib/validate';
import { formatDate, formatPKR } from '@/lib/format';
import { localOrders } from '@/lib/orders-local';
import { completeRegistration } from '@/lib/metaPixel';
import { useAuth } from './AuthProvider';
import { useCart } from './CartProvider';
import OrderBill from './OrderBill';
import { getWish } from '@/lib/wish';

const EMPTY_ADDR = { label: 'Home', name: '', phone: '', address: '', landmark: '', city: '', cityOther: '', province: '' };

function GoogleG() {
  return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.3 6.5v5.4h7c4.1-3.8 6.6-9.4 6.6-15.9z"/><path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-7-5.4c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.7-3.9-12.4-9.2H4.4v5.6C8 41.4 15.4 46 24 46z"/><path fill="#FBBC05" d="M11.6 28.2c-.4-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.6H4.4C2.9 17.2 2 20.5 2 24s.9 6.8 2.4 9.8l7.2-5.6z"/><path fill="#EA4335" d="M24 10.6c3.3 0 6.2 1.1 8.5 3.3l6.4-6.4C34.9 3.9 29.9 2 24 2 15.4 2 8 6.6 4.4 14.2l7.2 5.6c1.7-5.3 6.6-9.2 12.4-9.2z"/></svg>;
}

function SignIn() {
  const [mode, setMode] = useState('in'); // in | up | reset
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function google() {
    setBusy(true); setErr('');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      if (inAppBrowser()) { await signInWithRedirect(authClient(), provider); return; }
      await signInWithPopup(authClient(), provider);
    } catch (e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment') {
        try { await signInWithRedirect(authClient(), provider); return; } catch (e2) { setErr(explain(e2)); }
      } else if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') setErr(explain(e));
    }
    setBusy(false);
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(''); setMsg('');
    try {
      if (mode === 'reset') {
        await sendPasswordResetEmail(authClient(), email.trim());
        setMsg('Password reset email sent. Check your inbox and spam folder.');
      } else if (mode === 'up') {
        if (name.trim().length < 2) throw { code: '', message: 'Please enter your name.' };
        const cred = await createUserWithEmailAndPassword(authClient(), email.trim(), pw);
        await updateProfile(cred.user, { displayName: name.trim() });
        await setDoc(doc(dbClient(), 'users', cred.user.uid), { name: name.trim(), email: email.trim(), createdAtMs: Date.now() }, { merge: true });
        completeRegistration();
      } else {
        await signInWithEmailAndPassword(authClient(), email.trim(), pw);
      }
    } catch (e2) { setErr(e2.code ? explain(e2) : e2.message); }
    setBusy(false);
  }

  return (
    <div className="mx-auto grid max-w-4xl overflow-hidden rounded-3xl border border-line bg-surface shadow-xl md:grid-cols-2">
      <div className="relative hidden flex-col justify-between bg-gradient-to-br from-[#0B6B45] via-[#0E8556] to-[#073D28] p-8 text-white md:flex">
        <span className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-saffron/30 blur-2xl" aria-hidden="true" />
        <div className="relative">
          <p className="font-display text-3xl font-extrabold leading-tight">Welcome to the Mizanora market</p>
          <p className="mt-2 text-white/85">One account. Faster checkout. Every order in one place.</p>
        </div>
        <ul className="relative mt-8 space-y-4 text-sm">
          {[[MapPin, 'Save your addresses', 'Order in a few taps'], [Package, 'Track every order', 'See each bill and its status'], [BadgePercent, 'Use coupon codes', 'Get member offers'], [Heart, 'Wishlist and reviews', 'Save products, share your opinion'], [ShieldCheck, 'Pay on delivery', 'Always cash on delivery']].map(([Icon, t, d]) => (
            <li key={t} className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/15"><Icon size={20} /></span><span><b className="block">{t}</b><span className="text-white/80">{d}</span></span></li>
          ))}
        </ul>
      </div>
      <div className="space-y-4 p-5 sm:p-8">
        <div className="flex items-center gap-2 rounded-xl bg-gold/10 p-2.5 text-xs font-semibold text-gold md:hidden"><Truck size={16} /> Save addresses, track orders and use coupons</div>
        <h2 className="text-2xl font-extrabold">{mode === 'up' ? 'Create your account' : mode === 'reset' ? 'Reset password' : 'Welcome back'}</h2>
        <p className="text-sm text-dim">An account saves your addresses, keeps your order history and shows your bill any time. You can still order without one.</p>
        {mode !== 'reset' && <button type="button" onClick={google} disabled={busy} className="btn-ghost w-full !border-line !text-cream"><GoogleG /> Continue with Google</button>}
        <form onSubmit={submit} className="space-y-3">
          {mode === 'up' && <div><label className="label" htmlFor="an">Your name</label><input id="an" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required /></div>}
          <div><label className="label" htmlFor="ae">Email</label><input id="ae" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></div>
          {mode !== 'reset' && <div><label className="label" htmlFor="ap">Password</label><input id="ap" type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} minLength={6} required /></div>}
          {err && <p role="alert" className="field-err">{err}</p>}
          {msg && <p role="status" className="text-sm font-semibold text-gold">{msg}</p>}
          <button className="btn-gold w-full" disabled={busy}>{busy ? 'Please wait...' : mode === 'up' ? 'Create account' : mode === 'reset' ? 'Send reset email' : 'Sign in'}</button>
        </form>
        <div className="flex flex-wrap justify-between gap-2 text-sm font-semibold text-gold">
          {mode !== 'in' && <button type="button" onClick={() => { setMode('in'); setErr(''); setMsg(''); }}>Sign in</button>}
          {mode !== 'up' && <button type="button" onClick={() => { setMode('up'); setErr(''); setMsg(''); }}>New here? Create account</button>}
          {mode === 'in' && <button type="button" onClick={() => { setMode('reset'); setErr(''); setMsg(''); }}>Forgot password?</button>}
        </div>
      </div>
    </div>
  );
}

function Addresses({ user }) {
  const [list, setList] = useState(null);
  const [defId, setDefId] = useState('');
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const s = await getDoc(doc(dbClient(), 'users', user.uid));
    const d = s.exists() ? s.data() : {};
    setList(Array.isArray(d.addresses) ? d.addresses : []);
    setDefId(d.defaultAddressId || '');
  }, [user.uid]);
  useEffect(() => { load().catch((e) => { setList([]); setMsg(e.code === 'permission-denied' ? 'Saved addresses need the updated Firestore rules (see SETUP.md).' : e.message); }); }, [load]);

  const save = async (addresses, defaultAddressId = defId) => {
    await setDoc(doc(dbClient(), 'users', user.uid), { addresses, defaultAddressId, updatedAtMs: Date.now() }, { merge: true });
    setList(addresses); setDefId(defaultAddressId);
  };
  const set = (k) => (e) => setForm((f) => { const n = { ...f, [k]: e.target.value }; if (k === 'city' && CITY_PROVINCE[e.target.value]) n.province = CITY_PROVINCE[e.target.value]; return n; });

  async function submit(e) {
    e.preventDefault();
    const city = form.city === 'Other' ? form.cityOther.trim() : form.city;
    const { ok, errors: errs, clean } = validateCustomer({ ...form, city });
    if (!ok) { setErrors(errs); return; }
    setErrors({});
    const rec = { id: form.id || `a${Date.now().toString(36)}`, label: form.label || 'Home', name: clean.name, phone: clean.phone, address: clean.address, landmark: clean.landmark, city: clean.city, province: clean.province };
    const next = form.id ? list.map((a) => (a.id === form.id ? rec : a)) : [...list, rec];
    try { await save(next, defId || rec.id); setForm(null); setMsg('Address saved.'); } catch (e2) { setMsg(e2.message); }
  }
  const edit = (a) => setForm({ ...EMPTY_ADDR, ...a, cityOther: CITIES.includes(a.city) ? '' : a.city, city: CITIES.includes(a.city) ? a.city : 'Other' });
  const err = (k) => errors[k] && <p className="field-err">{errors[k]}</p>;

  if (!list) return <ListSkeleton rows={2} />;
  return (
    <div className="space-y-3">
      {msg && <p role="status" className="rounded-xl bg-raised p-3 text-sm">{msg}</p>}
      {list.length === 0 && !form && <p className="card text-center text-dim">No saved addresses yet. Add one and checkout becomes one tap.</p>}
      {list.map((a) => (
        <div key={a.id} className="card !p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 text-sm">
              <p className="font-bold">{a.label} {defId === a.id && <span className="ml-1 rounded-full bg-gold/10 px-2 py-0.5 text-xs text-gold">Default</span>}</p>
              <p className="text-cream">{a.name} · {a.phone}</p>
              <p className="text-dim">{a.address}, {a.city}, {a.province}</p>
              {a.landmark && <p className="text-faint">Landmark: {a.landmark}</p>}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
            <button type="button" className="text-gold" onClick={() => edit(a)}>Edit</button>
            {defId !== a.id && <button type="button" className="text-gold" onClick={() => save(list, a.id)}><Star size={14} className="mr-1 inline" />Make default</button>}
            <button type="button" className="text-red-700" onClick={() => { if (confirm('Delete this address?')) save(list.filter((x) => x.id !== a.id), defId === a.id ? '' : defId); }}><Trash2 size={14} className="mr-1 inline" />Delete</button>
          </div>
        </div>
      ))}
      {form ? (
        <form onSubmit={submit} noValidate className="card space-y-3">
          <h3 className="text-xl font-bold">{form.id ? 'Edit address' : 'New address'}</h3>
          <div className="flex gap-2">{['Home', 'Work', 'Other'].map((l) => <button key={l} type="button" onClick={() => setForm((f) => ({ ...f, label: l }))} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${form.label === l ? 'bg-gold text-white' : 'bg-raised text-dim'}`}>{l}</button>)}</div>
          <div><label className="label" htmlFor="x1">Full name</label><input id="x1" className="input" value={form.name} onChange={set('name')} autoComplete="name" />{err('name')}</div>
          <div><label className="label" htmlFor="x2">Mobile number</label><input id="x2" className="input" type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} placeholder="0300-1234567" />{err('phone')}</div>
          <div><label className="label" htmlFor="x3">Complete street address</label><textarea id="x3" rows={2} className="input" value={form.address} onChange={set('address')} />{err('address')}</div>
          <div><label className="label" htmlFor="x4">Nearest landmark</label><input id="x4" className="input" value={form.landmark} onChange={set('landmark')} />{err('landmark')}</div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor="x5">City</label><select id="x5" className="input" value={form.city} onChange={set('city')}><option value="">Select city</option>{[...CITIES].sort().map((c) => <option key={c}>{c}</option>)}<option value="Other">Other city</option></select>{err('city')}</div>
            <div><label className="label" htmlFor="x6">Province</label><select id="x6" className="input" value={form.province} onChange={set('province')}><option value="">Select province</option>{PROVINCES.map((p) => <option key={p}>{p}</option>)}</select>{err('province')}</div>
          </div>
          {form.city === 'Other' && <div><label className="label" htmlFor="x7">Your city name</label><input id="x7" className="input" value={form.cityOther} onChange={set('cityOther')} /></div>}
          <div className="flex gap-3"><button className="btn-gold flex-1">Save address</button><button type="button" className="btn-ghost" onClick={() => setForm(null)}>Cancel</button></div>
        </form>
      ) : <button type="button" className="btn-ghost w-full" onClick={() => setForm({ ...EMPTY_ADDR })}><Plus size={18} /> Add new address</button>}
    </div>
  );
}

function Orders({ user }) {
  const [orders, setOrders] = useState(null);
  const [open, setOpen] = useState('');
  const [err, setErr] = useState('');
  const { add } = useCart();
  const router = useRouter();

  useEffect(() => {
    let live = true;
    const merge = (remote) => {
      const ids = new Set(remote.map((o) => o.orderId));
      const mine = localOrders().filter((o) => !ids.has(o.orderId) && (!o.uid || o.uid === user?.uid) && !user);
      return [...remote, ...mine].sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
    };
    if (!user) { setOrders(merge([])); return undefined; }
    getDocs(query(collection(dbClient(), 'orders'), where('uid', '==', user.uid), limit(30)))
      .then((snap) => live && setOrders(merge(snap.docs.map((d) => ({ ...d.data(), orderId: d.id })))))
      .catch((e) => { if (live) { setErr(e.code === 'permission-denied' ? 'Order history needs the updated Firestore rules (see SETUP.md).' : e.message); setOrders([]); } });
    return () => { live = false; };
  }, [user]);

  const again = (o) => { o.items.forEach((i) => add({ id: i.id, slug: i.slug, name: i.name, price: i.price, images: i.image ? [i.image] : [] }, { size: i.size || '', qty: i.qty })); router.push('/checkout'); };

  if (!orders) return <ListSkeleton rows={3} />;
  return (
    <div className="space-y-3">
      {err && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {orders.length === 0 && <div className="card text-center"><Package className="mx-auto text-faint" size={36} /><p className="mt-2 font-semibold">No orders yet</p><Link href="/products" className="btn-gold mt-3">Start shopping</Link></div>}
      {orders.map((o) => (
        <div key={o.orderId}>
          <button type="button" onClick={() => setOpen(open === o.orderId ? '' : o.orderId)} aria-expanded={open === o.orderId} className="card flex w-full items-center justify-between gap-3 !p-4 text-left">
            <span className="min-w-0 text-sm">
              <b className="block">{o.orderId} <span className="ml-1 rounded-full bg-gold/10 px-2 py-0.5 text-xs font-bold text-gold">{o.status || 'Pending'}</span></b>
              <span className="block truncate text-dim">{o.items.map((i) => i.name).join(', ')}</span>
              <span className="text-faint">{formatDate(o.createdAtMs)}</span>
            </span>
            <span className="flex shrink-0 items-center gap-2 font-extrabold text-gold">{formatPKR(o.total)}{open === o.orderId ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</span>
          </button>
          {open === o.orderId && (
            <div className="mt-2 space-y-2">
              <OrderBill order={o} />
              <button type="button" onClick={() => again(o)} className="btn-ghost w-full no-print"><RotateCcw size={16} /> Order these items again</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function AccountClient() {
  const { user, ready } = useAuth();
  const [tab, setTab] = useState('orders');
  if (!firebaseConfigured) return <p className="card text-dim">Accounts are not set up yet.</p>;
  if (!ready) return <AccountSkeleton />;
  if (!user) {
    return (
      <div className="space-y-8">
        <SignIn />
        <div>
          <h2 className="section-title mb-3">Orders placed on this phone</h2>
          <Orders user={null} />
          <p className="mt-3 text-sm text-dim">Have an order ID? <Link href="/track" className="font-semibold text-gold underline underline-offset-4">Track it here</Link>.</p>
        </div>
      </div>
    );
  }
  const tabs = [['orders', 'My orders', Package], ['addresses', 'Saved addresses', MapPin], ['worker', 'Earn with us', BadgePercent], ['profile', 'Profile', UserRound]];
  return (
    <div>
      <AccountHeader user={user} />
      <div className="no-sb mb-5 flex gap-2 overflow-x-auto" role="tablist">
        {tabs.map(([k, l, Icon]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold ${tab === k ? 'bg-gold text-white' : 'bg-surface text-dim border border-line'}`}><Icon size={16} />{l}</button>)}
      </div>
      {tab === 'orders' && <Orders user={user} />}
      {tab === 'addresses' && <Addresses user={user} />}
      {tab === 'worker' && (
        <div className="card space-y-3">
          <p className="text-lg font-bold">Mizanora Worker Program</p>
          <p className="text-sm text-dim">Share products with your own link and earn 10% to 50% commission on delivered orders. Free to join: you need your CNIC and a phone.</p>
          <div className="flex flex-wrap gap-3"><Link href="/worker" className="btn-gold !py-2.5">Open worker dashboard / apply</Link><Link href="/workers" className="btn-ghost !py-2.5">How it works</Link></div>
        </div>
      )}
      {tab === 'profile' && <Profile user={user} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// The signed-in header: who you are, since when, and the numbers of your account.
// ---------------------------------------------------------------------------------------------
function initials(name = '', email = '') {
  const base = (name || email.split('@')[0] || 'M').trim();
  return base.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join('') || 'M';
}
const fmtDay = (t) => { try { return new Date(t).toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' }); } catch { return '-'; } };

function AccountHeader({ user }) {
  const [wish, setWish] = useState([]);
  useEffect(() => {
    const read = () => setWish(getWish());
    read();
    window.addEventListener('mz-wish', read);
    return () => window.removeEventListener('mz-wish', read);
  }, []);
  const provider = (user.providerData || [])[0]?.providerId || 'password';
  const via = provider.includes('google') ? 'Google' : provider.includes('apple') ? 'Apple' : provider.includes('facebook') ? 'Facebook' : 'Email and password';
  const created = user.metadata?.creationTime;
  const last = user.metadata?.lastSignInTime;
  return (
    <div className="card mb-5 bg-gradient-to-br from-[#0B6B45] to-[#073D28] !border-0 text-white">
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/15 font-display text-2xl font-extrabold ring-2 ring-white/20">{initials(user.displayName, user.email || '')}</span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-2xl font-extrabold leading-tight">{user.displayName || 'Mizanora customer'}</p>
          <p className="truncate text-sm text-white/85">{user.email}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/75">
            <span className="inline-flex items-center gap-1"><ShieldCheck size={12} /> Signed in with {via}</span>
            {created && <span>Member since {fmtDay(created)}</span>}
            {last && <span>Last sign-in {fmtDay(last)}</span>}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[['Wishlist', wish.length], ['Saved adds', '-'], ['Orders', '-']].map(([l, v], i) => (
            <div key={l} className="rounded-2xl bg-white/10 px-3 py-2">
              <p className="font-display text-lg font-extrabold">{i === 1 ? <SavedCount /> : i === 2 ? <OrderCount user={user} /> : v}</p>
              <p className="text-[0.65rem] text-white/80">{l}</p>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 rounded-xl bg-white/10 p-3 text-xs text-white/85">Tip: on a shared phone always press <b>Sign out</b> in the Profile tab when you finish - your addresses and order history stay safe.</p>
    </div>
  );
}

function SavedCount() {
  const { user } = useAuth();
  const [n, setN] = useState('-');
  useEffect(() => { if (!user) return; getDoc(doc(dbClient(), 'users', user.uid)).then((s) => setN(s.exists() && Array.isArray(s.data().addresses) ? s.data().addresses.length : 0)).catch(() => setN('-')); }, [user]);
  return <>{n}</>;
}
function OrderCount({ user }) {
  const [n, setN] = useState('-');
  useEffect(() => { if (!user) return; getDocs(query(collection(dbClient(), 'orders'), where('uid', '==', user.uid), limit(50))).then((s) => setN(s.size)).catch(() => setN('-')); }, [user]);
  return <>{n}</>;
}

// The Profile tab: edit your name and phone, session tools, password reset and sign out.
function Profile({ user }) {
  const [name, setName] = useState(user.displayName || '');
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { getDoc(doc(dbClient(), 'users', user.uid)).then((s) => { if (s.exists()) { const d = s.data(); setName((x) => x || d.name || ''); setPhone(d.phone || ''); } }).catch(() => {}); }, [user.uid]);

  async function save() {
    setBusy(true); setMsg('');
    try {
      if (name.trim().length >= 2) await updateProfile(authClient().currentUser, { displayName: name.trim() });
      await setDoc(doc(dbClient(), 'users', user.uid), { name: name.trim(), phone: phone.trim(), updatedAtMs: Date.now() }, { merge: true });
      setMsg('Profile saved. Your name now appears on orders and reviews.');
    } catch (e) { setMsg(e.code === 'permission-denied' ? 'Publishing needs the updated Firestore rules (see SETUP.md).' : e.message); }
    setBusy(false);
  }
  async function resetPw() {
    if (!user.email) return;
    try { await sendPasswordResetEmail(authClient(), user.email); setMsg('Password reset email sent. Check your inbox and spam folder.'); } catch (e) { setMsg(e.message); }
  }
  const provider = (user.providerData || [])[0]?.providerId || 'password';
  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <p className="text-lg font-bold">My details</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="pn">Name</label><input id="pn" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div>
          <div><label className="label" htmlFor="pp">Mobile number</label><input id="pp" className="input" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0300-1234567" autoComplete="tel" /></div>
        </div>
        <button type="button" className="btn-gold !py-2.5" disabled={busy} onClick={save}><Pencil size={15} /> {busy ? 'Saving...' : 'Save my details'}</button>
        {msg && <p role="status" className="rounded-xl bg-raised p-3 text-sm text-cream">{msg}</p>}
      </div>

      <div className="card space-y-3">
        <p className="text-lg font-bold">Session &amp; security</p>
        <p className="flex items-start gap-2 text-sm text-dim"><Smartphone size={16} className="mt-0.5 shrink-0" /> You are signed in with <b>{provider.includes('google') ? 'Google' : 'Email and password'}</b> on this device{user.metadata?.lastSignInTime ? `, last on ${fmtDay(user.metadata.lastSignInTime)}` : ''}.</p>
        <div className="flex flex-wrap gap-3">
          {provider.includes('password') && <button type="button" className="btn-ghost !py-2.5" onClick={resetPw}><KeyRound size={15} /> Change password (email link)</button>}
          <Link href="/track" className="btn-ghost !py-2.5">Track an order</Link>
          <Link href="/wishlist" className="btn-ghost !py-2.5"><Heart size={15} /> My wishlist</Link>
          <button type="button" onClick={() => signOut(authClient())} className="btn-ghost !py-2.5 !border-red-400 !text-red-700"><LogOut size={16} /> Sign out</button>
        </div>
        <p className="text-xs text-faint">Signing out only clears this device. Your orders, addresses and wishlist stay with your account.</p>
      </div>
    </div>
  );
}

// Pretty placeholders while the account loads (no bare "Loading..." text anywhere).
function ListSkeleton({ rows = 3 }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="card space-y-2">
          <div className="mz-skel h-4 w-1/3" /><div className="mz-skel h-3.5 w-2/3" /><div className="mz-skel h-3.5 w-1/2" />
        </div>
      ))}
    </div>
  );
}
function AccountSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="card flex items-center gap-4"><div className="mz-skel h-16 w-16 !rounded-2xl" /><div className="flex-1 space-y-2"><div className="mz-skel h-4 w-40" /><div className="mz-skel h-3.5 w-56" /></div></div>
      <ListSkeleton rows={2} />
    </div>
  );
}
