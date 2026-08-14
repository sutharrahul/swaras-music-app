'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import HomeIcon from '@/assets/Icons/HomeIcon';
import PlayListIcon from '@/assets/Icons/PlayListIcon';
import { Heart, Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

const NAV_LINKS = [
  { href: '/', label: 'Home', icon: HomeIcon },
  { href: '/liked', label: 'Liked Songs', icon: Heart },
  { href: '/playlist', label: 'My Playlists', icon: PlayListIcon },
];

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col gap-10">
      {/* Logo */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2" onClick={onNavigate}>
            <Image
              src="/logos/logo1.png"
              alt=""
              width={40}
              height={40}
              priority
              className="w-8 md:w-10 h-8 md:h-10 object-contain"
            />
            <h1 className="text-lg md:text-2xl font-bold">
              <span className="text-brand-gradient">Swaras</span>
              Music
            </h1>
          </Link>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex flex-col gap-2 text-sm md:text-base font-medium">
        {NAV_LINKS.map(({ href, label, icon: Icon }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors ${
                isActive
                  ? 'bg-secondary text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon aria-hidden="true" className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div>
      {/* Mobile drawer */}
      <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        {/*
          Sized and placed to sit on the header's own centre line.

          It used to be `top-4 left-4`, which positions against the page rather
          than the header: at 16px down with a 28px glyph its centre landed at
          y=30, while the header centres its own children (search, Sign in) at
          y=40 — hence the 10px stagger. Spanning the full `h-header` band and
          centring inside it makes the three agree by construction instead of by
          a magic offset, and gives a 48×80 tap target rather than a 28px glyph.

          `hidden` while the drawer is open: the trigger sits above the sheet at
          z-[60], so it stayed on screen next to the sheet's own close button —
          two controls for one job, which is what looked wrong.
        */}
        <SheetTrigger
          aria-label="Open navigation menu"
          className={`absolute top-0 left-0 z-[60] h-header w-12 items-center justify-center text-foreground md:hidden ${
            isMenuOpen ? 'hidden' : 'flex'
          }`}
        >
          <Menu className="size-6" />
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-[75%] sm:max-w-none gap-0 border-r-0 bg-card px-6 py-10 text-foreground md:hidden"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <NavContent onNavigate={() => setIsMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      {/*
        Desktop sidebar. `bg-card` + a right border, NOT `bg-surface-elevated`:
        that token is the same #F5F4EE as the page background, and with no border
        the sidebar had nothing at all to distinguish it — nav links appeared to
        float on the same sheet as the content.

        `bg-card` (#FBFAF5) rather than the pale-sage `bg-secondary`, because
        secondary is what the ACTIVE nav pill uses — tinting the whole rail with
        it would erase the one indicator telling you which page you are on.

        The old `/80` opacity and `backdrop-blur-sm` are gone with it: a
        translucent rail is what let the page bleed through in the first place,
        and the blur was doing nothing over a flat cream background.
      */}
      <aside className="hidden md:flex flex-col h-full w-64 px-6 py-10 bg-card border-r border-border text-foreground">
        <NavContent />
      </aside>
    </div>
  );
}
