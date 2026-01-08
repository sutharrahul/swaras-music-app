import { ApiResponce } from '@/app/utils/ApiResponse';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return ApiResponce.error('userId is required', 400);
    }

    // Get all liked songs for a user
    const likedSongs = await prisma.like.findMany({
      where: { userId },
      include: {
        song: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                email: true,
                username: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (likedSongs.length === 0) {
      return ApiResponce.success('No liked songs found', [], 200);
    }

    return ApiResponce.success('Liked songs fetched successfully', likedSongs, 200);
  } catch (error) {
    console.error('Error fetching liked songs:', error);
    return ApiResponce.error('Failed to fetch liked songs', 500);
  }
}
