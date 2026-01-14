import { ApiResponse } from '@/app/utils/ApiResponse';
import prisma from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

// GET user's playlists
export async function GET() {
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

    const playlists = await prisma.playlist.findMany({
      where: { userId: user.id },
      include: {
        _count: {
          select: {
            playlistSongs: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return ApiResponse.success('Playlists fetched successfully', playlists, 200);
  } catch (error) {
    console.error('Error fetching playlists:', error);
    return ApiResponse.error('Failed to fetch playlists', 500);
  }
}

// POST create new playlist
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

    const { name, description } = await request.json();

    if (!name || name.trim().length === 0) {
      return ApiResponse.error('Playlist name is required', 400);
    }

    const playlist = await prisma.playlist.create({
      data: {
        userId: user.id,
        name: name.trim(),
        description: description?.trim() || null,
      },
      include: {
        _count: {
          select: {
            playlistSongs: true,
          },
        },
      },
    });

    return ApiResponse.success('Playlist created successfully', playlist, 201);
  } catch (error) {
    console.error('Error creating playlist:', error);
    return ApiResponse.error('Failed to create playlist', 500);
  }
}
