"use client";

import { useState } from "react";
import Link from "next/link";
import HomeIcon from "@/assets/Icons/HomeIcon";
import LogoIcon from "@/assets/Icons/LogoIcon";
import PlayListIcon from "@/assets/Icons/PlayListIcon";
import SignInOutIcon from "@/assets/Icons/SignOutIcon";
import { Menu, X, CloudUpload } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import SignOutIcon from "@/assets/Icons/SignOutIcon";
import SignInIcon from "@/assets/Icons/SignInIcon";

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();
  const { data: session, status } = useSession();

  const handleUserSignInOut = () => {
    if (session) {
      signOut();
    } else {
      router.push("/sign-in");
    }
  };

  return (
    <div>
      <button
        onClick={() => setIsMenuOpen((prev) => !prev)}
        className="absolute top-4 left-4 z-50 md:hidden text-white"
      >
        {isMenuOpen ? "" : <Menu size={28} />}
      </button>
      {/* Sidebar */}
      <div
        className={`
          fixed md:static top-0 left-0 h-full 
           px-6 py-10 w-[58%] md:w-64
          transform transition-transform duration-300 z-30 bg-[#141414]/80 backdrop-blur-sm
          ${isMenuOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0 md:flex
          flex-col justify-between text-white
        `}
      >
        {/* Sidebar Content */}
        <div className="flex flex-col h-full justify-between">
          <button
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="absolute top-4 right-4 z-50 md:hidden text-white"
          >
            {isMenuOpen ? <X size={28} /> : ""}
          </button>
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
              {status === "loading" ? (
                // Skeleton loading UI
                <div className="animate-pulse space-y-2">
                  <div className="h-3 bg-gray-600 rounded-md w-3/4" />
                  <div className="h-2 bg-gray-700 rounded-md w-1/2" />
                </div>
              ) : session?.user ? (
                <>
                  <h2 className="text-sm md:text-xl font-semibold bg-gradient-to-r from-[#DD1212] to-[#B40000] bg-clip-text text-transparent">
                    {session?.user?.username}
                  </h2>
                  <span className="text-xs md:text-sm">
                    {session?.user?.email}
                  </span>
                </>
              ) : (
                <>
                  <h2 className="text-sm md:text-xl font-semibold">
                    Welcome, Guest
                  </h2>
                  <span className="text-xs md:text-sm">Please sign in</span>
                </>
              )}
            </div>

            {/* Navigation Links */}
            <nav className="flex flex-col gap-6 text-sm md:text-base font-medium">
              <Link href="/" className="flex items-center gap-3">
                <HomeIcon />
                <span>Home</span>
              </Link>
              <Link
                href={`/${session?.user?.username}/playlist`}
                className="flex items-center gap-3"
              >
                <PlayListIcon />
                <span>Playlists</span>
              </Link>
              {session?.user.role == "admin" && (
                <Link
                  href="/admin/upload-song"
                  className="flex items-center gap-3"
                >
                  <CloudUpload
                    className="text-[#B40000] w-6 h-6"
                    strokeWidth={3}
                  />
                  <span>Upload Song</span>
                </Link>
              )}
            </nav>
          </div>

          {/* Logout at Bottom */}
          <div onClick={handleUserSignInOut} className=" cursor-pointer w-fit">
            {session ? (
              <div className="flex items-center gap-3 mt-10">
                <SignOutIcon />
                <span className="text-sm md:text-base">Log Out</span>
              </div>
            ) : (
              <div className="flex items-center gap-3 mt-10">
                <SignInIcon />
                <span className="text-sm md:text-base">Log In</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
