'use client';

import { useState } from 'react';
import Link from 'next/link';
import HomeIcon from '@/assets/Icons/HomeIcon';
import LogoIcon from '@/assets/Icons/LogoIcon';
import PlayListIcon from '@/assets/Icons/PlayListIcon';
import { Menu, X, CloudUpload } from 'lucide-react';

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setIsMenuOpen(prev => !prev)}
        className="absolute top-4 left-4 z-50 md:hidden text-white"
      >
        {isMenuOpen ? '' : <Menu size={28} />}
      </button>
      {/* Sidebar */}
      <div
        className={`
          fixed md:static top-0 left-0 h-full 
           px-6 py-10 w-[58%] md:w-64
          transform transition-transform duration-300 z-30 bg-[#141414]/80 backdrop-blur-sm
          ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:flex
          flex-col text-white
        `}
      >
        {/* Sidebar Content */}
        <div className="flex flex-col h-full">
          <button
            onClick={() => setIsMenuOpen(prev => !prev)}
            className="absolute top-4 right-4 z-50 md:hidden text-white"
          >
            {isMenuOpen ? <X size={28} /> : ''}
          </button>
          <div className="flex flex-col gap-10">
            {/* Logo */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link href="/" className="flex items-center gap-2">
                  <LogoIcon className="w-8 md:w-10" />
                  <h1 className="text-lg md:text-2xl font-bold">
                    <span className="bg-gradient-to-r from-[#DD1212] to-[#B40000] bg-clip-text text-transparent">
                      Swaras
                    </span>
                    Music
                  </h1>
                </Link>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="flex flex-col gap-6 text-sm md:text-base font-medium">
              <Link
                href="/"
                className="flex items-center gap-3 hover:text-[#B40000] transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                <HomeIcon />
                <span>Home</span>
              </Link>
             
              
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
