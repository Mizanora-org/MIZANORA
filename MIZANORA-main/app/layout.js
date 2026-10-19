import './globals.css';
import { Plus_Jakarta_Sans, Inter, Amiri } from 'next/font/google';
import { SITE } from '@/lib/config';
import { getCategories } from '@/lib/products';
import { orgJsonLd, websiteJsonLd } from '@/lib/seo';
import { CartProvider } from '@/components/CartProvider';
import { AuthProvider } from '@/components/AuthProvider';
import { InstallProvider } from '@/components/InstallProvider';
import AnnouncementBar from '@/components/AnnouncementBar';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import WhatsAppFab from '@/components/WhatsAppFab';
import InstallBanner from '@/components/InstallBanner';
import BottomNav from '@/components/BottomNav';
import PwaRegister from '@/components/PwaRegister';
import MetaPixel from '@/components/MetaPixel';
import JsonLd from '@/components/JsonLd';
import SeasonFX from '@/components/SeasonFX';
import { getThemeMode } from '@/lib/themeServer';
import { seasonFor } from '@/lib/season';
import BackToTop from '@/components/BackToTop';
import RefCapture from '@/components/RefCapture';
import WorkerPrices from '@/components/WorkerPrices';
import SplashScreen from '@/components/SplashScreen';
import RouteProgress from '@/components/RouteProgress';
import CardEvents from '@/components/CardEvents';
import AppFeel from '@/components/AppFeel';
import AssistantFab from '@/components/AssistantFab';
import { getPublicAssistant } from '@/lib/assistantPublic';
import { getAppMusic } from '@/lib/appMusicServer';
import { getSiteStatus } from '@/lib/siteGate';
import SiteGate from '@/components/SiteGate';
import Tracker from '@/components/Tracker';
import Maintenance from '@/components/Maintenance';
import HideOnAdmin from '@/components/HideOnAdmin';
import AppMusic from '@/components/AppMusic';

const display = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--font-display', display: 'swap' });
const arabic = Amiri({ subsets: ['arabic'], weight: ['400', '700'], variable: '--font-arabic', display: 'swap' });
const body = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  colorScheme: 'light',
  viewportFit: 'cover',
  themeColor: '#0B6B45',
};

export const metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: 'Mizanora | Online Shopping in Pakistan, Cash on Delivery', template: '%s | Mizanora' },
  description: SITE.description,
  applicationName: 'Mizanora',
  keywords: ['Mizanora', 'online shopping Pakistan', 'online market Pakistan', 'cash on delivery Pakistan', 'buy online Pakistan', 'halal shopping', 'shopping blog Pakistan'],
  authors: [{ name: 'Mizanora' }],
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  verification: {
    ...(process.env.NEXT_PUBLIC_GSC_VERIFICATION ? { google: process.env.NEXT_PUBLIC_GSC_VERIFICATION } : {}),
    // Meta Business Suite > Brand safety > Domains: paste the verification code here to verify your domain.
    ...(process.env.NEXT_PUBLIC_BING_VERIFICATION ? { other: { 'msvalidate.01': process.env.NEXT_PUBLIC_BING_VERIFICATION } } : {}),
    ...(process.env.NEXT_PUBLIC_FB_DOMAIN_VERIFICATION ? { other: { 'facebook-domain-verification': process.env.NEXT_PUBLIC_FB_DOMAIN_VERIFICATION } } : {}),
  },
  alternates: { types: { 'application/rss+xml': [{ url: '/blog/feed.xml', title: 'Mizanora shopping blog' }] } },
  appleWebApp: { capable: true, title: 'Mizanora', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};

export default async function RootLayout({ children }) {
  const themeMode = await getThemeMode(); // the season look (admin can change it without a redeploy)
  const status = await getSiteStatus();
  const down = status.mode === 'down';
  const categories = await getCategories();
  // The background music of the whole app (Admin > Music). Read from the shared cache, so it costs no extra reads.
  const music = await getAppMusic();
  // The assistant button disappears while the site is shut, on high alert, or when its switch is off in Admin > Control.
  const assistant = down || status.mode === 'saver' || status.features.assistant === false ? { enabled: false, name: 'Noor', voiceMode: 'browser', greeting: '' } : await getPublicAssistant();
  return (
    <html lang="en-PK" suppressHydrationWarning className={`${display.variable} ${body.variable} ${arabic.variable}`}>
      <body data-season={(seasonFor(new Date(), themeMode) || {}).id || 'none'}>
        <SiteGate down={down} maintenance={<Maintenance reason={status.reason} backAt={status.backAt} />}>
        <SplashScreen />
        <RouteProgress />
        <AppMusic music={music} />
        <AuthProvider>
        <CartProvider>
          <InstallProvider>
            <AnnouncementBar mode={themeMode} />
            <Header categories={categories} music={music} />
            {/* The footer and the floating buttons sit INSIDE main: on /admin the whole main area belongs to the admin panel, so
                nothing of the shop shows up under it (HideOnAdmin). Printing is unchanged (both carry .no-print like before). */}
            <main id="main">
              {children}
              <HideOnAdmin><Footer categories={categories} /></HideOnAdmin>
              <HideOnAdmin><WhatsAppFab /></HideOnAdmin>
            </main>
            <AssistantFab cfg={assistant} />
            <BottomNav />
            <InstallBanner />
            <SeasonFX mode={themeMode} />
            <BackToTop />
            <CardEvents />
            <AppFeel />
          </InstallProvider>
        </CartProvider>
        </AuthProvider>
        </SiteGate>
        <Tracker off={down} />
        <RefCapture />
        <WorkerPrices />
        <MetaPixel />
        <PwaRegister />
        <JsonLd data={[orgJsonLd(), websiteJsonLd()]} />
      </body>
    </html>
  );
}
