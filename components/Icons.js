const S = (children) => function Icon({ size = 22, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {children}
    </svg>
  );
};
export const WhatsAppIcon = S(<><path d="M3 21l1.6-4.6A8.5 8.5 0 1 1 8 19.6L3 21z" /><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l1.2-1.4-2.2-1.1-.9.7a4.5 4.5 0 0 1-2.2-2.2l.7-.9L10.9 8 9 8.5z" /></>);
export const InstagramIcon = S(<><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r=".6" fill="currentColor" /></>);
export const FacebookIcon = S(<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z" />);
export const TikTokIcon = S(<><path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5" /><path d="M14 3c.4 2.6 2 4.2 5 4.5" /></>);
export const YouTubeIcon = S(<><rect x="2.5" y="5.5" width="19" height="13" rx="4" /><path d="M10.5 9.5v5l4.2-2.5-4.2-2.5z" /></>);
export const GitHubIcon = S(<><path d="M9 19c-4.3 1.3-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" /></>);
export const SOCIAL_ICONS = { whatsapp: WhatsAppIcon, instagram: InstagramIcon, facebook: FacebookIcon, tiktok: TikTokIcon, youtube: YouTubeIcon, github: GitHubIcon };
