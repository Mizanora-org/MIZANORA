'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Minus, Plus, ShoppingBag, Zap } from 'lucide-react';
import { useCartActions } from './CartProvider';
import { addToCart } from '@/lib/metaPixel';
import { waLink } from '@/lib/config';
import { formatPKR } from '@/lib/format';
import { WhatsAppIcon } from './Icons';
import InstallButton from './InstallButton';
import { useRefMarkup } from '@/lib/refClient';
import { colorHex, isColorOption, variantLabel } from '@/lib/options';

export default function ProductActions({ product }) {
  const { add } = useCartActions();
  const router = useRouter();
  const [sel, setSel] = useState({});
  const [qty, setQty] = useState(1);
  const [err, setErr] = useState('');
  const [added, setAdded] = useState(false);
  const opts = product.options || [];
  const mk = useRefMarkup(product.id);

  const ok = () => {
    const missing = opts.find((o) => !sel[o.name]);
    if (missing) {
      setErr(`Please choose ${missing.name.toLowerCase()} first`);
      document.getElementById('opt-picker')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    setErr('');
    return true;
  };
  const put = () => { add(product, { size: variantLabel(opts, sel), qty }); addToCart(product, qty); };
  const buyNow = () => { if (ok()) { put(); router.push('/checkout'); } };

  if (!product.inStock) {
    return (
      <div className="mt-6 rounded-2xl border border-line bg-surface p-4">
        <p className="font-semibold text-cream">Currently sold out</p>
        <p className="mt-1 text-sm text-dim">Ask our support team when it will be back.</p>
        <a className="btn-wa mt-3 w-full" href={waLink(`Assalam o Alaikum, when will "${product.name}" be back in stock?`)} target="_blank" rel="noopener noreferrer"><WhatsAppIcon size={20} /> Ask support on WhatsApp</a>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div id="opt-picker" className="space-y-4">
        {opts.map((o) => (
          <fieldset key={o.name}>
            <legend className="mb-2 text-sm font-semibold text-cream">{o.name}{sel[o.name] ? <span className="ml-1.5 font-normal text-dim">: {sel[o.name]}</span> : null}</legend>
            <div className="flex flex-wrap gap-2">
              {o.values.map((v) => {
                const on = sel[o.name] === v;
                const hex = isColorOption(o.name) ? colorHex(v) : '';
                return (
                  <button key={v} type="button" onClick={() => { setSel((c) => ({ ...c, [o.name]: v })); setErr(''); }} aria-pressed={on}
                    className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold ${on ? 'border-gold bg-gold text-white' : 'border-line bg-surface text-cream hover:border-gold'}`}>
                    {hex && <span className="h-4 w-4 shrink-0 rounded-full border border-black/20" style={{ background: hex }} aria-hidden="true" />}
                    {v}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
      {err && <p role="alert" className="mt-2 text-sm font-semibold text-red-600">{err}</p>}

      <div className="mt-4 flex items-center gap-3">
        <span className="text-sm font-semibold text-cream">Quantity</span>
        <div className="flex items-center rounded-xl border border-line bg-surface">
          <button type="button" aria-label="Decrease" className="p-3" onClick={() => setQty((q) => Math.max(1, q - 1))}><Minus size={16} /></button>
          <span className="w-8 text-center font-semibold" aria-live="polite">{qty}</span>
          <button type="button" aria-label="Increase" className="p-3" onClick={() => setQty((q) => Math.min(10, q + 1))}><Plus size={16} /></button>
        </div>
      </div>

      {mk > 0 && <p className="mt-3 rounded-xl bg-gold/10 p-2.5 text-sm font-semibold text-gold">Your price through this seller link: {formatPKR(product.price + mk)}</p>}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button type="button" className="btn-gold" onClick={buyNow}><Zap size={18} /> Buy now, pay on delivery</button>
        <button type="button" className="btn-ghost" onClick={() => { if (ok()) { put(); setAdded(true); } }}><ShoppingBag size={18} /> Add to cart</button>
      </div>

      {added && (
        <div role="status" className="mt-4 rounded-2xl border border-bronze bg-surface p-4">
          <p className="flex items-center gap-2 font-semibold text-cream"><Check size={18} className="text-gold" /> Added to your cart</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href="/checkout" className="btn-gold !py-2.5">Checkout</Link>
            <Link href="/products" className="btn-ghost !py-2.5">Keep shopping</Link>
          </div>
          <InstallButton className="mt-3" full />
        </div>
      )}

      {/* Phone only: sticky buy bar, like big marketplaces */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-line bg-ink/95 px-3 py-2.5 backdrop-blur md:hidden">
        <div className="min-w-0">
          <p className="text-lg font-bold leading-tight text-gold">{formatPKR((product.price + mk) * qty)}</p>
          <p className="text-[0.7rem] text-dim">Cash on delivery</p>
        </div>
        <button type="button" onClick={buyNow} className="btn-gold ml-auto !px-6 !py-3"><Zap size={18} /> Buy now</button>
      </div>
    </div>
  );
}
