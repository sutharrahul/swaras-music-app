"use client";

import React, { MouseEvent } from "react";
import { truncateByLetters } from "@/app/utils/truncateByLetters";
import { useSong } from "@/context/SongContextProvider";
import { formatTime } from "@/app/utils/formatTime";
import { CirclePlus, Trash2 } from "lucide-react";
import axios from "axios";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";

type SongDataType = {
  _id: string;
  songFile: string;
  duration: number;
  songName: string;
  singerName: string[];
  composersName: string[];
  albumName?: string;
  coverImage?: string;
};

type PlayListProps = {
  songData: SongDataType[] | undefined;
  dataType: "allsong" | "userPlaylist";
};

export default function PlayList({ songData, dataType }: PlayListProps) {
  const { playSong } = useSong();
  const { data: session } = useSession();

  const addSongToPlaylist = async (
    e: MouseEvent<SVGSVGElement>,
    songId: string
  ) => {
    e.stopPropagation();
    e.preventDefault();

    try {
      const { data } = await axios.post("/api/post-playlist", {
        userId: session?.user?._id,
        songId: songId,
      });

      if (data.success) {
        toast.success("Song add to playlist");
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMsg = error.response?.data?.message || "Failed to add Song";
        toast.error(errorMsg);
      } else {
        toast.error("Something went wrong");
      }
    }
  };

  const removeSongFromPlaylist = async (
    e: MouseEvent<SVGSVGElement>,
    songId: string
  ) => {
    e.stopPropagation();
    e.preventDefault();
    console.log("userid....", session?.user?._id);
    console.log("song id....", songId);
    try {
      const { data } = await axios.delete("/api/delete-playlist", {
        data: {
          userId: session?.user?._id,
          songId: songId,
        },
      });

      if (data.success) {
        toast.success("Song removed");
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMsg =
          error.response?.data?.message || "Failed to Remove Song";
        toast.error(errorMsg);
      } else {
        toast.error("Something went wrong");
      }
    }
  };

  return (
    <ul className="space-y-1 px-2 md:px-8">
      {songData?.map((songData) => (
        <li
          key={songData._id}
          className="flex items-center justify-between my-7 px-2 cursor-pointer group"
        >
          {/* Song Click Area */}
          <div
            onClick={(e) => playSong(songData._id)}
            className="flex items-center gap-5 flex-1"
          >
            <img
              src={songData.coverImage}
              alt={songData.songName}
              className="w-12 h-12 object-cover rounded"
            />

            <div className="grid grid-cols-3 gap-5 flex-1">
              <p className="text-white font-medium truncate">
                {truncateByLetters(songData.songName, 25)}
              </p>
              <p className="text-gray-400 text-sm truncate">
                {truncateByLetters(songData.singerName.join(" ,"), 35)}
              </p>
              <p className="text-gray-400 text-sm truncate">
                {songData.albumName}
              </p>
            </div>

            <span className="text-gray-400 text-sm mx-4">
              {formatTime(Math.floor(songData.duration))}
            </span>
          </div>

          {/* Action Icon */}
          <div>
            {dataType === "allsong" ? (
              <CirclePlus
                onClick={(e) => {
                  addSongToPlaylist(e, songData._id);
                }}
                className="h-7 w-7 ml-4 text-gray-300 hover:text-white cursor-pointer"
              />
            ) : (
              <Trash2
                onClick={(e) => {
                  removeSongFromPlaylist(e, songData._id);
                }}
                className="h-7 w-7 ml-4 text-[#B40000] hover:text-red-600 cursor-pointer"
              />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
