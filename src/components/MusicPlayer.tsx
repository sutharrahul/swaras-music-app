"use client";
import React, { ChangeEvent, use, useEffect, useRef, useState } from "react";
import { useSong } from "@/context/SongContextProvider";
import NextButton from "@/assets/Icons/NextButton";
import { Pause, Play, Volume, Volume1, Volume2, VolumeX } from "lucide-react";
import PreviousButton from "@/assets/Icons/PreviousButton";
import { formatTime } from "@/app/utils/formatTime";
import { truncateByLetters } from "@/app/utils/truncateByLetters";

export default function MusicPlayer() {
  const { currentSong, songData, playSong } = useSong();
  const [currectTime, setCurrectTime] = useState<number>();
  const [volume, setVolume] = useState(1);
  const [isPlaying, setIsPlaying] = useState<boolean>();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // play paush button
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

  // handel progressbar
  const handleProgressBar = (e: ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);

    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }

    setCurrectTime(time);
  };

  // Volume contol
  const handleVolumeBar = (e: ChangeEvent<HTMLInputElement>) => {
    const volume = Number(e.target.value);

    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
    setVolume(volume);
  };

  const mute = () => {
    if (volume == 0) {
      setVolume(1);
    } else {
      setVolume(0);
    }
  };

  // play song when song is selected
  useEffect(() => {
    if (currentSong && audioRef.current) {
      const audio = audioRef.current;
      audio.load();
      audio.play();

      setIsPlaying(true);

      const currentTimeUpdate = () => {
        setCurrectTime(audio.currentTime);
      };

      audio.addEventListener("timeupdate", currentTimeUpdate);

      return () => {
        audio.removeEventListener("timeupdate", currentTimeUpdate);
      };
    }
  }, [currentSong]);

  // play next song
  const nextSong = () => {
    if (!currentSong) return;
    const currentPlayingSong = songData.findIndex(
      (song) => song?._id === currentSong?._id
    );
    const nextSong = songData[currentPlayingSong + 1];

    if (nextSong) {
      playSong(nextSong?._id);
      setIsPlaying(true);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPlaying(false);
    }
  };

  // const handelNextSong = (
  //   e:
  //     | React.KeyboardEvent<HTMLButtonElement>
  //     | React.MouseEvent<HTMLButtonElement>
  // ) => {
  //   e.preventDefault();

  //   if ("key" in e && e.key === "ArrowRight") {
  //     nextSong();
  //   } else {
  //     nextSong();
  //   }
  // };

  // play previous song

  const previousSong = (
    e:
      | React.KeyboardEvent<HTMLButtonElement>
      | React.MouseEvent<HTMLButtonElement>
  ) => {
    if (!currentSong) return;
    const currentPlayingSongIndex = songData.findIndex(
      (song) => song?._id === currentSong?._id
    );

    console.log("previous song index", songData[currentPlayingSongIndex - 1]);
    if (currentPlayingSongIndex === 0) return;

    const playPreviousSong = songData[currentPlayingSongIndex - 1];

    if (!playPreviousSong) return;
    if ("key" in e) {
      if (e.key === "ArrowLeft") {
        playSong(playPreviousSong?._id);
      }
    } else {
      playSong(playPreviousSong?._id);
    }
  };

  // auto play next song
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio?.addEventListener("ended", nextSong);
    return () => {
      audio?.removeEventListener("ended", nextSong);
    };
  }, [currentSong, songData, playSong]);

  return (
    <>
      {currentSong && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
          <div className="flex flex-col items-center md:flex-row bg-[#141414]/90 gap-10 md:gap-16 py-8 px-5 md:py-3 md:px-8 rounded-3xl justify-center w-fit">
            <audio ref={audioRef} src={currentSong?.songFile}></audio>
            {/* SongInfo */}
            <div className="flex flex-col gap-5 justify-center items-center">
              <span className="text-sm text-center">Now Playing</span>
              <img
                className="h-36 md:h-28 rounded-md"
                src={currentSong?.coverImage}
                alt={currentSong?.coverImage}
              />
              <div className="flex flex-col items-center">
                <span className="text-sm ">
                  {truncateByLetters(currentSong?.songName, 20)}
                </span>
                <div className="relative w-40 overflow-hidden">
                  <span className="text-xs px-5 font-light animate-marquee">
                    {currentSong.singerName.join(", ")}
                  </span>
                </div>
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
                  max={currentSong?.duration}
                  value={currectTime}
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
                  onClick={previousSong}
                  onKeyDown={previousSong}
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
                <button onClick={nextSong}>
                  <NextButton className="h-5" />
                </button>
              </div>
              <div className="flex gap-3">
                <div onClick={mute}>
                  {volume >= 0.6 ? (
                    <Volume2 />
                  ) : volume >= 0.1 ? (
                    <Volume1 />
                  ) : volume >= 0.01 ? (
                    <Volume />
                  ) : (
                    <VolumeX />
                  )}
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={handleVolumeBar}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
