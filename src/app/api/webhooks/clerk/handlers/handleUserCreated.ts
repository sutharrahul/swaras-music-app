import { ApiResponse } from '@/app/utils/ApiResponse';
import { extractPrimaryEmail, getOauthProvider, isEmailVerified } from './clerkUserUtils';
import prisma from '@/lib/prisma';


export default async function handleUserCreated(userData: any) {
  try {
    // check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { vendorId: userData.id },
    });

    if (existingUser) {
      console.log('User already exists in the database. Skipping creation.');
      return ApiResponse.success('User already exists', existingUser);
    }

    const email = extractPrimaryEmail(userData);
    const username = userData?.username || null;
    const firstName = userData?.first_name || null;
    const lastName = userData?.last_name || null;
    const profileImageUrl = userData?.profile_image_url || userData?.image_url || null;
    const vendorId = userData.id;

    // Determine if this is an OAuth signup
    const isOAuthSignup = userData.external_accounts && userData.external_accounts.length > 0;
    const oauthProvider = isOAuthSignup ? getOauthProvider(userData.external_accounts) : null;

    let signupMethod: 'EMAIL' | 'GOOGLE' = 'EMAIL';
    if (oauthProvider == 'google') {
      signupMethod = 'GOOGLE';
    }

    // Vendor data
    const vendorData = {
      clerkId: userData.id,
      createdAt: new Date(userData.created_at),
      lastActiveAt: userData.last_active_at ? new Date(userData.last_active_at) : null,
      lastSignInAt: userData.last_sign_in_at ? new Date(userData.last_sign_in_at) : null,
      hasImage: userData.has_image || false,
      passwordEnabled: userData.password_enabled || false,
      twoFactorEnabled: userData.two_factor_enabled || false,
      emailVerified: isEmailVerified(userData),
      oauthProvider: oauthProvider,
      externalAccounts: userData.external_accounts || [],
      publicMetadata: userData.public_metadata || {},
      privateMetadata: userData.private_metadata || {},
      unsafeMetadata: userData.unsafe_metadata || {},
    };

    // Create user in your database
    const createUser = await prisma.user.create({
      data: {
        email: email,
        username: username,
        firstName: firstName,
        lastName: lastName,
        profileImageUrl: profileImageUrl,
        vendorId: vendorId,
        vendorData: vendorData,
        signupMethod: signupMethod,
      },
    });

    console.log('User created successfully in the database:', createUser);

    if (isOAuthSignup) {
      console.log('This user signed up using OAuth via', oauthProvider);
      ApiResponse.success('User created via OAuth signup', oauthProvider);
    }

    return ApiResponse.success('User created successfully', createUser);
  } catch (error) {
    console.error('Error handling user.created event:', error);
    throw error;
  }
}
