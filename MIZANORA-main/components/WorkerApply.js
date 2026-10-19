'use client';
import { useState } from 'react';
import { Camera, CheckCircle2, ShieldCheck } from 'lucide-react';
import { authClient } from '@/lib/firebase-client';
import { CITIES } from '@/lib/constants';

// Shrinks a photo to a small JPEG (about 60-120 KB) so it can be stored privately with the application.
async function toSmallJpeg(file, max = 900) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not read this photo. Please use a JPG or PNG photo.')); i.src = url; });
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.62);
  } finally { URL.revokeObjectURL(url); }
}

function Pick({ label, hint, value, onPick, capture }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <span className={`flex min-h-24 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed ${value ? 'border-gold' : 'border-line'} bg-surface text-sm text-dim`}>
        {value ? <img src={value} alt={label} className="max-h-40 w-full object-contain" /> : <><Camera size={20} /> {hint}</>}
        <input type="file" accept="image/*" capture={capture} className="sr-only" onChange={(e) => e.target.files[0] && onPick(e.target.files[0])} />
      </span>
    </label>
  );
}

export default function WorkerApply({ user, onDone, rejectReason }) {
  const [f, setF] = useState({ fullName: user.displayName || '', phone: '', cnic: '', city: '', address: '', payoutMethod: 'JazzCash', payoutAccount: '', payoutName: '', how: '', social: '', over18: false, agree: false, cnicFront: '', cnicBack: '', selfie: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const pick = (k) => async (file) => { try { setErr(''); const d = await toSmallJpeg(file); setF((x) => ({ ...x, [k]: d })); } catch (e) { setErr(e.message); } };

  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const token = await authClient().currentUser.getIdToken();
      const r = await fetch('/api/worker/apply', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(f) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error(d.error || 'Could not send your application. Please try again.');
      onDone();
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {rejectReason && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Your last application was not approved: {rejectReason}. You can fix it and apply again.</p>}
      <div className="card space-y-3">
        <h2 className="text-xl font-bold">1. About you</h2>
        <div><label className="label" htmlFor="w1">Full name (as on CNIC)</label><input id="w1" className="input" value={f.fullName} onChange={set('fullName')} required /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="w2">Mobile number</label><input id="w2" className="input" inputMode="tel" placeholder="0300-1234567" value={f.phone} onChange={set('phone')} required /></div>
          <div><label className="label" htmlFor="w3">CNIC number (13 digits)</label><input id="w3" className="input" inputMode="numeric" placeholder="12345-1234567-1" value={f.cnic} onChange={set('cnic')} required /></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="w4">City</label><select id="w4" className="input" value={f.city} onChange={set('city')} required><option value="">Select city</option>{[...CITIES].sort().map((c) => <option key={c}>{c}</option>)}<option>Other</option></select></div>
          <div><label className="label" htmlFor="w5">Complete address</label><input id="w5" className="input" value={f.address} onChange={set('address')} required /></div>
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="text-xl font-bold">2. Photos for verification</h2>
        <p className="flex items-start gap-2 text-sm text-dim"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-gold" /> Used only to verify you are a real person (18+) and to stop fake accounts. Stored privately; only the Mizanora admin can see them. Make sure all text is readable.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Pick label="CNIC front" hint="Take / choose photo" value={f.cnicFront} onPick={pick('cnicFront')} />
          <Pick label="CNIC back" hint="Take / choose photo" value={f.cnicBack} onPick={pick('cnicBack')} />
          <Pick label="Selfie holding CNIC" hint="Take selfie" value={f.selfie} onPick={pick('selfie')} capture="user" />
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="text-xl font-bold">3. Where to send your earnings</h2>
        <div className="flex flex-wrap gap-2">{['JazzCash', 'Easypaisa', 'Bank account'].map((m) => <button key={m} type="button" onClick={() => setF((x) => ({ ...x, payoutMethod: m }))} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${f.payoutMethod === m ? 'bg-gold text-white' : 'bg-raised text-dim'}`}>{m}</button>)}</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label" htmlFor="w6">{f.payoutMethod === 'Bank account' ? 'IBAN / account number' : 'Wallet number'}</label><input id="w6" className="input" value={f.payoutAccount} onChange={set('payoutAccount')} required /></div>
          <div><label className="label" htmlFor="w7">Account title (name)</label><input id="w7" className="input" value={f.payoutName} onChange={set('payoutName')} required /></div>
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="text-xl font-bold">4. How will you share links? (optional)</h2>
        <textarea className="input" rows={2} placeholder="WhatsApp groups, Facebook page, TikTok, friends and family..." value={f.how} onChange={set('how')} />
        <input className="input" placeholder="Your Facebook / TikTok / Instagram link (optional)" value={f.social} onChange={set('social')} />
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={f.over18} onChange={set('over18')} /> I am 18 years or older and the details above are mine and true.</label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={f.agree} onChange={set('agree')} /> I will not spam, make false claims about products, or order for myself to earn commission. I understand commission is paid only on delivered orders, and cancelled or returned orders earn nothing.</label>
      </div>

      {err && <p role="alert" className="field-err">{err}</p>}
      <button className="btn-gold w-full" disabled={busy}>{busy ? 'Sending...' : <><CheckCircle2 size={18} /> Send my application</>}</button>
    </form>
  );
}
