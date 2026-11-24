import type { Metadata, Viewport } from 'next';
import { Barlow_Semi_Condensed, Public_Sans } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

const barlow = Barlow_Semi_Condensed({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-barlow', display: 'swap' });
const publicSans = Public_Sans({ subsets: ['latin'], variable: '--font-public-sans', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_BASE_URL ?? 'http://localhost:3000'),
  title: { default: 'Tree Ops: the tree you sold is the tree you cut', template: '%s | Tree Ops' },
  description: 'Estimates with numbered tree photos, an offline crew link, signed job briefings, pre-work checks and proof packets for tree care companies.',
  icons: { icon: [{ url: '/icons/icon.svg', type: 'image/svg+xml' }] },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${barlow.variable} ${publicSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
