'use client';

import React from 'react';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import PlayList from '@/components/PlayList';
import { useSong } from '@/context/SongContextProvider';

export default function Playlist() {
  const { userPlaylist, loading } = useSong();
  return (
    <div className="flex flex-col justify-between items-center h-full py-8  px-4">
      {!loading && userPlaylist?.length === 0 && (
        <p className="text-center text-gray-500">No songs in your playlist.</p>
      )}

      <div className="w-full h-full">
        {loading ? (
          <>
            <LoadingSkeleton />
            <LoadingSkeleton />
            <LoadingSkeleton />
          </>
        ) : (
          <PlayList songData={userPlaylist!} dataType="userPlaylist" />
        )}
      </div>
    </div>
  );
}
