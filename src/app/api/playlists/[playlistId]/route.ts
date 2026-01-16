import { ApiResponse } from '@/app/utils/ApiResponse';
import prisma from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

// GET specific playlist with songs
export async function GET(
  request: Request,
  { params }: { params: Promise<{ playlistId: string }> }
) {
  try {
    const { playlistId } = await params;
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return ApiResponse.error('Unauthorized: Please log in', 401);
    }

    const user = await prisma.user.findUnique({
      where: { vendorId: clerkUserId as string },
      select: { id: true },
    });

    if (!user) {
      return ApiResponse.error('User not found', 404);
    }

    const playlist = await prisma.playlist.findUnique({
      where: {
        id: playlistId,
      },
      include: {
        playlistSongs: {
          include: {
            song: {
              include: {
                uploadedBy: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                  },
                },
                _count: {
                  select: {
                    likes: true,
                  },
                },
              },
            },
          },
          orderBy: {
            addedAt: 'desc',
          },
        },
      },
    });

    if (!playlist) {
      return ApiResponse.error('Playlist not found', 404);
    }

    // Verify playlist belongs to user
    if (playlist.userId !== user.id) {
      return ApiResponse.error('Access denied: This playlist belongs to another user', 403);
    }

    return ApiResponse.success('Playlist fetched successfully', playlist, 200);
  } catch (error) {
    console.error('Error fetching playlist:', error);
    return ApiResponse.error('Failed to fetch playlist', 500);
  }
}

// DELETE playlist
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ playlistId: string }> }
) {
  try {
    const { playlistId } = await params;
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

    const playlist = await prisma.playlist.findUnique({
      where: { id: playlistId },
    });

    if (!playlist) {
      return ApiResponse.error('Playlist not found', 404);
    }

    if (playlist.userId !== user.id) {
      return ApiResponse.error('Access denied: This playlist belongs to another user', 403);
    }

    await prisma.playlist.delete({
      where: { id: playlistId },
    });

    return ApiResponse.success('Playlist deleted successfully', null, 200);
  } catch (error) {
    console.error('Error deleting playlist:', error);
    return ApiResponse.error('Failed to delete playlist', 500);
  }
}
