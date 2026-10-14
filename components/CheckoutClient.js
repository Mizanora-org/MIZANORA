'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Loader2, Lock, MapPin, Pencil, ShieldCheck, Tag, Truck } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { authClient, dbClient } from '@/lib/firebase-client';
import { useAuth } from './AuthProvider';
import { rememberOrder } from '@/lib/orders-local';
import { useCart } from './CartProvider';
import { shippingFor, waLink } from '@/lib/config';
import { CITIES, CITY_PROVINCE, PROVINCES } from '@/lib/constants';
import { validateCustomer } from '@/lib/validate';
import { formatPKR } from '@/lib/format';
import { initiateCheckout, getCookie } from '@/lib/metaPixel';
import { getRef } from '@/lib/refClient';
import { PAY_METHODS, PREPAID_PERCENT, payMethod, prepaidOff, cleanPayRef } from '@/lib/payments';

const EMPTY = { name: '', phone: '', address: '', landmark: '', city: '', cityOther: '', province: '', notes: '', website: '' };

export default function CheckoutClient() {
  const { items, ready, subtotal, clear } = useCart();
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');
  const [pending, setPending] = useState(null); // validated delivery details waiting for the customer's final confirmation
  const { user } = useAuth();
  const [addrs, setAddrs] = useState([]);
  const [pick, setPick] = useState('');
  const [saveAddr, setSaveAddr] = useState(true);
  const [label, setLabel] = useState('Home');
  const [code, setCode] = useState('');
  const [coupon, setCoupon] = useState(null);
  const [couponMsg, setCouponMsg] = useState('');
  const [pay, setPay] = useState('COD');
  const [payRef, setPayRef] = useState('');
  const [payErr, setPayErr] = useState('');
  const fired = useRef(false);
  const formRef = useRef(null);

  const shipping = items.length ? shippingFor(subtotal) : 0;
  const discount = coupon ? Math.min(coupon.discount, subtotal) : 0;
  const prepaidDiscount = prepaidOff(subtotal - discount, pay);
  const method = payMethod(pay) || PAY_METHODS[0];
  const total = subtotal - discount - prepaidDiscount + shipping;

  // Returning customers: fill in the details they used last time (stored only on their own device).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('mz_customer') || 'null');
      if (saved) setForm((f) => ({ ...f, ...saved }));
    } catch (_) {}
  }, []);

  // Signed-in customers: load saved addresses and pick the default one.
  useEffect(() => {
    if (!user) { setAddrs([]); return undefined; }
    let live = true;
    getDoc(doc(dbClient(), 'users', user.uid)).then((s) => {
      if (!live || !s.exists()) return;
      const d = s.data();
      const list = Array.isArray(d.addresses) ? d.addresses : [];
      setAddrs(list);
      const def = list.find((a) => a.id === d.defaultAddressId) || list[0];
      if (def) chooseAddr(def);
    }).catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function chooseAddr(a) {
    setPick(a.id);
    setSaveAddr(false);
    setForm((f) => ({ ...f, name: a.name, phone: a.phone, address: a.address, landmark: a.landmark || '', city: CITIES.includes(a.city) ? a.city : 'Other', cityOther: CITIES.includes(a.city) ? '' : a.city, province: a.province }));
  }

  const itemsSig = items.map((i) => `${i.id}:${i.qty}`).join(',');
  async function applyCoupon(c = code, quiet = false) {
    const val = String(c || '').trim();
    if (!val) return;
    if (!quiet) setCouponMsg('');
    try {
      const r = await fetch('/api/coupon', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: val, items: items.map((i) => ({ id: i.id, qty: i.qty })) }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) { setCoupon(null); setCouponMsg(d.error || 'Could not apply this promo code.'); return; }
      setCoupon(d); setCode(d.code);
      setCouponMsg(`Promo code ${d.code} applied: ${d.label}${d.scoped && d.appliesTo.length ? ` on ${d.appliesTo.join(', ')}` : ''}.`);
    } catch { if (!quiet) setCouponMsg('Could not check the promo code. Try again.'); }
  }

  // The promo code is applied ONLY when the customer types it and taps Apply.
  // If the cart changes afterwards, the same code is simply re-checked against the new cart.
  useEffect(() => {
    if (ready && items.length && coupon) applyCoupon(coupon.code, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsSig]);

  useEffect(() => {
    if (ready && items.length && !fired.current) {
      fired.current = true;
      initiateCheckout(items, subtotal);
    }
  }, [ready, items, subtotal]);

  const set = (k) => (e) => {
    const v = e.target.value;
    setForm((f) => {
      const n = { ...f, [k]: v };
      if (k === 'city' && CITY_PROVINCE[v]) n.province = CITY_PROVINCE[v];
      return n;
    });
  };

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const city = form.city === 'Other' ? form.cityOther.trim() : form.city;
    const { ok, errors: errs, clean } = validateCustomer({ ...form, city });
    if (!ok) {
      setErrors(errs);
      const first = formRef.current && formRef.current.querySelector('[aria-invalid="true"]');
      if (first) first.focus();
      return;
    }
    if (method.prepaid && !cleanPayRef(payRef)) { setPayErr('Enter the transaction ID of your payment (at least 6 characters).'); const el = document.getElementById('payref'); if (el) el.focus(); return; }
    setPayErr('');
    setErrors({});
    setServerError('');
    setPending(clean); // show the review sheet; the order is only sent when the customer taps Place order
  }

  async function place() {
    const clean = pending;
    if (!clean || busy) return;
    setBusy(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (user) { try { headers.Authorization = `Bearer ${await authClient().currentUser.getIdToken()}`; } catch (_) {} }
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          coupon: coupon ? coupon.code : '',
          payMethod: pay, payRef,
          ref: getRef(),
          customer: clean,
          items: items.map((i) => ({ id: i.id, size: i.size || '', qty: i.qty })),
          website: form.website, // honeypot: real people leave it empty
          fbp: getCookie('_fbp'), fbc: getCookie('_fbc'), sourceUrl: window.location.href,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'We could not place your order. Please try again, or contact support.');
      try {
        localStorage.setItem('mz_last_order', JSON.stringify(data.order));
        rememberOrder(data.order);
        localStorage.setItem('mz_customer', JSON.stringify({
          name: form.name, phone: form.phone, address: form.address, landmark: form.landmark,
          city: form.city, cityOther: form.cityOther, province: form.province,
        }));
      } catch (_) {}
      if (user && saveAddr) {
        try {
          const rec = { id: `a${Date.now().toString(36)}`, label, name: clean.name, phone: clean.phone, address: clean.address, landmark: clean.landmark, city: clean.city, province: clean.province };
          const next = [...addrs, rec];
          await setDoc(doc(dbClient(), 'users', user.uid), { addresses: next, ...(addrs.length ? {} : { defaultAddressId: rec.id }), updatedAtMs: Date.now() }, { merge: true });
        } catch (_) { /* the order is already placed; saving the address is optional */ }
      }
      clear();
      router.push(`/thank-you?id=${encodeURIComponent(data.order.orderId)}`);
    } catch (err) {
      setServerError(err.message);
      setPending(null);
      setBusy(false);
    }
  }

  if (!ready) return <p className="text-dim">Loading...</p>;
  if (!items.length) {
    return (
      <div className="card text-center">
        <p className="text-lg">Your cart is empty.</p>
        <Link href="/products" className="btn-gold mt-4">Browse products</Link>
      </div>
    );
  }

  const field = (k, label, props = {}, hint) => (
    <div>
      <label htmlFor={k} className="label">{label}</label>
      <input id={k} name={k} value={form[k]} onChange={set(k)} className={`input ${errors[k] ? 'input-err' : ''}`}
        aria-invalid={errors[k] ? 'true' : 'false'} aria-describedby={errors[k] ? `${k}-e` : undefined} {...props} />
      {hint && !errors[k] && <p className="mt-1.5 text-xs text-faint">{hint}</p>}
      {errors[k] && <p id={`${k}-e`} className="field-err">{errors[k]}</p>}
    </div>
  );

  return (
    <>
    <ol className="mx-auto mb-6 flex max-w-md items-center justify-between text-xs font-bold" aria-label="Checkout steps">
      {['Cart', 'Details', 'Confirm'].map((t, n) => (
        <li key={t} className="flex flex-1 items-center gap-2 last:flex-none"><span className={`grid h-7 w-7 place-items-center rounded-full ${n < 2 ? 'bg-gold text-white' : 'bg-raised text-faint'}`}>{n + 1}</span><span className={n < 2 ? 'text-cream' : 'text-faint'}>{t}</span>{n < 2 && <span className="h-px flex-1 bg-line" />}</li>
      ))}
    </ol>
    <form ref={formRef} onSubmit={submit} noValidate className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-4">
        <h2 className="text-2xl font-extrabold">Delivery details</h2>
        {!user && <p className="rounded-xl bg-gold/10 p-3 text-sm text-dim"><Link href="/account" className="font-bold text-gold underline underline-offset-4">Sign in</Link> to use saved addresses and see this order in your history. You can also order as a guest.</p>}
        {addrs.length > 0 && (
          <div>
            <p className="label flex items-center gap-1.5"><MapPin size={15} /> Deliver to a saved address</p>
            <div className="flex flex-wrap gap-2">
              {addrs.map((a) => <button key={a.id} type="button" onClick={() => chooseAddr(a)} className={`rounded-xl border px-3 py-2 text-left text-sm ${pick === a.id ? 'border-gold bg-gold/10' : 'border-line bg-surface'}`}><b className="block">{a.label}</b><span className="block max-w-[14rem] truncate text-xs text-dim">{a.address}, {a.city}</span></button>)}
              <button type="button" onClick={() => { setPick(''); setSaveAddr(true); setForm((f) => ({ ...EMPTY, notes: f.notes })); }} className="rounded-xl border border-dashed border-line px-3 py-2 text-sm font-semibold text-gold">+ New address</button>
            </div>
          </div>
        )}
        {field('name', 'Full name', { autoComplete: 'name', placeholder: 'e.g. Ahmed Ali' })}
        {field('phone', 'Mobile number', { type: 'tel', inputMode: 'tel', autoComplete: 'tel', placeholder: '0300-1234567' }, 'We will call or message this number to confirm your order.')}
        <div>
          <label htmlFor="address" className="label">Complete street address</label>
          <textarea id="address" name="address" rows={3} value={form.address} onChange={set('address')} autoComplete="street-address"
            placeholder="House / building #, street, area" className={`input ${errors.address ? 'input-err' : ''}`}
            aria-invalid={errors.address ? 'true' : 'false'} />
          {errors.address && <p className="field-err">{errors.address}</p>}
        </div>
        {field('landmark', 'Nearest landmark', { placeholder: 'e.g. near Jamia Masjid, opposite school' })}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="city" className="label">City</label>
            <select id="city" name="city" value={form.city} onChange={set('city')} className={`input ${errors.city ? 'input-err' : ''}`} aria-invalid={errors.city ? 'true' : 'false'}>
              <option value="">Select city</option>
              {[...CITIES].sort().map((c) => <option key={c} value={c}>{c}</option>)}
              <option value="Other">Other city</option>
            </select>
            {errors.city && <p className="field-err">{errors.city}</p>}
          </div>
          <div>
            <label htmlFor="province" className="label">Province / region</label>
            <select id="province" name="province" value={form.province} onChange={set('province')} className={`input ${errors.province ? 'input-err' : ''}`} aria-invalid={errors.province ? 'true' : 'false'}>
              <option value="">Select province</option>
              {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            {errors.province && <p className="field-err">{errors.province}</p>}
          </div>
        </div>
        {form.city === 'Other' && field('cityOther', 'Your city name', { placeholder: 'Type your city' })}
        {user && !pick && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-raised p-3 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={saveAddr} onChange={(e) => setSaveAddr(e.target.checked)} className="h-4 w-4 accent-[#0B6B45]" /> Save this address to my account as</label>
            <select value={label} onChange={(e) => setLabel(e.target.value)} className="rounded-lg border border-line bg-white px-2 py-1"><option>Home</option><option>Work</option><option>Other</option></select>
          </div>
        )}
        <div>
          <label htmlFor="notes" className="label">Order notes (optional)</label>
          <textarea id="notes" name="notes" rows={2} value={form.notes} onChange={set('notes')} className="input" placeholder="Anything we should know?" />
        </div>
        {PAY_METHODS.length > 1 && (
          <fieldset>
            <legend className="label">Payment method</legend>
            <div className="grid gap-2">
              {PAY_METHODS.map((m) => (
                <label key={m.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${pay === m.id ? 'border-gold bg-gold/5' : 'border-line bg-surface'}`}>
                  <input type="radio" name="pay" value={m.id} checked={pay === m.id} onChange={() => { setPay(m.id); setPayErr(''); }} className="mt-1 h-4 w-4 accent-[#0B6B45]" />
                  <span className="min-w-0 flex-1"><b className="block text-cream">{m.label}{m.prepaid && PREPAID_PERCENT > 0 ? <span className="ml-2 rounded-full bg-gold px-2 py-0.5 text-[0.65rem] font-bold text-white">{PREPAID_PERCENT}% OFF</span> : null}</b><span className="text-dim">{m.note}</span></span>
                </label>
              ))}
            </div>
            {method.prepaid && (
              <div className="mt-3 rounded-xl border border-line bg-raised p-3 text-sm">
                <p className="font-semibold text-cream">Send {formatPKR(total)} to this {method.label} account:</p>
                <p className="mt-1 break-all text-lg font-extrabold text-gold">{method.acc.num}</p>
                {(method.acc.title || method.acc.bank) && <p className="text-dim">{[method.acc.title, method.acc.bank].filter(Boolean).join(' · ')}</p>}
                <label htmlFor="payref" className="label mt-3">Transaction ID (TID) after payment</label>
                <input id="payref" className={`input ${payErr ? 'input-err' : ''}`} value={payRef} onChange={(e) => { setPayRef(e.target.value); setPayErr(''); }} placeholder="e.g. 12345678901" autoComplete="off" />
                {payErr && <p className="field-err">{payErr}</p>}
                <p className="mt-2 text-xs text-faint">We check your payment before dispatch. If it is not found, we will contact you.</p>
              </div>
            )}
          </fieldset>
        )}
        {/* Honeypot field for bots */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>Website<input tabIndex={-1} autoComplete="off" name="website" value={form.website} onChange={set('website')} /></label>
        </div>
      </div>

      <aside className="h-fit space-y-4 lg:sticky lg:top-24">
        <div className="card">
          <h2 className="mb-3 text-2xl font-semibold">Your order</h2>
          <ul className="space-y-3">
            {items.map((i) => (
              <li key={i.key} className="flex gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-raised">{i.image && <Image src={i.image} alt="" fill sizes="56px" className="object-cover" />}</div>
                <div className="min-w-0 flex-1 text-sm"><p className="line-clamp-2">{i.name}</p><p className="text-faint">{i.size ? `${i.size} · ` : ''}Qty {i.qty}</p></div>
                <p className="text-sm font-semibold">{formatPKR(i.price * i.qty)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-line pt-3 text-sm">
            <div className="flex justify-between"><dt className="text-dim">Subtotal</dt><dd>{formatPKR(subtotal)}</dd></div>
            {discount > 0 && <div className="flex justify-between text-gold"><dt>Promo {coupon.code}</dt><dd>- {formatPKR(discount)}</dd></div>}
            {prepaidDiscount > 0 && <div className="flex justify-between text-gold"><dt>Prepaid discount ({PREPAID_PERCENT}%)</dt><dd>- {formatPKR(prepaidDiscount)}</dd></div>}
            <div className="flex justify-between"><dt className="text-dim">Delivery</dt><dd>{shipping > 0 ? formatPKR(shipping) : 'Free'}</dd></div>
            <div className="flex justify-between text-base font-bold"><dt>{method.prepaid ? 'Pay now' : 'Pay on delivery'}</dt><dd className="text-gold">{formatPKR(total)}</dd></div>
          </dl>
          <div className="mt-4 border-t border-line pt-3">
            <label htmlFor="cpn" className="label flex items-center gap-1.5"><Tag size={15} /> Promo code</label>
            <div className="flex gap-2"><input id="cpn" className="input !py-2.5 uppercase" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter promo code" /><button type="button" onClick={() => applyCoupon()} disabled={!code.trim()} className="btn-ghost !px-4 !py-2.5 text-sm">Apply</button></div>
            {couponMsg && <p role="status" className={`mt-1.5 text-xs ${coupon ? 'font-semibold text-gold' : 'text-red-600'}`}>{couponMsg}</p>}
          </div>
        </div>
        {serverError && (
          <div role="alert" className="rounded-xl border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-700">
            {serverError}{' '}
            <a className="font-bold underline" target="_blank" rel="noopener noreferrer" href={waLink(`Assalam o Alaikum, my order could not be placed on the website. Items: ${items.map((i) => `${i.name}${i.size ? ` (${i.size})` : ''} x${i.qty}`).join(', ')}. Total: ${formatPKR(total)}. Name: ${form.name}, Phone: ${form.phone}, Address: ${form.address}, ${form.city === 'Other' ? form.cityOther : form.city}.`)}>Send this order to support on WhatsApp</a>{' '}
            <a className="underline" href={waLink('Assalam o Alaikum, I need help placing my order on the website.')} target="_blank" rel="noopener noreferrer">Contact support</a>
          </div>
        )}
        <button type="submit" disabled={busy} className="btn-gold w-full !py-4 text-base">
          {busy ? <><Loader2 className="animate-spin" size={20} /> Placing order...</> : `Review and confirm · ${formatPKR(total)}`}
        </button>
        <p className="text-center text-xs text-faint">{method.prepaid ? method.label : 'Cash on delivery'}. We will confirm your order by phone or message before dispatch. WhatsApp is for support only.</p>
      </aside>

      {pending && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Confirm your order">
          <div className="mz-anim max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl" style={{ animation: 'mz-sheet .28s ease-out' }}>
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line sm:hidden" />
            <h2 className="text-2xl font-extrabold">Confirm your order</h2>
            <p className="text-sm text-dim">{method.prepaid ? 'Please check everything once. Your payment is verified before dispatch.' : 'Please check everything once. You pay only when the parcel reaches you.'}</p>

            <ul className="mt-4 space-y-2.5">
              {items.map((i) => (
                <li key={i.key} className="flex items-center gap-3 rounded-xl bg-raised p-2.5">
                  <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white">{i.image && <Image src={i.image} alt="" fill sizes="56px" className="object-cover" />}</span>
                  <span className="min-w-0 flex-1 text-sm"><b className="line-clamp-2">{i.name}</b><span className="block text-faint">{i.size ? `${i.size} · ` : ''}Qty {i.qty}</span></span>
                  <b className="shrink-0 text-sm">{formatPKR(i.price * i.qty)}</b>
                </li>
              ))}
            </ul>

            <div className="mt-4 rounded-xl border border-line p-3 text-sm">
              <div className="flex items-start justify-between gap-2"><p className="flex items-center gap-1.5 font-bold"><MapPin size={15} className="text-gold" /> Deliver to</p>
                <button type="button" onClick={() => setPending(null)} className="inline-flex items-center gap-1 text-xs font-bold text-gold"><Pencil size={13} /> Edit</button></div>
              <p className="mt-1 font-semibold">{pending.name} · {pending.phone}</p>
              <p className="text-dim">{pending.address}, {pending.city}, {pending.province}</p>
              {pending.landmark && <p className="text-faint">Landmark: {pending.landmark}</p>}
            </div>

            <dl className="mt-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-dim">Subtotal</dt><dd>{formatPKR(subtotal)}</dd></div>
              {discount > 0 && <div className="flex justify-between text-gold"><dt>Promo {coupon.code}</dt><dd>- {formatPKR(discount)}</dd></div>}
              {prepaidDiscount > 0 && <div className="flex justify-between text-gold"><dt>Prepaid discount</dt><dd>- {formatPKR(prepaidDiscount)}</dd></div>}
              <div className="flex justify-between"><dt className="text-dim">Delivery</dt><dd>{shipping > 0 ? formatPKR(shipping) : 'Free'}</dd></div>
              <div className="flex items-center justify-between border-t border-line pt-2.5 text-xl font-extrabold"><dt>{method.prepaid ? 'Paid by ' + method.label : 'Total to pay'}</dt><dd className="text-gold">{formatPKR(total)}</dd></div>
            </dl>

            <button type="button" onClick={place} disabled={busy} className="btn-gold mt-5 w-full !py-4 text-lg">
              {busy ? <><Loader2 className="animate-spin" size={20} /> Placing your order...</> : <><Lock size={18} /> Place order · {formatPKR(total)}</>}
            </button>
            <button type="button" onClick={() => setPending(null)} disabled={busy} className="mt-2 w-full py-2.5 text-sm font-semibold text-dim">Go back and edit</button>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-center text-xs text-faint"><ShieldCheck size={14} /> {method.prepaid ? method.label : 'Cash on delivery'}. Your details are used only for this delivery.</p>
          </div>
        </div>
      )}
    </form>
    </>
  );
}
