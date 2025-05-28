import MusicPlayer from "@/components/MusicPlayer";
import React from "react";
import { truncateByLetters } from "../utils/truncateByLetters";
import PlayList from "@/components/PlayList";
import LoadingSkeleton from "@/components/LoadingSkeleton";

export default function Home() {
  return (
    <div className="flex flex-col justify-between items-center h-full py-4">
      {/* play-list */}

      <LoadingSkeleton />
      <PlayList />
      <MusicPlayer />
    </div>
  );
}
