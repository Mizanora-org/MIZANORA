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
import BackToTop from '@/components/BackToTop';
import RefCapture from '@/components/RefCapture';
import SplashScreen from '@/components/SplashScreen';
import RouteProgress from '@/components/RouteProgress';
import CardEvents from '@/components/CardEvents';
import AppFeel from '@/components/AppFeel';
import AssistantFab from '@/components/AssistantFab';
import { getPublicAssistant } from '@/lib/assistantPublic';

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
    ...(process.env.NEXT_PUBLIC_FB_DOMAIN_VERIFICATION ? { other: { 'facebook-domain-verification': process.env.NEXT_PUBLIC_FB_DOMAIN_VERIFICATION } } : {}),
  },
  appleWebApp: { capable: true, title: 'Mizanora', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};

export default async function RootLayout({ children }) {
  const categories = await getCategories();
  const assistant = await getPublicAssistant();
  return (
    <html lang="en-PK" suppressHydrationWarning className={`${display.variable} ${body.variable} ${arabic.variable}`}>
      <body>
        <SplashScreen />
        <RouteProgress />
        <AuthProvider>
        <CartProvider>
          <InstallProvider>
            <AnnouncementBar />
            <Header categories={categories} />
            <main id="main">{children}</main>
            <Footer categories={categories} />
            <WhatsAppFab />
            <AssistantFab cfg={assistant} />
            <BottomNav />
            <InstallBanner />
            <SeasonFX />
            <BackToTop />
            <CardEvents />
            <AppFeel />
          </InstallProvider>
        </CartProvider>
        </AuthProvider>
        <RefCapture />
        <MetaPixel />
        <PwaRegister />
        <JsonLd data={[orgJsonLd(), websiteJsonLd()]} />
      </body>
    </html>
  );
}
