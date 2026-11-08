import { SITE, waLink } from '@/lib/config';
import { pageMeta } from '@/lib/seo';
import { PageHead, Prose } from '@/components/Prose';
import { WhatsAppIcon } from '@/components/Icons';

export const metadata = pageMeta({
  title: 'Contact Mizanora Support',
  description: 'Contact Mizanora support on WhatsApp at +92 306 2015326 or by email. Based in Kasur, Punjab, Pakistan. We deliver across Pakistan.',
  path: '/contact',
});

export default function Contact() {
  return (
    <>
      <PageHead title="Contact support" intro="Questions about an order, sizes or delivery? Our WhatsApp support team is here to help. Orders are placed on the website." crumbs={[['/', 'Home'], [null, 'Contact']]} />
      <Prose>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card"><h2 className="!mt-0 text-2xl">WhatsApp support</h2><p className="!mb-3">+92 306 2015326</p>
            <a className="btn-wa" href={waLink('Assalam o Alaikum, I need help with Mizanora.')} target="_blank" rel="noopener noreferrer"><WhatsAppIcon size={20} /> Chat with support</a></div>
          <div className="card"><h2 className="!mt-0 text-2xl">Email</h2><p><a href={`mailto:${SITE.email}`}>{SITE.email}</a></p></div>
        </div>
        <p className="mt-6"><strong>Location:</strong> {SITE.city}. We deliver across Pakistan.</p>
      </Prose>
    </>
  );
}
