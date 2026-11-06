import { pageMeta } from '@/lib/seo';
import { PageHead, Prose } from '@/components/Prose';

export const metadata = pageMeta({ title: 'Terms of use', description: 'Terms for using the Mizanora website and placing orders.', path: '/terms' });

export default function Terms() {
  return (
    <>
      <PageHead title="Terms of use" crumbs={[['/', 'Home'], [null, 'Terms']]} />
      <Prose>
        <h2>Orders</h2>
        <p>When you place an order, we contact you on WhatsApp or by phone to confirm it. An order is final once it is confirmed and dispatched. We may cancel orders we cannot confirm or fulfil.</p>
        <h2>Prices and payment</h2>
        <p>Prices are shown in Pakistani rupees (PKR). Payment is cash on delivery. Please keep the exact amount ready for the rider.</p>
        <h2>Accuracy</h2>
        <p>We try to keep product information accurate. Colours may look slightly different on different screens.</p>
        <h2>Movies, series &amp; live TV</h2>
        <p>
          Mizanora&apos;s Movies &amp; Series hub is a discovery service: official trailers, cast and story guides, a
          release calendar, and — where the site admin has configured a licensed play server — streaming that the
          admin is authorised to provide. You may not download, re-stream, mirror, sell or redistribute any video
          played here. Playback quality depends on your connection and on the configured server. If you own content
          and believe it is shown without permission, use the <a href="/copyright">copyright &amp; takedown</a> page;
          we act on complete reports within 48 hours.
        </p>
        <h2>Links</h2>
        <p>This site links to third-party services. We are not responsible for their content.</p>
      </Prose>
    </>
  );
}
