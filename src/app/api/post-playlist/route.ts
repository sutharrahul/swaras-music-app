import { ApiResponse } from '@/app/utils/ApiResponse';
import prisma from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

export async function POST(request: Request) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return ApiResponse.error('Unauthorized: Please log in', 401);
    }

    const user = await prisma.user.findUnique({
      where: { vendorId: clerkUserId },
      select: { id: true },
    });

    if (!user) {
      return ApiResponse.error('User not found', 404);
    }

    const { playlistId, songId } = await request.json();

    if (!playlistId || !songId) {
      return ApiResponse.error('Playlist ID and Song ID are required', 400);
    }

    // Verify playlist belongs to user
    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId },
    });

    if (!playlist) {
      return ApiResponse.error('Playlist not found', 404);
    }

    if (playlist.userId !== user.id) {
      return ApiResponse.error('Access denied: This playlist belongs to another user', 403);
    }

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
  } catch (error) {
    console.error('Error adding song to playlist:', error);
    return ApiResponse.error('Failed to add song to playlist', 500);
  }
}
