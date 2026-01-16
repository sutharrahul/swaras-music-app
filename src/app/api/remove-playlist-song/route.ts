import { ApiResponse } from '@/app/utils/ApiResponse';
import prisma from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

export async function DELETE(request: Request) {
  try {
    // Authenticate user with Clerk
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return ApiResponse.error('Unauthorized: Please log in', 401);
    }

    // Find user in database by Clerk vendorId
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

    // Verify playlist exists and belongs to the user
    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId },
      select: { id: true, userId: true },
    });

    if (!playlist) {
      return ApiResponse.error('Playlist not found', 404);
    }

    if (playlist.userId !== user.id) {
      return ApiResponse.error('Forbidden: You can only modify your own playlists', 403);
    }

    // Remove song from playlist
    const deletedSong = await prisma.playlistSong.deleteMany({
      where: {
        playlistId,
        songId,
      },
    });

    if (deletedSong.count === 0) {
      return ApiResponse.error('Song not found in playlist', 404);
    }

    return ApiResponse.success(
      'Song removed from playlist successfully',
      { deletedCount: deletedSong.count },
      200
    );
  } catch (error) {
    console.error('Error removing song from playlist:', error);
    return ApiResponse.error('Failed to remove song from playlist', 500);
  }
}
