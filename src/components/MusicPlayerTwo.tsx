import React, { useEffect, useRef } from "react";
import { useSong } from "@/context/SongContextProvider";

export default function MusicPlayer() {
  const { currentSong, songData, playSong } = useSong();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Play song when currentSong changes
  useEffect(() => {
    if (currentSong && audioRef.current) {
      audioRef.current.load();
      audioRef.current.play();
    }
  }, [currentSong]);

  // Handle when current song ends
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      if (!currentSong) return;

      const currentIndex = songData.findIndex(
        (song) => song._id === currentSong._id
      );

      const nextSong = songData[currentIndex + 1];
      if (nextSong) {
        playSong(nextSong._id);
      }
    };

    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("ended", handleEnded);
    };
  }, [currentSong, songData, playSong]);

  if (!currentSong) return null;

  return (
    <div className="fixed bottom-5 w-full bg-black p-4">
      <audio ref={audioRef} controls className="w-full">
        <source src={currentSong.songFile} type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>
    </div>
  );
}
