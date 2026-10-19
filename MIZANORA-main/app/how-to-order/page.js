import Link from 'next/link';
import { waLink, absUrl } from '@/lib/config';
import { pageMeta, breadcrumbJsonLd } from '@/lib/seo';
import { PageHead, Prose } from '@/components/Prose';
import JsonLd from '@/components/JsonLd';

export const metadata = pageMeta({
  title: 'How to Order, Cash on Delivery',
  description: 'A simple guide to ordering from Mizanora: choose a product, fill one short form, pay on delivery. WhatsApp support is there if you need help.',
  path: '/how-to-order',
});

const howTo = {
  '@context': 'https://schema.org', '@type': 'HowTo', name: 'How to order from Mizanora',
  step: [
    { '@type': 'HowToStep', name: 'Choose a product', text: 'Open the products page and pick your product and size.' },
    { '@type': 'HowToStep', name: 'Fill the checkout form', text: 'Enter your name, mobile number, address, city and province. No account needed.' },
    { '@type': 'HowToStep', name: 'Order confirmation', text: 'Mizanora calls or messages you to confirm the order before dispatch.' },
    { '@type': 'HowToStep', name: 'Pay on delivery', text: 'Pay the rider in cash when your parcel arrives.' },
  ],
  url: absUrl('/how-to-order'),
};

export default function HowToOrder() {
  return (
    <>
      <PageHead title="How to order" intro="Four easy steps. You pay cash on delivery." crumbs={[['/', 'Home'], [null, 'How to order']]} />
      <Prose>
        <ol>
          <li><strong>Choose a product</strong> from the <Link href="/products">products page</Link> and select your size.</li>
          <li><strong>Tap "Buy now"</strong> and fill the short form: name, mobile number, address, nearest landmark, city and province. No account is needed.</li>
          <li><strong>We confirm your order.</strong> Keep your phone nearby. We call or message you to confirm before dispatch.</li>
          <li><strong>Pay on delivery.</strong> Pay the rider in cash when the parcel arrives.</li>
        </ol>
        <div className="callout"><p>Tip: give a complete address with a nearby landmark. It helps the rider find you the first time.</p></div>
        <h2>Need help?</h2>
        <p>Our support team is on WhatsApp at <a href={waLink('Assalam o Alaikum, I need help with my order.')} target="_blank" rel="noopener noreferrer">+92 306 2015326</a>. WhatsApp is for questions and support. Orders are placed on this website.</p>
        <h2>Stay safe</h2>
        <ul>
          <li>Only use the links and the support number on this website.</li>
          <li>We never ask you to send money in advance.</li>
        </ul>
        <p>More tips: <Link href="/blog/how-to-spot-fake-online-shops-pakistan">how to spot fake online shops in Pakistan</Link>.</p>
      </Prose>
      <JsonLd data={[howTo, breadcrumbJsonLd([['/', 'Home'], ['/how-to-order', 'How to order']])]} />
    </>
  );
}
