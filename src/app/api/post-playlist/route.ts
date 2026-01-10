import { ApiResponse } from '@/app/utils/ApiResponse';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { userId, playlistId, songId, playlistName } = await request.json();

    // If playlistId is provided, add song to existing playlist
    if (playlistId) {
      // Check if song is already in playlist
      const existingSong = await prisma.playlistSong.findFirst({
        where: {
          playlistId,
          songId,
        },
      });

      if (existingSong) {
        return ApiResponse.error('Song is already in this playlist', 409);
      }

      // Get the max position in the playlist
      const maxPosition = await prisma.playlistSong.aggregate({
        where: { playlistId },
        _max: { position: true },
      });

      // Add song to playlist
      const playlistSong = await prisma.playlistSong.create({
        data: {
          playlistId,
          songId,
          position: (maxPosition._max.position || 0) + 1,
        },
        include: {
          song: true,
          playlist: true,
        },
      });

      return ApiResponse.success('Song added to playlist', playlistSong, 200);
    }

    // If no playlistId, create new playlist with the song
    if (!playlistName) {
      return ApiResponse.error('Playlist name is required for new playlist', 400);
    }

    const newPlaylist = await prisma.playlist.create({
      data: {
        userId,
        name: playlistName,
        playlistSongs: {
          create: {
            songId,
            position: 1,
          },
        },
      },
      include: {
        playlistSongs: {
          include: {
            song: true,
          },
        },
      },
    });

    return ApiResponse.success('Playlist created and song added', newPlaylist, 201);
  } catch (error) {
    console.error('Error adding song to playlist:', error);
    return ApiResponse.error('Failed to add song to playlist', 500);
  }
}
