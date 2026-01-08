import { ApiResponce } from '@/app/utils/ApiResponse';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const allSongs = await prisma.song.findMany({
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (allSongs.length === 0) {
      return ApiResponce.success('No songs available', [], 200);
    }

    return ApiResponce.success('All songs fetch successfully', allSongs, 200);
  } catch (error) {
    console.error('Error fetching songs:', error);
    return ApiResponce.error('Something went wrong while try to fetch songs', 500);
  }
}
