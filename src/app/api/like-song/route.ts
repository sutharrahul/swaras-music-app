import { ApiResponse } from '@/app/utils/ApiResponse';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { userId, songId } = await request.json();

    if (!userId || !songId) {
      return ApiResponse.error('userId and songId are required', 400);
    }

    // Check if already liked
    const existingLike = await prisma.like.findUnique({
      where: {
        userId_songId: {
          userId,
          songId,
        },
      },
    });

    if (existingLike) {
      return ApiResponse.error('Song already liked', 409);
    }

    // Create like
    const like = await prisma.like.create({
      data: {
        userId,
        songId,
      },
      include: {
        song: true,
      },
    });

    return ApiResponse.success('Song liked successfully', like, 201);
  } catch (error) {
    console.error('Error liking song:', error);
    return ApiResponse.error('Failed to like song', 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const { userId, songId } = await request.json();

    if (!userId || !songId) {
      return ApiResponse.error('userId and songId are required', 400);
    }

    // Delete like
    const deletedLike = await prisma.like.delete({
      where: {
        userId_songId: {
          userId,
          songId,
        },
      },
    });

    return ApiResponse.success('Song unliked successfully', deletedLike, 200);
  } catch (error) {
    console.error('Error unliking song:', error);
    return ApiResponse.error('Failed to unlike song', 500);
  }
}
