"use client";
import Navbar from "@/components/Navbar";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full ">
      <Navbar />
      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-black">{children}</div>
    </div>
  );
}
