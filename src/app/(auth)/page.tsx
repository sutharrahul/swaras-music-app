"use client";

import React, { useEffect, useState } from "react";
import MusicPlayer from "@/components/MusicPlayer";
import PlayList from "@/components/PlayList";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import { getAllSongsApi } from "@/lib/axiosApiRequest";

export default function Home() {
  useEffect(() => {
    getAllSongsApi();
  }, []);
  return (
    <div className="flex flex-col justify-between items-center h-full py-4">
      <div>
        <>
          <LoadingSkeleton />
          <LoadingSkeleton />
          <LoadingSkeleton />
        </>
        <PlayList />
      </div>
      <MusicPlayer />
    </div>
  );
}
