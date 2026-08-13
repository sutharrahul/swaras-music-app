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
  // Both, now that there is a dark theme — this is what tells the browser to
  // draw form controls, scrollbars and the like to match.
  colorScheme: 'light dark',
  themeColor,
};

/**
 * Applies the stored theme before the first paint.
 *
 * This has to be a blocking inline script rather than an effect: React effects
 * run after hydration, so a dark-mode visitor would be shown a full cream page
 * for a frame or two and then watch it snap to dark on every single navigation
 * that remounts the tree. Reading `localStorage` synchronously in <head> is the
 * standard fix and the only one without a flash.
 *
 * Falls back to the OS preference when nothing is stored, so a first visit on a
 * dark-mode machine already looks right, and defaults to light otherwise. The
 * try/catch is for Safari private mode, where reading storage can throw — the
 * app then simply stays light.
 */
const themeInitScript = `
try {
  var stored = localStorage.getItem('swaras-theme');
  var dark = stored ? stored === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (dark) document.documentElement.classList.add('dark');
} catch (e) {}
`;

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
    // `suppressHydrationWarning`: the script above adds a class to this very
    // element before React hydrates, so the server's `class` and the client's
    // deliberately differ. It suppresses the warning on this node only.
    <html lang="en" className="h-dvh" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
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
