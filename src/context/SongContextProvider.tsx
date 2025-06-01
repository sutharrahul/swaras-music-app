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
  songData: SongeType[];
  loading: boolean;
  erroMessage: string | undefined;
};

export const SongContext = createContext<SongDataType | undefined>(undefined);

export function SongProvider({ children }: { children: ReactNode }) {
  const [songData, setSongData] = useState<SongeType[]>([]);
  const [erroMessage, setErrorMessage] = useState<string | undefined>();
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    async function getAllSongs() {
      setLoading(true);
      try {
        const { data } = await axios.get("/api/get-songs");
        console.log("api data", data);

        if (data.data.length === 0 || !data.data) {
          console.log("No songs found in response", data);
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

  console.log("error message", erroMessage);

  return (
    <SongContext.Provider value={{ loading, songData, erroMessage }}>
      {children}
    </SongContext.Provider>
  );
}

export function useSong() {
  const context = useContext(SongContext);
  if (!context) throw new Error("useSong must be used within a SongProvider");

  return context;
}
