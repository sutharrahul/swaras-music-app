import type { Metadata, Viewport } from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';
import { SongProvider } from '@/context/SongContextProvider';
import { Toaster } from 'react-hot-toast';
import MusicPlayer from '@/components/MusicPlayer';
import Navbar from '@/components/Navbar';
import Header from '@/components/Header';
import { Providers } from '@/components/Providers';
import { TooltipProvider } from '@/components/ui/tooltip';
import { themeColor, toastOptions } from '@/lib/theme';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'SwarasMusic',
    template: '%s · SwarasMusic',
  },
  description:
    'Stream music, build playlists, and keep every track you love in one place. SwarasMusic is a free music player for the web.',
  applicationName: 'SwarasMusic',
  openGraph: {
    type: 'website',
    siteName: 'SwarasMusic',
    title: 'SwarasMusic',
    description:
      'Stream music, build playlists, and keep every track you love in one place. SwarasMusic is a free music player for the web.',
    url: '/',
    images: [{ url: '/LandingPage.png', width: 1200, height: 630, alt: 'SwarasMusic' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'dark',
  themeColor,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-dvh">
      <body
        className={`${poppins.variable} ${poppins.className} antialiased flex bg-background h-dvh overflow-hidden`}
      >
        <Providers>
          <SongProvider>
            <TooltipProvider>
              <Toaster position="top-right" toastOptions={toastOptions} reverseOrder={false} />
              <Navbar />
              <div className="flex-1 h-full relative overflow-hidden bg-surface">
                <Header />
                <div className="h-full overflow-y-auto pr-2 pb-player pt-header">{children}</div>
                <MusicPlayer />
              </div>
            </TooltipProvider>
          </SongProvider>
        </Providers>
      </body>
    </html>
  );
}
