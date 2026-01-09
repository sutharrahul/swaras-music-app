'use client';

import { useRouter } from 'next/navigation';

export default function Header() {
  const router = useRouter();



  return (
    <header className="fixed top-0 right-0 left-0 md:left-64 z-40 bg-gradient-to-b from-[#1a0000] to-transparent backdrop-blur-sm border-b border-[#B40000]/10">
      <div className="flex items-center justify-between px-4 md:px-8 py-4">
        {/* Left side - could add breadcrumbs or search later */}
        <div className="flex-1">{/* Placeholder for future features like search */}</div>

        {/* Right side - User info and auth button */}
      
      </div>
    </header>
  );
}
