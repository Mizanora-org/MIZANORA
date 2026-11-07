import './globals.css';
// v39: the fonts are SELF-HOSTED from public/fonts/ (next/font/local), not fetched from
// Google while the app builds. next/font/google downloads the CSS and the woff2 files at BUILD
// time, so the build fails the moment the build machine cannot reach fonts.googleapis.com -
// which is exactly what happened on Vercel. With the files in the repo the build needs no
// network at all, and the shop serves the fonts from its own domain (faster, and no third
// party sees who visits). The files come from the @fontsource packages; see UPGRADE-v39.md.
import localFont from 'next/font/local';
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
import MusicProvider from '@/components/MusicProvider';
import MiniPlayer from '@/components/MiniPlayer';
import PwaRegister from '@/components/PwaRegister';
import MetaPixel from '@/components/MetaPixel';
import AdSense from '@/components/AdSense';
import AdsInject from '@/components/AdsInject';
import JsonLd from '@/components/JsonLd';
import SeasonFX from '@/components/SeasonFX';
import { getThemeMode } from '@/lib/themeServer';
import { seasonFor } from '@/lib/season';
import BackToTop from '@/components/BackToTop';
import RefCapture from '@/components/RefCapture';
import WorkerPrices from '@/components/WorkerPrices';
import WishSync from '@/components/WishSync';
import AdminEditLayer from '@/components/AdminEditLayer';
import SplashScreen from '@/components/SplashScreen';
import RouteProgress from '@/components/RouteProgress';
import CardEvents from '@/components/CardEvents';
import AssistantFab from '@/components/AssistantFab';
import { getPublicAssistant } from '@/lib/assistantPublic';
import { getAppMusic } from '@/lib/appMusicServer';
import { getSiteStatus } from '@/lib/siteGate';
import SiteGate from '@/components/SiteGate';
import Tracker from '@/components/Tracker';
import AnalyticsBeacon from '@/components/AnalyticsBeacon';
import Maintenance from '@/components/Maintenance';
import ClosedShop from '@/components/ClosedShop';
import HideOnAdmin from '@/components/HideOnAdmin';
import AppMusic from '@/components/AppMusic';
import QuranSession from '@/components/QuranSession';
import SiteFx from '@/components/SiteFx';
import SiteInject from '@/components/SiteInject';
import { getQuranConfig } from '@/lib/quranServer';
import { getInject } from '@/lib/injectServer';

const display = localFont({
  src: [
    { path: '../public/fonts/plus-jakarta-sans-latin-700-normal.woff2', weight: '700', style: 'normal' },
    { path: '../public/fonts/plus-jakarta-sans-latin-800-normal.woff2', weight: '800', style: 'normal' },
  ],
  variable: '--font-display',
  display: 'swap',
  fallback: ['system-ui', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
});
const arabic = localFont({
  src: [
    { path: '../public/fonts/amiri-arabic-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../public/fonts/amiri-arabic-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-arabic',
  display: 'swap',
  // v60: the two Arabic files are 100 KB EACH and only the Quran / Hadith / Arabic pages use them.
  // Preloading them on the shop meant 200 KB of fonts in front of the first paint on every page.
  // The browser now fetches them only when Arabic text is actually on the screen.
  preload: false,
  fallback: ['Noto Naskh Arabic', 'Geeza Pro', 'Tahoma', 'serif'],
});
const body = localFont({
  src: [
    { path: '../public/fonts/inter-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: '../public/fonts/inter-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: '../public/fonts/inter-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-body',
  display: 'swap',
  fallback: ['system-ui', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
});

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  // v60: pinch-zoom is ALLOWED again. Blocking it is an accessibility failure (Lighthouse:
  // "Prevents zooming and scaling"): low-vision visitors could not enlarge the shop's text.
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
  // v23: Quran session setting and Studio (animations + snippets). Both come from the shared cache: no extra reads per visitor.
  const [quran, inject] = await Promise.all([getQuranConfig(), getInject()]);
  // v24: while the shop is shut down or outside its hours the Quran keeps playing (unless the admin turned that off in Admin > Quran).
  const closedQuran = { ...quran, mode: quran.closedPlay === false ? quran.mode : 'always', display: 'sheet', pages: 'all' };
  // The assistant button disappears while the site is shut, on high alert, or when its switch is off in Admin > Control.
  const assistant = down || status.mode === 'saver' || status.features.assistant === false ? { enabled: false, name: 'Noor', voiceMode: 'browser', greeting: '' } : await getPublicAssistant();
  return (
    <html lang="en-PK" suppressHydrationWarning className={`${display.variable} ${body.variable} ${arabic.variable}`}>
      <head>
        {/* Google AdSense: the account meta tag is the verification; the script itself is added by
            components/AdSense.js after the page is usable (v60), so the ~160 KB third-party tag no
            longer competes with the first paint. AdSense still gets its plain <script> element. */}
        <meta name="google-adsense-account" content="ca-pub-4008582341764263" />
      </head>
      <body data-season={(seasonFor(new Date(), themeMode) || {}).id || 'none'}>
        <SiteGate down={down} hours={status.hours} maintenance={<><Maintenance reason={status.reason} backAt={status.backAt} /><QuranSession cfg={closedQuran} /></>} closed={<><ClosedShop hours={status.hours} /><QuranSession cfg={closedQuran} /></>}>
        <SplashScreen />
        <RouteProgress />
        <AppMusic music={music} />
        <AuthProvider>
        <MusicProvider>
        <CartProvider>
          <InstallProvider>
            <AnnouncementBar mode={themeMode} />
            <Header categories={categories} music={music} />
            {/* The footer and the floating buttons sit INSIDE main: on /admin the whole main area belongs to the admin panel, so
                nothing of the shop shows up under it (HideOnAdmin). Printing is unchanged (both carry .no-print like before). */}
            <SiteInject items={inject.items} slot="top" />
            <main id="main">
              {children}
              {/* v60: ONE ad slot at the end of every page (the shop's own Ads API fills it when the
                  admin switches ads on; checkout, cart, account and admin are skipped inside AdsInject).
                  Pages that want a slot inside their content add their own <AdsInject>. */}
              <HideOnAdmin><div className="mx-auto max-w-7xl px-3 sm:px-4"><AdsInject slots={['auto']} /></div></HideOnAdmin>
              <HideOnAdmin><Footer categories={categories} /></HideOnAdmin>
              <HideOnAdmin><WhatsAppFab /></HideOnAdmin>
            </main>
            <SiteInject items={inject.items} slot="end" />
            <SiteFx effects={inject.effects} />
            <QuranSession cfg={quran} />
            <AssistantFab cfg={assistant} />
            <MiniPlayer />
            <BottomNav />
            <InstallBanner />
            <SeasonFX mode={themeMode} />
            <BackToTop />
            <CardEvents />
          </InstallProvider>
        </CartProvider>
        </MusicProvider>
        </AuthProvider>
        </SiteGate>
        <Tracker off={down} />
        <AnalyticsBeacon off={down} />
        <RefCapture />
        <WorkerPrices />
        <WishSync />
        <AdminEditLayer />
        <AdSense />
        <MetaPixel />
        <PwaRegister />
        <JsonLd data={[orgJsonLd(), websiteJsonLd()]} />
      </body>
    </html>
  );
}
