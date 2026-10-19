'use client';
import { SITE, waLink } from '@/lib/config';
import { contact } from '@/lib/metaPixel';
import { WhatsAppIcon } from './Icons';

// WhatsApp is SUPPORT only. Orders are placed on the website. Tapping it also tells Meta a "Contact" happened.
export default function WhatsAppFab() {
  return (
    <a href={waLink(`Assalam o Alaikum, I need help (${SITE.name} support).`)} target="_blank" rel="noopener noreferrer" onClick={() => contact('whatsapp_fab')}
      aria-label="Chat with support on WhatsApp"
      className="no-print fixed bottom-20 right-3 z-30 flex items-center gap-2 rounded-full bg-wa px-3.5 py-3 text-sm font-semibold text-[#04210f] shadow-xl md:bottom-5 md:right-5">
      <WhatsAppIcon size={22} /><span className="hidden sm:inline">Support</span>
    </a>
  );
}
