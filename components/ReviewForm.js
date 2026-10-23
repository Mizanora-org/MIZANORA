'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { reviewProblem } from '@/lib/reviewStats';

export default function ReviewForm({ productId, productName }) {
  const { user, ready } = useAuth();
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [trap, setTrap] = useState(''); // hidden field: only bots fill it
  if (!ready) return null;
  if (!user) return <p className="rounded-xl bg-raised p-3 text-sm text-dim"><Link href="/account" className="font-bold text-gold underline underline-offset-4">Sign in</Link> to write a review.</p>;

  async function submit(e) {
    e.preventDefault();
    const bad = reviewProblem(text);
    if (trap) return; // a bot
    if (bad) { setMsg(bad); return; }
    setBusy(true); setMsg('');
    try {
      // loaded only when a review is sent, so product pages stay light
      const [{ doc, setDoc }, { dbClient }] = await Promise.all([import('firebase/firestore'), import('@/lib/firebase-client')]);
      await setDoc(doc(dbClient(), 'reviews', `${user.uid}_${productId}`), {
        productId, productName, uid: user.uid, name: (user.displayName || 'Customer').slice(0, 40), rating, text: text.trim().slice(0, 600), approved: false, createdAtMs: Date.now(),
      });
      setMsg('Thank you! Your review will appear after we approve it.'); setText('');
    } catch (e2) { setMsg(e2.code === 'permission-denied' ? 'You already reviewed this product, or review rules are not published yet.' : e2.message); }
    setBusy(false);
  }
  return (
    <form onSubmit={submit} className="card space-y-3">
      <h3 className="text-lg font-bold">Write a review</h3>
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setRating(n)}><Star size={30} className={n <= rating ? 'text-saffron' : 'text-line'} fill="currentColor" /></button>)}
      </div>
      <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={trap} onChange={(e) => setTrap(e.target.value)} style={{ position: 'absolute', left: '-9999px', height: 0, width: 0, opacity: 0 }} name="website" />
      <textarea className="input" rows={3} maxLength={600} value={text} onChange={(e) => setText(e.target.value)} placeholder="Tell others about quality, size and delivery" aria-label="Your review" />
      <p className="text-xs text-dim">Sirf wohi likhein jo aap ne khud kharida aur dekha. Har review parhi jati hai; jhooti, copy ki hui ya paise ke badle likhi review hata di jati hai.</p>
      {msg && <p role="status" className="text-sm font-semibold text-gold">{msg}</p>}
      <button className="btn-gold" disabled={busy}>{busy ? 'Sending...' : 'Submit review'}</button>
    </form>
  );
}
