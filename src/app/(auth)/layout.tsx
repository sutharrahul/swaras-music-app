"use client";
import { useState } from "react";
import Link from "next/link";
import HomeIcon from "@/assets/HomeIcon";
import LogoIcon from "@/assets/LogoIcon";
import PlayListIcon from "@/assets/PlayListIcon";
import SignInOutIcon from "@/assets/SignInOutIcon";
import { Menu, X } from "lucide-react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="flex h-screen">
      {/* Toggle Button (Mobile only) */}
      <button
        onClick={() => setIsMenuOpen((prev) => !prev)}
        className="absolute top-4 left-4 z-50 sm:hidden text-white"
      >
        {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
      </button>

      {/* Sidebar */}
      <div
        className={`
          fixed sm:static top-0 left-0 h-full z-40
          bg-black sm:bg-transparent px-6 py-10 w-[58%] sm:w-64
          transform transition-transform duration-300
          ${isMenuOpen ? "translate-x-0" : "-translate-x-full"}
          sm:translate-x-0 sm:flex
          flex-col justify-between text-white
        `}
      >
        {/* Sidebar Content */}
        <div className="flex flex-col h-full justify-between">
          <div className="flex flex-col gap-10">
            {/* Logo & Close Button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <LogoIcon className="w-8 sm:w-10" />
                <h1 className="text-lg sm:text-2xl font-bold">
                  <span className="text-[#FF5656]">Swaras</span>Music
                </h1>
              </div>
            </div>

            {/* User Info */}
            <div className="flex flex-col gap-1">
              <h2 className="text-sm sm:text-xl font-semibold text-[#FF5656]">
                rahulsuthar
              </h2>
              <span className="text-xs sm:text-sm">rahulsuthar@gmail.com</span>
            </div>

            {/* Navigation Links */}
            <nav className="flex flex-col gap-6 text-sm sm:text-base font-medium">
              <Link href="/" className="flex items-center gap-3">
                <HomeIcon />
                <span>Home</span>
              </Link>
              <Link href="/" className="flex items-center gap-3">
                <PlayListIcon />
                <span>Playlists</span>
              </Link>
            </nav>
          </div>

          {/* Logout at Bottom */}
          <div className="flex items-center gap-3 mt-10">
            <SignInOutIcon />
            <span className="text-sm sm:text-base">Log Out</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
