"use client";

import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, User } from "lucide-react";

export default function Header() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const handleSignInOut = () => {
    if (session) {
      signOut();
    } else {
      router.push("/sign-in");
    }
  };

  return (
    <header className="fixed top-0 right-0 left-0 md:left-64 z-40 bg-gradient-to-b from-[#1a0000] to-transparent backdrop-blur-sm border-b border-[#B40000]/10">
      <div className="flex items-center justify-between px-4 md:px-8 py-4">
        {/* Left side - could add breadcrumbs or search later */}
        <div className="flex-1">
          {/* Placeholder for future features like search */}
        </div>

        {/* Right side - User info and auth button */}
        <div className="flex items-center gap-4">
          {status === "loading" ? (
            <div className="animate-pulse flex items-center gap-2">
              <div className="h-8 w-8 bg-gray-700 rounded-full" />
              <div className="h-4 w-20 bg-gray-700 rounded" />
            </div>
          ) : session?.user ? (
            <>
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1a1a1a]">
                  <User className="h-4 w-4 text-[#B40000]" />
                  <span className="text-sm font-medium text-white">
                    {session.user.username}
                  </span>
                </div>
                <div className="sm:hidden flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-[#800000] to-[#B40000]">
                  <span className="text-sm font-bold text-white">
                    {session.user.username?.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
              <button
                onClick={handleSignInOut}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#800000] to-[#B40000] hover:from-[#900000] hover:to-[#C40000] transition-all duration-200 text-white text-sm font-medium"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Log Out</span>
              </button>
            </>
          ) : (
            <button
              onClick={handleSignInOut}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#800000] to-[#B40000] hover:from-[#900000] hover:to-[#C40000] transition-all duration-200 text-white text-sm font-medium"
            >
              <LogIn className="h-4 w-4" />
              <span>Log In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
