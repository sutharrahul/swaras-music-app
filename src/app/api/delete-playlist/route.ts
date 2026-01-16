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

    const { playlistId } = await request.json();

    if (!playlistId) {
      return ApiResponse.error('Playlist ID is required', 400);
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
      return ApiResponse.error('Forbidden: You can only delete your own playlists', 403);
    }

    // Delete entire playlist (cascade will delete all playlistSongs)
    const deletedPlaylist = await prisma.playlist.delete({
      where: { id: playlistId },
    });

    return ApiResponse.success('Playlist deleted successfully', deletedPlaylist, 200);
  } catch (error) {
    console.error('Error deleting playlist:', error);
    return ApiResponse.error('Failed to delete playlist', 500);
  }
}
