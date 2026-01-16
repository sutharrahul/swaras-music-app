import { ApiResponse } from '@/app/utils/ApiResponse';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const [allSongs, totalCount] = await Promise.all([
      prisma.song.findMany({
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
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.song.count(),
    ]);

    const hasMore = skip + allSongs.length < totalCount;

    return ApiResponse.success(
      'Songs fetched successfully',
      {
        songs: allSongs,
        pagination: {
          page,
          limit,
          total: totalCount,
          hasMore,
        },
      },
      200
    );
  } catch (error) {
    console.error('Error fetching songs:', error);
    return ApiResponse.error('Something went wrong while try to fetch songs', 500);
  }
}
