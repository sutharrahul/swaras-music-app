'use client';

import React, { MouseEvent } from 'react';
import { truncateByLetters } from '@/app/utils/truncateByLetters';
import { useSong } from '@/context/SongContextProvider';
import { formatTime } from '@/app/utils/formatTime';
import { CirclePlus, Trash2 } from 'lucide-react';
import axios from 'axios';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';

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
  dataType: 'allsong' | 'userPlaylist';
};

export default function PlayList({ songData, dataType }: PlayListProps) {
  const { playSong, currentSong } = useSong();
  const { data: session } = useSession();

  const addSongToPlaylist = async (e: MouseEvent<SVGSVGElement>, songId: string) => {
    e.stopPropagation();
    e.preventDefault();

    try {
      const { data } = await axios.post('/api/post-playlist', {
        userId: session?.user?._id,
        songId: songId,
      });

      if (data.success) {
        toast.success('Song add to playlist');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMsg = error.response?.data?.message || 'Failed to add Song';
        toast.error(errorMsg);
      } else {
        toast.error('Something went wrong');
      }
    }
  };

  const removeSongFromPlaylist = async (e: MouseEvent<SVGSVGElement>, songId: string) => {
    e.stopPropagation();
    e.preventDefault();

    try {
      const { data } = await axios.delete('/api/delete-playlist', {
        data: {
          userId: session?.user?._id,
          songId: songId,
        },
      });

      if (data.success) {
        toast.success('Song removed');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMsg = error.response?.data?.message || 'Failed to Remove Song';
        toast.error(errorMsg);
      } else {
        toast.error('Something went wrong');
      }
    }
  };

  return (
    <ul className="space-y-1 px-2 md:px-8">
      {songData?.map(songData => (
        <li
          key={songData._id}
          className={`flex items-center justify-between my-7 px-2 py-3 cursor-pointer rounded transition-colors ${
            songData._id === currentSong?._id
              ? 'bg-[#B40000]/30 backdrop-blur-sm'
              : 'hover:bg-zinc-800/40'
          }`}
        >
          {/* Song Click Area */}
          <div onClick={() => playSong(songData._id)} className="flex items-center gap-5 flex-1">
            <img
              src={songData.coverImage}
              alt={songData.songName}
              className="w-9 h-9 md:w-12 md:h-12 object-cover rounded"
            />

            <div className="flex flex-col md:grid md:grid-cols-3 md:gap-5 md:flex-1">
              <p className="text-white text-sm md:text-base md:font-medium truncate">
                {truncateByLetters(songData.songName, 25)}
              </p>
              <p className="text-gray-400 text-xs md:text-sm truncate">
                {truncateByLetters(songData.singerName.join(' ,'), 35)}
              </p>
              <p className="text-gray-400 text-xs md:text-sm truncate">{songData.albumName}</p>
            </div>

            <span className="text-gray-400 text-sm mx-4 hidden md:inline">
              {formatTime(Math.floor(songData.duration))}
            </span>
          </div>

          {/* Action Icon */}
          <div>
            {dataType === 'allsong' ? (
              <div className="relative group">
                <div className="absolute bottom-full bg-[#141414] mb-2 left-1/2 -translate-x-1/2 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                  Add to playlist
                </div>
                <CirclePlus
                  onClick={e => {
                    addSongToPlaylist(e, songData._id);
                  }}
                  className="h-5 w-5 md:h-7 md:w-7 ml-4 text-gray-300 hover:text-white cursor-pointer"
                />
              </div>
            ) : (
              <Trash2
                onClick={e => {
                  removeSongFromPlaylist(e, songData._id);
                }}
                className="h-4 w-4 md:h-7 md:w-7 ml-4 text-[#B40000] hover:text-red-600 cursor-pointer"
              />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
