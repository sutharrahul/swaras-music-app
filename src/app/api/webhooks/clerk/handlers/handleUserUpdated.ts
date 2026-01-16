import { ApiResponse } from '@/app/utils/ApiResponse';
import { extractPrimaryEmail, isEmailVerified } from './clerkUserUtils';
import prisma from '@/lib/prisma';

export default async function handleUpdateUser(userData: any) {
  try {
    const email = extractPrimaryEmail(userData);
    const firstName = userData?.first_name || null;
    const lastName = userData?.last_name || null;
    const profileImageUrl = userData?.profile_image_url || userData?.image_url || null;
    const vendorId = userData.id;

    // check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { vendorId: vendorId },
    });

    if (!existingUser) {
      console.log('User not found in the database. Cannot update non-existing user.');
      return ApiResponse.error('User not found', 404);
    }

    // Update vendor data

    const existingVendorData = (existingUser.vendorData as any) || {};
    const updatedVendorData = {
      ...existingVendorData,
      lastActiveAt: userData.last_active_at
        ? new Date(userData.last_active_at)
        : existingVendorData.lastActiveAt,
      lastSignInAt: userData.last_sign_in_at
        ? new Date(userData.last_sign_in_at)
        : existingVendorData.lastSignInAt,
      emailVerified: isEmailVerified(userData),
      publicMetadata: userData.public_metadata || existingVendorData.publicMetadata,
      privateMetadata: userData.private_metadata || existingVendorData.privateMetadata,
      unsafeMetadata: userData.unsafe_metadata || existingVendorData.unsafeMetadata,
    };

    // Update user in your database
    const updateUser = await prisma.user.update({
      where: { vendorId: vendorId },
      data: {
        email: email,
        firstName: firstName,
        lastName: lastName,
        profileImageUrl: profileImageUrl,
        vendorData: updatedVendorData,
      },
    });

    console.log('User updated successfully in the database:', updateUser);
    return ApiResponse.success('User updated successfully', updateUser);
  } catch (error) {
    console.error('Error handling user.updated event:', error);
    throw error;
  }
}
