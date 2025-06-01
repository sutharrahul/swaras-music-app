"use client";

import React, { useEffect, useState } from "react";
import { truncateByLetters } from "@/app/utils/truncateByLetters";

type SongDataType = {
  _id: string;
  songFile: string;
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
  const [durations, setDurations] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadDurations() {
      const durationMap: Record<string, string> = {};

      await Promise.all(
        songData.map(async (song) => {
          try {
            const duration = await getAudioDuration(song.songFile);
            durationMap[song._id] = duration;
          } catch {
            durationMap[song._id] = "00:00";
          }
        })
      );

      setDurations(durationMap);
    }

    if (songData?.length) {
      loadDurations();
    }
  }, [songData]);
  return (
    <div>
      <ul className="space-y-1">
        {songData.map((songData) => (
          <li className="flex items-center gap-5 py-3 px-2" key={songData?._id}>
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
                {truncateByLetters(songData?.composersName.join(" "), 25)}
              </p>
              <p className="text-gray-400 text-sm truncate">
                {songData?.albumName}
              </p>
            </div>

            <span className="text-gray-400 text-sm ml-4">
              {" "}
              {durations[songData._id] || "Loading..."}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Optional: format duration (seconds to MM:SS)
function formatTime(duration: number): string {
  const minutes = Math.floor(duration / 60);
  const seconds = Math.floor(duration % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getAudioDuration(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);

    audio.addEventListener("loadedmetadata", () => {
      const duration = audio.duration;
      resolve(formatTime(duration));
    });

    audio.addEventListener("error", (e) => {
      reject("Failed to load audio");
    });
  });
}
