import { ApiResponse } from '@/app/utils/ApiResponse';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const { userId: clerkUserId } = await auth();

    if (!clerkUserId) {
      return ApiResponse.error('Unauthorized', 401);
    }

    // Find user in database and check role
    const user = await prisma.user.findUnique({
      where: { vendorId: clerkUserId },
      select: { id: true, role: true, email: true },
    });

    if (!user) {
      return ApiResponse.error('User not found', 404);
    }

    return ApiResponse.success('User role retrieved', {
      isAdmin: user.role === 'ADMIN',
      role: user.role,
      userId: user.id,
    });
  } catch (error) {
    console.error('Error checking admin status:', error);
    return ApiResponse.error('Failed to check admin status', 500);
  }
}
