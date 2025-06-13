"use client";

import LoadingSkeleton from "@/components/LoadingSkeleton";
import MusicPlayer from "@/components/MusicPlayer";
import PlayList from "@/components/PlayList";
import axios from "axios";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import React, { useEffect, useState } from "react";

export default function Playlist() {
  const [userPlaylist, setUserPlaylist] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { data: session, status } = useSession();

  console.log("status", status);
  useEffect(() => {
    async function GetPlaylist() {
      setLoading(true);
      try {
        const { data } = await axios.get(
          `/api/get-playlist?userId=${session?.user?._id}`
        );
        const playListSongs = data?.data?.playListSong;

        console.log("playlist data fetch", playListSongs);
        setUserPlaylist(playListSongs);
      } catch (error) {
        console.error("Failed to fetch playlist", error);
      } finally {
        setLoading(false);
      }
    }
    if (status === "authenticated" && session?.user?._id) {
      GetPlaylist();
    }
  }, [session, status]);
  console.log("userplaylist song data", userPlaylist);
  return (
    <div className="flex flex-col justify-between items-center h-full py-8  px-4">
      {!loading && userPlaylist?.length === 0 && (
        <p className="text-center text-gray-500">No songs in your playlist.</p>
      )}

      <div className="w-full h-full">
        {loading ? (
          <>
            <LoadingSkeleton />
            <LoadingSkeleton />
            <LoadingSkeleton />
          </>
        ) : (
          <PlayList songData={userPlaylist!} />
        )}
      </div>
      <MusicPlayer />
    </div>
  );
}
