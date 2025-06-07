"use client";

import React from "react";
import { truncateByLetters } from "@/app/utils/truncateByLetters";
import { useSong } from "@/context/SongContextProvider";
import { formatTime } from "@/app/utils/formatTime";

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
  songData: SongDataType[];
};

export default function PlayList({ songData }: PlayListProps) {
  const { playSong } = useSong();

  return (
    <div>
      <ul className="space-y-1">
        {songData.map((songData) => (
          <li
            className="flex items-center gap-5 py-3 px-2 cursor-pointer"
            key={songData?._id}
            onClick={() => playSong(songData?._id)}
          >
            <img
              src={songData?.coverImage}
              className="w-12 h-12 object-cover rounded"
              alt="./Pic.png"
            />

            <div className="flex-1 grid grid-cols-3 gap-5">
              <p className="text-white font-medium truncate ">
                {truncateByLetters(songData?.songName, 25)}
              </p>
              <p className="text-gray-400 text-sm truncate">
                {truncateByLetters(songData?.singerName.join(" ,"), 35)}
              </p>
              <p className="text-gray-400 text-sm truncate">
                {songData?.albumName}
              </p>
            </div>

            <span className="text-gray-400 text-sm ml-4">
              {" "}
              {formatTime(Math.floor(songData.duration))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
