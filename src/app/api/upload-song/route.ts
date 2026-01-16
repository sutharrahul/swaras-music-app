import { ApiResponse } from '@/app/utils/ApiResponse';
import cloudinary from '@/lib/cloudinary';
import prisma from '@/lib/prisma';
import { parseBuffer } from 'music-metadata';
import { auth } from '@clerk/nextjs/server';
import { uploadQueue } from '@/lib/uploadQueue';
import { randomUUID } from 'crypto';

// Constants for file validation
const MAX_FILES = 10;
const MAX_AUDIO_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/m4a', 'audio/mp4'];

export async function POST(request: Request) {
  // Authenticate user with Clerk
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return ApiResponse.error('Unauthorized: Please log in', 401);
  }

  try {
    // Find user in database by Clerk vendorId and check admin role
    const user = await prisma.user.findUnique({
      where: { vendorId: clerkUserId },
      select: { id: true, role: true },
    });

    if (!user) {
      return ApiResponse.error('User not found', 404);
    }

    if (user.role !== 'ADMIN') {
      return ApiResponse.error('Only admins can upload songs', 403);
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return ApiResponse.error('No files provided', 400);
    }

    if (files.length > MAX_FILES) {
      return ApiResponse.error(`Maximum ${MAX_FILES} files allowed per upload`, 400);
    }

    // Validate all files before processing
    for (const file of files) {
      if (!file || !(file instanceof File)) {
        return ApiResponse.error('Invalid file in upload', 400);
      }

      if (!ALLOWED_AUDIO_TYPES.includes(file.type)) {
        return ApiResponse.error(
          `Invalid file type for "${file.name}". Allowed types: mp3, wav, flac, m4a`,
          400
        );
      }

      if (file.size > MAX_AUDIO_SIZE) {
        return ApiResponse.error(`File "${file.name}" exceeds maximum size of 100MB`, 400);
      }
    }

    // Create job and start background processing
    const jobId = randomUUID();
    uploadQueue.createJob(jobId, files.length);

    // Start background processing (don't await)
    processUploadJob(jobId, files, user.id).catch(error => {
      console.error(`Job ${jobId} failed:`, error);
      uploadQueue.markFailed(jobId, 'Unexpected error during processing');
    });

    // Return immediately with job ID
    return ApiResponse.success(
      'Upload started in background',
      {
        jobId,
        totalFiles: files.length,
        message: 'You can continue using the app. You will be notified when upload completes.',
      },
      202 // Accepted
    );
  } catch (error) {
    console.error('Upload error:', error);
    return ApiResponse.error('Failed to start upload', 500);
  }
}

// Background processing function
async function processUploadJob(jobId: string, files: File[], userId: string) {
  uploadQueue.markProcessing(jobId);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileName = file.name;

    try {
      console.log(`[Job ${jobId}] Processing file ${i + 1}/${files.length}: ${fileName}`);

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Extract metadata from file
      const metadata = await parseBuffer(buffer, file.type);
      const { title, artist, album, picture, composer } = metadata.common;

      console.log(`[Job ${jobId}] Metadata extracted for ${fileName}:`, { title, artist, album });

      // Normalize composer to string array
      let composerArray: string[] = ['Unknown Composer'];
      if (composer) {
        if (Array.isArray(composer)) {
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

        // Validate image size
        if (imageBuffer.length > MAX_IMAGE_SIZE) {
          throw new Error(`Cover image exceeds maximum size of 10MB`);
        }

        const uploadImage = await new Promise<{ secure_url: string }>((resolve, reject) => {
          cloudinary.uploader
            .upload_stream(
              {
                resource_type: 'image',
                folder: 'music_covers',
                format: mime.split('/')[1],
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
          uploadedByUserId: userId,
        },
        include: {
          uploadedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      console.log(`[Job ${jobId}] Song created successfully: ${newSong.title} (ID: ${newSong.id})`);

      uploadQueue.addResult(jobId, {
        success: true,
        fileName,
        song: newSong,
      });
    } catch (error) {
      console.error(`[Job ${jobId}] Error uploading ${fileName}:`, error);
      uploadQueue.addResult(jobId, {
        success: false,
        fileName,
        error: error instanceof Error ? error.message : 'Upload failed',
      });
    }
  }

  console.log(`[Job ${jobId}] All files processed. Marking as completed.`);
  uploadQueue.markCompleted(jobId);
}

// GET endpoint for job status
export async function GET(request: Request) {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return ApiResponse.error('Unauthorized', 401);
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return ApiResponse.error('Job ID is required', 400);
    }

    const job = uploadQueue.getJob(jobId);

    if (!job) {
      return ApiResponse.error('Job not found', 404);
    }

    return ApiResponse.success('Job status retrieved', job, 200);
  } catch (error) {
    console.error('Status check error:', error);
    return ApiResponse.error('Failed to get job status', 500);
  }
}
