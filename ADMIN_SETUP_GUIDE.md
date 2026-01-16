# Admin Access Setup Guide

## Overview

Admin access has been implemented to control who can upload and delete songs in the Swaras Music App.

## Features Implemented

### 1. Database Role Check

- Admin status is stored in the database (`users` table, `role` field)
- Two roles available: `USER` and `ADMIN`
- Admin checks happen on both server-side and client-side

### 2. Admin-Only Features

#### Upload Songs

- **Location**: Header (top right) - "Upload Songs" button
- **Access**: Visible only to admin users
- **Route**: `/admin/upload-song`
- **Protection**: Client-side verification with redirect for non-admins

#### Delete Songs

- **Location**: Song lists (home page, playlists)
- **Access**: Red trash icon visible only to admin users
- **Function**: Permanently deletes song from database and Cloudinary
- **Protection**: Confirmation dialog + server-side role verification

### 3. Admin Verification Flow

1. User authenticates via Clerk
2. Frontend calls `/api/check-admin` to verify admin status
3. Admin status cached for 5 minutes (React Query)
4. UI elements conditionally rendered based on admin status

## How to Set a User as Admin

### Method 1: Direct Database Update (Recommended)

Using your database client (Prisma Studio, pgAdmin, etc.):

\`\`\`sql
UPDATE users
SET role = 'ADMIN'
WHERE email = 'your-email@example.com';
\`\`\`

### Method 2: Using Prisma Studio

1. Open terminal in your project directory
2. Run: \`npx prisma studio\`
3. Navigate to the `users` table
4. Find your user by email
5. Change the `role` field from `USER` to `ADMIN`
6. Save changes

### Method 3: Using Code (One-time script)

Create a temporary script file:

\`\`\`typescript
// scripts/set-admin.ts
import prisma from '../src/lib/prisma';

async function setAdmin(email: string) {
const user = await prisma.user.update({
where: { email },
data: { role: 'ADMIN' },
});
console.log('User updated:', user);
}

setAdmin('your-email@example.com')
.catch(console.error)
.finally(() => prisma.$disconnect());
\`\`\`

Run: \`npx tsx scripts/set-admin.ts\`

## Testing Admin Access

### 1. Login as Admin User

- Sign in with the email you set as admin
- You should see "Upload Songs" button in the header

### 2. Test Upload Feature

- Click "Upload Songs" button
- Select audio files (max 10, up to 100MB each)
- Upload starts in background
- Verify songs appear in the database

### 3. Test Delete Feature

- Navigate to home page
- You should see a red trash icon next to each song (in addition to the add to playlist icon)
- Click the trash icon
- Confirm deletion in the dialog
- Song is permanently deleted from database and Cloudinary

### 4. Test Non-Admin Access

- Login as a regular user
- Upload button should NOT be visible in header
- Delete icons should NOT be visible in song lists
- Direct navigation to `/admin/upload-song` should redirect to home with error message

## API Endpoints

### Check Admin Status

\`\`\`
GET /api/check-admin
Response: { success: true, data: { isAdmin: boolean, role: 'USER' | 'ADMIN', userId: string } }
\`\`\`

### Upload Song (Admin Only)

\`\`\`
POST /api/upload-song
Body: FormData with 'files' array
Response: { success: true, data: { jobId: string, totalFiles: number } }
\`\`\`

### Delete Song (Admin Only)

\`\`\`
DELETE /api/admin/delete-song
Body: { songId: string, userId: string }
Response: { success: true, data: { id: string, title: string } }
\`\`\`

## Security Notes

1. **Server-Side Validation**: All admin routes verify role in the database before executing
2. **Client-Side Protection**: UI elements hidden for non-admins to improve UX
3. **Double Verification**: Admin status checked on both route access and API calls
4. **No Role Escalation**: Users cannot promote themselves; only database updates work

## File Changes Summary

### New Files

- `/src/app/api/check-admin/route.ts` - Admin status verification endpoint
- `/src/hook/apiHooks/useUserApi.ts` - User API hooks
- `/src/hook/query/useUserQueries.ts` - User React Query hooks

### Modified Files

- `/src/components/Header.tsx` - Added Upload Songs button for admins
- `/src/components/PlayList.tsx` - Added delete button for admins
- `/src/app/(auth).../admin/upload-song/page.tsx` - Added client-side admin verification
- `/src/hook/apiHooks/index.ts` - Exported useUserApi
- `/src/hook/query/index.ts` - Exported useUserQueries
- `/src/app/api/upload-song/route.ts` - Enhanced logging

## Troubleshooting

### Admin button not showing

1. Clear browser cache and reload
2. Check database - confirm role is set to 'ADMIN'
3. Check browser console for API errors
4. Verify you're logged in with correct account

### Upload not working

1. Check file size (max 100MB per file)
2. Check file type (only mp3, wav, flac, m4a allowed)
3. Verify Cloudinary credentials in `.env`
4. Check server console logs for errors

### Delete not working

1. Verify admin role in database
2. Check browser console for errors
3. Verify Cloudinary credentials for asset deletion
4. Check server logs for specific error messages

## Future Enhancements

Consider implementing:

- Admin dashboard with analytics
- Bulk upload/delete operations
- User management (promote/demote admins)
- Activity logs for admin actions
- Song edit functionality
- Approval workflow for uploads
