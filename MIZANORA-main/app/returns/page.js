import { waLink } from '@/lib/config';
import { pageMeta } from '@/lib/seo';
import { PageHead, Prose } from '@/components/Prose';

export const metadata = pageMeta({ title: 'Returns and exchanges', description: 'How Mizanora handles size problems, damaged items and other order issues.', path: '/returns' });

export default function Returns() {
  return (
    <>
      <PageHead title="Returns and exchanges" crumbs={[['/', 'Home'], [null, 'Returns']]} />
      <Prose>
        <p>We want you to be happy with what you receive. Every problem is handled in a conversation, so we can find a fair solution together.</p>
        <h2>If something is wrong</h2>
        <p>Message us on <a href={waLink('Assalam o Alaikum, I have a problem with my order. Order ID: ')} target="_blank" rel="noopener noreferrer">WhatsApp</a> as soon as you notice the problem. Send your order ID and a clear photo. We will look at your case and tell you the options.</p>
        <h2>Before you order</h2>
        <p>Most problems come from the wrong size. If you are unsure, send us your foot length and we will help you choose.</p>
      </Prose>
    </>
  );
}
