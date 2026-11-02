import './globals.css';

export const metadata = {
  title: 'Mizanora IPTV — Control room',
  description: 'Admin, reseller and subscriber control panel for the Mizanora IPTV service.',
};

export const viewport = { themeColor: '#04100a' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
