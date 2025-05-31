"use client";
import axios from "axios";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { Song } from "@/model/SongsModel";

interface SongeType extends Song {
  _id: string;
}

type SongDataType = {
  songData: SongeType | undefined;
  loading: boolean;
};

export const SongContext = createContext<SongDataType | undefined>(undefined);

export function SongProvider({ children }: { children: ReactNode }) {
  const [songData, setSongData] = useState<SongeType | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    async function getAllSongs() {
      setLoading(true);
      try {
        const { data } = await axios.get("/api/get-songs");
        console.log(data);

        setSongData(data);
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch songs", err);
        setLoading(false);
        return [];
      }
    }
    getAllSongs();
  }, []);

  return (
    <SongContext.Provider value={{ loading, songData }}>
      {children}
    </SongContext.Provider>
  );
}

export function useSong() {
  const context = useContext(SongContext);
  if (!context) throw new Error("useSong must be used within a SongProvider");

  return context;
}
