"use client";

import React from "react";
import PlayList from "@/components/PlayList";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import { useSong } from "@/context/SongContextProvider";

export default function Home() {
  const { loading, songData, erroMessage } = useSong();

  return (
    <div className="flex flex-col justify-between items-center h-full py-8  px-4">
      <div className="w-full h-full">
        {loading ? (
          <>
            <LoadingSkeleton />
            <LoadingSkeleton />
            <LoadingSkeleton />
          </>
        ) : erroMessage ? (
          <p className="flex items-center justify-center  text-center text-lg font-bold h-full">
            {erroMessage}
          </p>
        ) : (
          <PlayList songData={songData} />
        )}
      </div>
    </div>
  );
}
