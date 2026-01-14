import { ApiResponse } from '@/app/utils/ApiResponse';
import cloudinary from '@/lib/cloudinary';
import prisma from '@/lib/prisma';

// Helper function to extract public_id from Cloudinary URL
function extractPublicId(url: string): string | null {
  try {
    // Example URL: https://res.cloudinary.com/demo/video/upload/v1234567890/folder/sample.mp3
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;
    
    const pathParts = parts[1].split('/').slice(1); // Skip version (v1234567890)
    const publicId = pathParts.join('/').split('.')[0]; // Remove extension
    
    return publicId || null;
  } catch (error) {
    console.error('Error extracting public_id:', error);
    return null;
  }
}

export async function DELETE(request: Request) {
  try {
    const { songId, userId } = await request.json();

    if (!songId || !userId) {
      return ApiResponse.error('Song ID and User ID are required', 400);
    }

    // Verify user is admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      return ApiResponse.error('User not found', 404);
    }

    if (user.role !== 'ADMIN') {
      return ApiResponse.error('Unauthorized: Admin access required', 403);
    }

    // Get song details before deletion
    const song = await prisma.song.findUnique({
      where: { id: songId },
      select: {
        id: true,
        title: true,
        audioUrl: true,
        coverUrl: true,
      },
    });

    if (!song) {
      return ApiResponse.error('Song not found', 404);
    }

    // Delete audio file from Cloudinary
    const audioPublicId = extractPublicId(song.audioUrl);
    if (audioPublicId) {
      try {
        await cloudinary.uploader.destroy(audioPublicId, { resource_type: 'video' });
        console.log(`Audio file deleted from Cloudinary: ${audioPublicId}`);
      } catch (cloudinaryError) {
        console.error('Failed to delete audio from Cloudinary:', cloudinaryError);
        // Continue with database deletion even if Cloudinary fails
      }
    }

    // Delete cover image from Cloudinary if it exists
    if (song.coverUrl) {
      const coverPublicId = extractPublicId(song.coverUrl);
      if (coverPublicId) {
        try {
          await cloudinary.uploader.destroy(coverPublicId, { resource_type: 'image' });
          console.log(`Cover image deleted from Cloudinary: ${coverPublicId}`);
        } catch (cloudinaryError) {
          console.error('Failed to delete cover from Cloudinary:', cloudinaryError);
          // Continue with database deletion even if Cloudinary fails
        }
      }
    }

    // Delete song from database (cascade will handle related records)
    const deletedSong = await prisma.song.delete({
      where: { id: songId },
    });

    return ApiResponse.success('Song deleted successfully', {
      id: deletedSong.id,
      title: deletedSong.title,
    }, 200);
  } catch (error) {
    console.error('Error deleting song:', error);
    return ApiResponse.error('Failed to delete song', 500);
  }
}
