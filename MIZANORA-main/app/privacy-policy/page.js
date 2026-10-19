import { SITE } from '@/lib/config';
import { pageMeta } from '@/lib/seo';
import { PageHead, Prose } from '@/components/Prose';

export const metadata = pageMeta({ title: 'Privacy policy', description: 'How Mizanora collects and uses your information.', path: '/privacy-policy' });

export default function Privacy() {
  return (
    <>
      <PageHead title="Privacy policy" crumbs={[['/', 'Home'], [null, 'Privacy']]} />
      <Prose>
        <h2>What we collect</h2>
        <p>When you place an order we collect your name, mobile number, delivery address, landmark, city, province, optional notes and the items you ordered. We use this only to confirm, dispatch and deliver your order and to answer your questions.</p>
        <h2>On your device</h2>
        <p>Your cart and your last delivery details are saved in your browser on your own phone so that re-ordering is quick. You can clear them by clearing your browser data.</p>
        <h2>Advertising and analytics</h2>
        <p>We use the Meta Pixel and Meta Conversions API to measure our ads on Facebook and Instagram. They receive information about the pages you view and your orders (such as the order value and a hashed form of your contact details).</p>
        <h2>Who sees your data</h2>
        <p>Your order is stored in Google Firebase. We share your name, phone number and address with the courier company that delivers your parcel. We do not sell your data.</p>
        <h2>Contact</h2>
        <p>Questions? Email <a href={`mailto:${SITE.email}`}>{SITE.email}</a>.</p>
      </Prose>
    </>
  );
}
