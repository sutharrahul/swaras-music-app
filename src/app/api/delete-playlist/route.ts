import { ApiResponse } from '@/app/utils/ApiResponse';
import prisma from '@/lib/prisma';

export async function DELETE(request: Request) {
  try {
    const { playlistId, songId, deletePlaylist } = await request.json();

    if (!playlistId) {
      return ApiResponse.error('Playlist ID is required', 400);
    }

    // Delete entire playlist
    if (deletePlaylist) {
      const deletedPlaylist = await prisma.playlist.delete({
        where: { id: playlistId },
      });

      return ApiResponse.success('Playlist deleted successfully', deletedPlaylist, 200);
    }

    // Remove song from playlist
    if (!songId) {
      return ApiResponse.error('Song ID is required to remove a song', 400);
    }

    const deletedSong = await prisma.playlistSong.deleteMany({
      where: {
        playlistId,
        songId,
      },
    });

    if (deletedSong.count === 0) {
      return ApiResponse.error('Song not found in playlist', 404);
    }

    return ApiResponse.success('Song removed from playlist', { deletedCount: deletedSong.count }, 200);
  } catch (error) {
    console.error('Error deleting from playlist:', error);
    return ApiResponse.error('Failed to delete from playlist', 500);
  }
}
