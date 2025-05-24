import React from "react";
import NextButton from "@/assets/Icons/NextButton";
import PlayPauseButton from "@/assets/Icons/PlayPauseButton";
import PreviousButton from "@/assets/Icons/PreviousButton";
import ProgressBar from "@/assets/Icons/ProgressBar";
import { Play, Pause } from "lucide-react";
export default function MusicPlayer() {
  return (
    <div className="flex flex-col items-center md:flex-row bg-[#141414]/90 gap-10 md:gap-16 py-8 px-5 md:py-3 md:px-8 rounded-3xl justify-center w-fit">
      {/* SongInfo */}
      <div className="flex flex-col gap-5 justify-center items-center">
        <span className="text-sm text-center">Now Playing</span>
        <img className="h-36 md:h-16" src="./Pic.png" alt="" />
        <div className="flex flex-col items-center">
          <span className="text-sm ">Laadki</span>
          <span className="text-xs font-light">Sachin-Jigar</span>
        </div>
      </div>
      {/* Song play */}
      <div className="flex flex-col justify-center items-center gap-8">
        {/* Song progress */}
        <div className="flex items-center gap-6 text-sm font-light">
          <span>2:15</span>
          <ProgressBar className="h-4 md:h-6" />
          <span>4:15</span>
        </div>
        {/* Controls */}
        <div className="flex justify-center gap-14 items-center w-full">
          <PreviousButton className="h-5" />
          {/* <Play className="bg-gradient-to-r from-[#800000] to-[#B40000] h-10 w-10 p-1 rounded-md" /> */}
          <Pause className="bg-gradient-to-r from-[#800000] to-[#B40000] h-10 w-10 p-1 rounded-md" />
          {/* <PlayPauseButton className="h-8" /> */}
          <NextButton className="h-5" />
        </div>
      </div>
    </div>
  );
}
