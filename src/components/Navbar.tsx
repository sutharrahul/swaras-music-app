'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import HomeIcon from '@/assets/Icons/HomeIcon';
import PlayListIcon from '@/assets/Icons/PlayListIcon';
import { Heart, Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex flex-col gap-10">
      {/* Logo */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2" onClick={onNavigate}>
            <Image
              src="/assets/swarasLogo.png"
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
      <nav className="flex flex-col gap-6 text-sm md:text-base font-medium">
        <Link
          href="/"
          className="flex items-center gap-3 hover:text-brand transition-colors"
          onClick={onNavigate}
        >
          <HomeIcon />
          <span>Home</span>
        </Link>

        <Link
          href="/liked"
          className="flex items-center gap-3 hover:text-brand transition-colors"
          onClick={onNavigate}
        >
          <Heart aria-hidden="true" className="h-5 w-5 text-brand fill-brand" />
          <span>Liked Songs</span>
        </Link>

        <Link
          href="/playlist"
          className="flex items-center gap-3 hover:text-brand transition-colors"
          onClick={onNavigate}
        >
          <PlayListIcon />
          <span>My Playlists</span>
        </Link>
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
        <SheetTrigger
          aria-label="Open navigation menu"
          className="absolute top-4 left-4 z-[60] md:hidden text-white"
        >
          <Menu size={28} />
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-[75%] sm:max-w-none gap-0 border-r-0 bg-surface-elevated px-6 py-10 text-white md:hidden"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <NavContent onNavigate={() => setIsMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col h-full w-64 px-6 py-10 bg-surface-elevated/80 backdrop-blur-sm text-white">
        <NavContent />
      </aside>
    </div>
  );
}
