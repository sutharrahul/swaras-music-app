"use client";

import React, { useEffect, useState } from "react";
import MusicPlayer from "@/components/MusicPlayer";
import PlayList from "@/components/PlayList";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import { useSong } from "@/context/SongContextProvider";

export default function Home() {
  const { loading, songData } = useSong();

  return (
    <div className="flex flex-col justify-between items-center h-full py-4">
      <div>
        <>
          <LoadingSkeleton />
          <LoadingSkeleton />
          <LoadingSkeleton />
        </>
        <PlayList songData={songData} />
      </div>
      <MusicPlayer />
    </div>
  );
}
