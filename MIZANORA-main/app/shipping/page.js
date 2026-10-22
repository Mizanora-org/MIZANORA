import Link from 'next/link';
import { SITE, waLink } from '@/lib/config';
import { formatPKR } from '@/lib/format';
import { pageMeta } from '@/lib/seo';
import { PageHead, Prose } from '@/components/Prose';

export const metadata = pageMeta({ title: 'Delivery and shipping', description: 'How Mizanora delivers across Pakistan: cash on delivery, the delivery fee, tracking your order and what to check when the parcel arrives.', path: '/shipping' });

export default function Shipping() {
  const fee = SITE.shippingFee;
  return (
    <>
      <PageHead title="Delivery and shipping" intro="How your parcel reaches you, what it costs and how to follow it." crumbs={[['/', 'Home'], [null, 'Delivery']]} />
      <Prose>
        <h2>Where we deliver</h2>
        <p>Mizanora delivers across Pakistan. Big cities are usually quicker; remote areas can take longer. We never promise a day we cannot keep: your order confirmation and our WhatsApp team tell you what to expect for your city.</p>
        <h2>Delivery fee</h2>
        <p>{fee > 0 ? <>The delivery fee is <b>{formatPKR(fee)}</b> per order{SITE.freeShippingOver > 0 ? <>, and delivery is <b>free</b> when your cart reaches {formatPKR(SITE.freeShippingOver)}</> : null}.</> : <>Delivery is <b>free</b> on all orders.</>} The exact amount is always shown in your cart and at checkout before you confirm. There are no hidden charges.</p>
        <h2>Payment: cash on delivery</h2>
        <p>You pay the rider when the parcel is in your hands. Please keep the amount ready. Read more in <Link href="/blog/cash-on-delivery-pakistan">cash on delivery in Pakistan</Link>.</p>
        <h2>Give us a good address</h2>
        <ul>
          <li>Your full name and a phone number that is on while the rider comes</li>
          <li>House or shop number, street, area (mohalla) and a known landmark</li>
          <li>City and province, chosen from the list</li>
        </ul>
        <h2>Follow your order</h2>
        <p>Use <Link href="/track">order tracking</Link> with your order ID, or open <Link href="/account">your account</Link> to see every order and its bill.</p>
        <h2>When the parcel arrives</h2>
        <p>Open it in front of the rider where possible and compare it with the product page. Our <Link href="/blog/parcel-arrived-checklist-what-to-check">parcel checklist</Link> shows what to check. If something is wrong, read our <Link href="/returns">returns page</Link> and message us on <a href={waLink('Assalam o Alaikum, I have a question about my delivery. Order ID: ')} target="_blank" rel="noopener noreferrer">WhatsApp</a> with your order ID and a photo.</p>
      </Prose>
    </>
  );
}
