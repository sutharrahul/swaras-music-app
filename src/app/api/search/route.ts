import { ApiResponse } from '@/app/utils/ApiResponse';
import prisma from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.trim().length === 0) {
      return ApiResponse.error('Search query is required', 400);
    }

    const searchTerm = query.trim();

    // Search songs by title or artist
    const songs = await prisma.song.findMany({
      where: {
        OR: [
          { title: { contains: searchTerm, mode: 'insensitive' } },
          { artist: { hasSome: [searchTerm] } },
          { album: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        title: true,
        artist: true,
        coverUrl: true,
        album: true,
      },
      take: 10,
    });

    // Search playlists (only if user is authenticated)
    let playlists: any[] = [];
    const { userId: clerkUserId } = await auth();

    if (clerkUserId) {
      const user = await prisma.user.findUnique({
        where: { vendorId: clerkUserId },
        select: { id: true },
      });

      if (user) {
        playlists = await prisma.playlist.findMany({
          where: {
            AND: [
              { userId: user.id },
              {
                OR: [
                  { name: { contains: searchTerm, mode: 'insensitive' } },
                  { description: { contains: searchTerm, mode: 'insensitive' } },
                ],
              },
            ],
          },
          select: {
            id: true,
            name: true,
            description: true,
          },
          take: 10,
        });
      }
    }

    return ApiResponse.success('Search results', { songs, playlists }, 200);
  } catch (error) {
    console.error('Search error:', error);
    return ApiResponse.error('Failed to search', 500);
  }
}
