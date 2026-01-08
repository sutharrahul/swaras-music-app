import { ApiResponce } from '@/app/utils/ApiResponse';
import cloudinary from '@/lib/cloudinary';
import prisma from '@/lib/prisma';
import { parseBuffer } from 'music-metadata';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/options';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.email) {
    return ApiResponce.error('Unauthorized: Please log in', 401);
  }

  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, role: true },
    });

    if (!user || user.role !== 'ADMIN') {
      return ApiResponce.error('Only admins can upload songs', 403);
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return ApiResponce.error('File is required', 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract metadata from file
    const metadata = await parseBuffer(buffer, 'audio/mpeg');
    const { title, artist, album, picture, composer } = metadata.common;

    // Normalize composer to string array
    let composerArray: string[] = ['Unknown Composer'];
    if (composer) {
      if (Array.isArray(composer)) {
        // Flatten if it's a nested array
        composerArray = composer.flat().filter((c): c is string => typeof c === 'string');
      } else if (typeof composer === 'string') {
        composerArray = [composer];
      }
    }

    // Upload song file to Cloudinary
    const uploadSong = await new Promise<{
      secure_url: string;
      duration?: number;
    }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ resource_type: 'video' }, (err, result) => {
          if (err || !result) reject(err);
          else resolve(result);
        })
        .end(buffer);
    });

    // Upload album art to Cloudinary (if present)
    let coverImageUrl = '';
    if (picture?.[0]) {
      const imageBuffer = picture[0].data;
      const mime = picture[0].format;

      const uploadImage = await new Promise<{ secure_url: string }>((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            {
              resource_type: 'image',
              folder: 'music_covers',
              format: mime.split('/')[1], // e.g., "jpeg"
            },
            (err, result) => {
              if (err || !result) reject(err);
              else resolve(result);
            }
          )
          .end(imageBuffer);
      });

      coverImageUrl = uploadImage.secure_url;
    }

    // Create song in database
    const newSong = await prisma.song.create({
      data: {
        title: title || 'Unknown Title',
        artist: artist ? [artist] : ['Unknown Artist'],
        composers: composerArray,
        album: album || null,
        duration: Math.round(uploadSong?.duration || 0),
        coverUrl: coverImageUrl || '',
        audioUrl: uploadSong.secure_url,
        uploadedByUserId: user.id,
      },
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
    });

    return ApiResponce.success('Song uploaded with metadata', newSong, 201);
  } catch (error) {
    console.error('Upload error:', error);
    return ApiResponce.error('Failed to upload song', 500);
  }
}
