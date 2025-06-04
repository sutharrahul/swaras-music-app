"use client";
import React, { ChangeEvent, use, useEffect, useRef, useState } from "react";
import { useSong } from "@/context/SongContextProvider";
import NextButton from "@/assets/Icons/NextButton";
import { Pause, Play } from "lucide-react";
import PreviousButton from "@/assets/Icons/PreviousButton";
import { formatTime } from "@/app/utils/formatTime";

export default function MusicPlayer() {
  const { currentSong, songData, playSong } = useSong();
  const [currectTime, setCurrectTime] = useState<number>();
  const [isPlaying, setIsPlaying] = useState<boolean>();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }

    setIsPlaying(!isPlaying);
  };

  const handleProgressBar = (e: ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);

    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }

    setCurrectTime(time);
  };

  useEffect(() => {
    if (currentSong && audioRef.current) {
      const audio = audioRef.current;
      audio.load();
      audio.play();

      setIsPlaying(true);

      const currentTimeUpdate = () => {
        console.log("current time metadata", audio.currentTime);
        setCurrectTime(audio.currentTime);
      };

      audio.addEventListener("timeupdate", currentTimeUpdate);

      return () => {
        audio.removeEventListener("timeupdate", currentTimeUpdate);
      };
    }
  }, [currentSong]);

  return (
    <div className="flex flex-col items-center md:flex-row bg-[#141414]/90 gap-10 md:gap-16 py-8 px-5 md:py-3 md:px-8 rounded-3xl justify-center w-fit">
      <audio autoPlay ref={audioRef} src={currentSong?.songFile}></audio>
      {/* SongInfo */}
      <div className="flex flex-col gap-5 justify-center items-center">
        <span className="text-sm text-center">Now Playing</span>
        <img
          className="h-36 md:h-28 rounded-md"
          src={currentSong?.coverImage}
          alt={currentSong?.coverImage}
        />
        <div className="flex flex-col items-center">
          <span className="text-sm ">Laadki</span>
          <span className="text-xs font-light">Sachin-Jigar</span>
        </div>
      </div>
      {/* Song play */}
      <div className="flex flex-col justify-center items-center gap-8">
        {/* Song progress */}
        <div className="flex items-center gap-6 text-sm font-light">
          {/* @ts-ignore */}
          <span>{formatTime(currectTime)}</span>
          <input
            type="range"
            value={currectTime}
            max={currentSong?.duration}
            onChange={handleProgressBar}
            className="flex-1"
          />
          {/* @ts-ignore */}
          <span>{formatTime(currentSong?.duration)}</span>
        </div>
        {/* Controls */}
        <div className="flex justify-center gap-14 items-center w-full">
          <PreviousButton
            className="h-5"
            previoesSong={(e) => {
              console.log("click");
            }}
          />
          {isPlaying ? (
            <Pause
              className="bg-gradient-to-r from-[#800000] to-[#B40000] h-10 w-10 p-1 rounded-md"
              onClick={toggle}
            />
          ) : (
            <Play
              className="bg-gradient-to-r from-[#800000] to-[#B40000] h-10 w-10 p-1 rounded-md"
              onClick={toggle}
            />
          )}
          <NextButton
            className="h-5"
            nextSong={(e) => {
              console.log("click click");
            }}
          />
        </div>
      </div>
    </div>
  );
}
