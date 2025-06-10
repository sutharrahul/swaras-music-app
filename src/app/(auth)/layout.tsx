"use client";
import Navbar from "@/components/Navbar";
import { useSession } from "next-auth/react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  return (
    <div className="flex h-full ">
      <Navbar session={session} />
      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-black">{children}</div>
    </div>
  );
}
