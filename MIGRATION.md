# Database Migration: Mongoose to Prisma

## Overview
This project has been migrated from MongoDB with Mongoose to PostgreSQL with Prisma ORM.

## Schema Changes

### Models

#### User
- Added `username` field (optional, unique)
- Added `role` field with enum (USER, ADMIN)
- Removed Instagram, YouTube, MediaUpload, and Project relations
- Using Clerk for authentication with `vendorId` tracking
- Relations: `uploadedSongs`, `playlists`, `likes`

#### Song
- Renamed fields to match PostgreSQL conventions:
  - `songFile` → `audioUrl`
  - `songName` → `title`
  - `singerName` → `artist` (array)
  - `composersName` → `composers` (array)
  - `albumName` → `album`
  - `coverImage` → `coverUrl`
- Added `uploadedByUserId` foreign key to User
- Relations: `uploadedBy`, `playlistSongs`, `likes`

#### Playlist (NEW STRUCTURE)
- Users can now create **multiple playlists**
- Each playlist has a `name` and optional `description`
- Playlists are sorted alphabetically by name
- Relations: `user`, `playlistSongs`

#### PlaylistSong (NEW)
- Junction table for many-to-many relationship between Playlist and Song
- Includes `position` field for custom ordering
- Unique constraint on `playlistId` + `songId` (song can only appear once per playlist)

#### Like (NEW)
- Users can like songs
- Unique constraint on `userId` + `songId` (user can only like a song once)
- Relations: `user`, `song`

## API Routes

### Updated Routes

#### Songs
- `GET /api/get-songs` - Get all songs with uploader info
- `POST /api/upload-song` - Upload song (ADMIN only)

#### Playlists
- `GET /api/get-playlist?userId=xxx` - Get all user playlists (sorted alphabetically)
- `GET /api/get-playlist?playlistId=xxx` - Get specific playlist
- `POST /api/post-playlist` - Create playlist or add song to existing playlist
  ```json
  {
    "userId": "user-uuid",
    "songId": "song-uuid",
    "playlistId": "playlist-uuid", // Optional - omit to create new playlist
    "playlistName": "My Playlist" // Required only when creating new playlist
  }
  ```
- `DELETE /api/delete-playlist` - Delete playlist or remove song from playlist
  ```json
  {
    "playlistId": "playlist-uuid",
    "songId": "song-uuid", // Optional - omit to delete entire playlist
    "deletePlaylist": true // Set to true to delete entire playlist
  }
  ```

#### Likes (NEW)
- `POST /api/like-song` - Like a song
  ```json
  {
    "userId": "user-uuid",
    "songId": "song-uuid"
  }
  ```
- `DELETE /api/like-song` - Unlike a song
  ```json
  {
    "userId": "user-uuid",
    "songId": "song-uuid"
  }
  ```
- `GET /api/get-liked-songs?userId=xxx` - Get all liked songs for a user

#### Webhooks (NEW)
- `POST /api/webhooks/clerk` - Clerk webhook for user sync
  - Handles `user.created`, `user.updated`, `user.deleted` events
  - Automatically creates/updates/deletes users in database

### Deprecated Routes
The following routes are deprecated and should not be used:
- `POST /api/sign-up` - Use Clerk for authentication
- `POST /api/verify-code` - Use Clerk for email verification
- NextAuth routes in `/api/auth/[...nextauth]` - Use Clerk instead

## Setup Instructions

### 1. Install Dependencies
```bash
npm install @prisma/client
npm install -D prisma
npm install svix # For Clerk webhooks
```

### 2. Configure Environment Variables
Add to `.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/swaras_music"
CLERK_SECRET_KEY="your-clerk-secret-key"
CLERK_WEBHOOK_SECRET="your-clerk-webhook-secret"
```

### 3. Generate Prisma Client
```bash
npx prisma generate
```

### 4. Run Migrations
```bash
npx prisma migrate dev --name initial_migration
```

### 5. Configure Clerk Webhooks
1. Go to Clerk Dashboard → Webhooks
2. Add endpoint: `https://your-domain.com/api/webhooks/clerk`
3. Subscribe to events: `user.created`, `user.updated`, `user.deleted`
4. Copy the webhook secret to `CLERK_WEBHOOK_SECRET`

## Admin Management

To make a user an admin:
```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'admin@example.com';
```

Or using Prisma Client:
```typescript
await prisma.user.update({
  where: { email: 'admin@example.com' },
  data: { role: 'ADMIN' }
});
```

## Prisma Studio

View and edit your database in a GUI:
```bash
npx prisma studio
```

## Type Safety

All Prisma types are exported from `@/types/prisma`:
```typescript
import { Song, User, Playlist, Like } from '@/types/prisma';
```

## Files to Remove (Optional)

The following files are no longer needed and can be deleted:
- `/src/model/SongModel.ts`
- `/src/model/PlaylistModel.ts`
- `/src/model/UserModel.ts`
- `/src/lib/dbConnection.ts`
- `/src/app/api/sign-up/route.ts`
- `/src/app/api/verify-code/route.ts`
- `/src/app/api/auth/[...nextauth]/` (entire folder)

## Migration Checklist

- [x] Create Prisma schema
- [x] Generate Prisma client
- [x] Update API routes to use Prisma
- [x] Create Clerk webhook handler
- [x] Update context providers to use new types
- [x] Create types file for Prisma models
- [ ] Run database migration
- [ ] Configure Clerk webhooks
- [ ] Test all API endpoints
- [ ] Remove deprecated files
- [ ] Update frontend components to use new API structure
