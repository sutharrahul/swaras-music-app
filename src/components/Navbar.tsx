"use client";

import { useState } from "react";
import Link from "next/link";
import HomeIcon from "@/assets/Icons/HomeIcon";
import LogoIcon from "@/assets/Icons/LogoIcon";
import PlayListIcon from "@/assets/Icons/PlayListIcon";
import SignInOutIcon from "@/assets/Icons/SignInOutIcon";
import { Menu, X } from "lucide-react";

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setIsMenuOpen((prev) => !prev)}
        className="absolute top-4 left-4 z-50 md:hidden text-white"
      >
        {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
      </button>
      {/* Sidebar */}
      <div
        className={`
          fixed md:static top-0 left-0 h-full z-40
           px-6 py-10 w-[58%] md:w-64
          transform transition-transform duration-300
          ${isMenuOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0 md:flex
          flex-col justify-between text-white
        `}
      >
        {/* Sidebar Content */}
        <div className="flex flex-col h-full justify-between">
          <div className="flex flex-col gap-10">
            {/* Logo & Close Button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <LogoIcon className="w-8 md:w-10" />
                <h1 className="text-lg md:text-2xl font-bold">
                  <span className="bg-gradient-to-r from-[#DD1212] to-[#B40000] bg-clip-text text-transparent">
                    Swaras
                  </span>
                  Music
                </h1>
              </div>
            </div>

            {/* User Info */}
            <div className="flex flex-col gap-1">
              <h2 className="text-sm md:text-xl font-semibold bg-gradient-to-r from-[#DD1212] to-[#B40000] bg-clip-text text-transparent">
                rahulsuthar
              </h2>
              <span className="text-xs md:text-sm">rahulsuthar@gmail.com</span>
            </div>

            {/* Navigation Links */}
            <nav className="flex flex-col gap-6 text-sm md:text-base font-medium">
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
            <span className="text-sm md:text-base">Log Out</span>
          </div>
        </div>
      </div>
    </div>
  );
}
