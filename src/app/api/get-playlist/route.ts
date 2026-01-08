import { ApiResponce } from '@/app/utils/ApiResponse';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const playlistId = searchParams.get('playlistId');

    if (!userId && !playlistId) {
      return ApiResponce.error('userId or playlistId is required', 400);
    }

    // Get specific playlist by ID
    if (playlistId) {
      const playlist = await prisma.playlist.findUnique({
        where: { id: playlistId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
          playlistSongs: {
            include: {
              song: true,
            },
            orderBy: {
              position: 'asc',
            },
          },
        },
      });

      if (!playlist) {
        return ApiResponce.error('Playlist not found', 404);
      }

      return ApiResponce.success('Playlist fetched successfully', playlist, 200);
    }

    // Get all playlists for a user
    const userPlaylists = await prisma.playlist.findMany({
      where: { userId: userId! },
      include: {
        playlistSongs: {
          include: {
            song: true,
          },
          orderBy: {
            position: 'asc',
          },
        },
      },
      orderBy: {
        name: 'asc', // Sort playlists alphabetically by name
      },
    });

    if (userPlaylists.length === 0) {
      return ApiResponce.success('No playlists found', [], 200);
    }

    return ApiResponce.success('User playlists fetched successfully', userPlaylists, 200);
  } catch (error) {
    console.error('Error fetching playlists:', error);
    return ApiResponce.error('Failed to fetch playlists', 500);
  }
}
