"use client";
import axios from "axios";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { Song } from "@/model/SongModel";
import { useSession } from "next-auth/react";

interface SongeType extends Song {
  _id: string;
}

type SongDataType = {
  songData: SongeType[];
  loading: boolean;
  erroMessage: string | undefined;
  currentSong: SongeType | null;
  playSong: (e: React.MouseEvent, songId: string) => void;
  userPlaylist: SongeType[];
};

export const SongContext = createContext<SongDataType | undefined>(undefined);

export function SongProvider({ children }: { children: ReactNode }) {
  const [songData, setSongData] = useState<SongeType[]>([]);
  const [userPlaylist, setUserPlaylist] = useState<SongeType[]>([]);
  const [erroMessage, setErrorMessage] = useState<string | undefined>();
  const [loading, setLoading] = useState<boolean>(false);
  const [currentSong, setCurrentSong] = useState<SongeType | null>(null);
  const { data: session, status } = useSession();

  useEffect(() => {
    async function getAllSongs() {
      setLoading(true);
      try {
        const { data } = await axios.get("/api/get-songs");

        if (data.data.length === 0 || !data.data) {
          setErrorMessage(data.message);
          setSongData([]);
        } else {
          setSongData(data.data);
          setErrorMessage(undefined);
        }
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch songs", err);
        setLoading(false);
        return [];
      }
    }

    getAllSongs();
  }, []);

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
  }, [session?.user?._id]);

  const playSong = (e: React.MouseEvent, songId: string) => {
    e.stopPropagation();
    e.preventDefault();
    const selectSong = songData.find((song) => song._id === songId);
    if (selectSong) {
      setCurrentSong(selectSong);
    }
  };

  return (
    <SongContext.Provider
      value={{
        loading,
        songData,
        erroMessage,
        currentSong,
        playSong,
        userPlaylist,
      }}
    >
      {children}
    </SongContext.Provider>
  );
}

export function useSong() {
  const context = useContext(SongContext);
  if (!context) throw new Error("useSong must be used within a SongProvider");

  return context;
}
