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
    // Dimensions are the file's real ones (1536×1024), not the 1200×630 the
    // previous placeholder claimed — scrapers reserve layout space from these,
    // so a wrong pair makes the preview jump once the image loads.
    images: [
      {
        url: '/assets/opengraph.png',
        width: 1536,
        height: 1024,
        alt: 'SwarasMusic — stream, discover and create playlists with your favourite songs',
      },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light',
  themeColor,
};

export default function RootLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  /**
   * The `@modal` parallel route slot. `src/app/@modal/(.)sign-in` and
   * `(.)sign-up` intercept client-side navigation to `/sign-in`/`/sign-up` and
   * render here as a dialog on top of whatever page is already showing. A hard
   * navigation (typed URL, the middleware's redirect for a protected route)
   * bypasses interception entirely and renders the real full-page route
   * instead — `modal` is null in that case, this renders nothing extra, and
   * `src/app/sign-in/page.tsx` / `sign-up/page.tsx` are what the visitor sees.
   */
  modal: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-dvh">
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
              {modal}
            </TooltipProvider>
          </SongProvider>
        </Providers>
      </body>
    </html>
  );
}
