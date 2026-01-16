# API Hooks & TanStack Query Documentation

This document provides a comprehensive guide to using the API hooks and TanStack Query hooks in the Swaras Music App.

## Table of Contents

- [Architecture](#architecture)
- [API Hooks](#api-hooks)
- [TanStack Query Hooks](#tanstack-query-hooks)
- [Usage Examples](#usage-examples)

---

## Architecture

The data fetching layer is organized into two main parts:

1. **API Hooks** (`src/hook/apiHooks/`) - Direct API call wrappers
2. **Query Hooks** (`src/hook/query/`) - TanStack Query integration for caching, mutations, and state management

```
src/hook/
├── apiHooks/
│   ├── useApiClient.ts      # Base client with auth
│   ├── useSongApi.ts         # Song API calls
│   ├── usePlaylistApi.ts     # Playlist API calls
│   ├── useAdminApi.ts        # Admin API calls
│   └── index.ts              # Central export
└── query/
    ├── useSongQueries.ts     # Song queries & mutations
    ├── usePlaylistQueries.ts # Playlist queries & mutations
    ├── useAdminQueries.ts    # Admin mutations
    └── index.ts              # Central export
```

---

## API Hooks

### useApiClient

Base hook that provides authenticated HTTP methods.

```typescript
import { useApiClient } from '@/hook/apiHooks';

const { get, post, patch, del } = useApiClient();
```

**Methods:**

- `get(url, config)` - GET request
- `post(url, data, config)` - POST request
- `patch(url, data, config)` - PATCH request
- `del(url, config)` - DELETE request

All methods automatically include Clerk authentication token.

---

### useSongApi

Hook for song-related API calls.

```typescript
import { useSongApi } from '@/hook/apiHooks';

const {
  getSongs, // Get all songs
  uploadSong, // Upload new song (FormData)
  likeSong, // Like a song
  unlikeSong, // Unlike a song
  getLikedSongs, // Get user's liked songs
} = useSongApi();
```

**API Endpoints:**

- `GET /api/get-songs` - Fetch all songs
- `POST /api/upload-song` - Upload song (multipart/form-data)
- `POST /api/like-song` - Like a song
- `DELETE /api/like-song` - Unlike a song
- `GET /api/get-liked-songs?userId={id}` - Get liked songs

---

### usePlaylistApi

Hook for playlist-related API calls.

```typescript
import { usePlaylistApi } from '@/hook/apiHooks';

const {
  getUserPlaylists, // Get all playlists for user
  getPlaylistById, // Get specific playlist
  createPlaylist, // Create new playlist
  addSongToPlaylist, // Add song to playlist
  deletePlaylist, // Delete playlist
  removeSongFromPlaylist, // Remove song from playlist
} = usePlaylistApi();
```

**API Endpoints:**

- `GET /api/get-playlist?userId={id}` - Get user's playlists
- `GET /api/get-playlist?playlistId={id}` - Get playlist details
- `POST /api/post-playlist` - Create playlist or add song
- `DELETE /api/delete-playlist` - Delete playlist
- `DELETE /api/remove-playlist-song` - Remove song from playlist

---

### useAdminApi

Hook for admin-only API calls.

```typescript
import { useAdminApi } from '@/hook/apiHooks';

const { deleteSong } = useAdminApi();
```

**API Endpoints:**

- `DELETE /api/admin/delete-song` - Delete a song (admin only)

---

## TanStack Query Hooks

### Song Queries

#### useSongs()

Fetch all songs with caching.

```typescript
import { useSongs } from '@/hook/query';

const { data, isLoading, error, refetch } = useSongs();
```

**Features:**

- 5-minute stale time
- Automatic caching
- Background refetch

---

#### useLikedSongs(userId, enabled)

Fetch user's liked songs.

```typescript
import { useLikedSongs } from '@/hook/query';

const { data, isLoading } = useLikedSongs(userId, true);
```

**Parameters:**

- `userId` - User ID to fetch liked songs for
- `enabled` - Enable/disable query (default: true)

**Features:**

- 3-minute stale time
- Conditional fetching based on userId

---

#### useSongMutations()

Mutations for song operations.

```typescript
import { useSongMutations } from '@/hook/query';

const { uploadSongMutation, likeSongMutation, unlikeSongMutation } = useSongMutations();

// Upload song
uploadSongMutation.mutate(formData, {
  onSuccess: data => console.log('Song uploaded', data),
  onError: error => console.error('Upload failed', error),
});

// Like song
likeSongMutation.mutate({ userId: 'user123', songId: 'song456' });

// Unlike song
unlikeSongMutation.mutate({ userId: 'user123', songId: 'song456' });
```

**Auto-invalidation:**

- Invalidates `songs` cache on success
- Invalidates `liked songs` cache for the user

---

### Playlist Queries

#### useUserPlaylists(userId, enabled)

Fetch all playlists for a user.

```typescript
import { useUserPlaylists } from '@/hook/query';

const { data, isLoading } = useUserPlaylists(userId);
```

**Features:**

- 5-minute stale time
- Conditional fetching

---

#### usePlaylist(playlistId, enabled)

Fetch specific playlist details.

```typescript
import { usePlaylist } from '@/hook/query';

const { data, isLoading } = usePlaylist(playlistId);
```

**Features:**

- 3-minute stale time
- Includes playlist songs with positions

---

#### usePlaylistMutations()

Mutations for playlist operations.

```typescript
import { usePlaylistMutations } from '@/hook/query';

const {
  createPlaylistMutation,
  addSongToPlaylistMutation,
  deletePlaylistMutation,
  removeSongFromPlaylistMutation,
} = usePlaylistMutations();

// Create new playlist
createPlaylistMutation.mutate({
  userId: 'user123',
  playlistName: 'My Favorites',
  songId: 'song456',
});

// Add song to playlist
addSongToPlaylistMutation.mutate({
  playlistId: 'playlist789',
  songId: 'song456',
});

// Delete playlist
deletePlaylistMutation.mutate({
  playlistId: 'playlist789',
  userId: 'user123',
});

// Remove song from playlist
removeSongFromPlaylistMutation.mutate({
  playlistId: 'playlist789',
  songId: 'song456',
});
```

**Auto-invalidation:**

- Smart cache invalidation for affected queries
- Invalidates user playlists and playlist details

---

### Admin Queries

#### useAdminMutations()

Admin-only mutations.

```typescript
import { useAdminMutations } from '@/hook/query';

const { deleteSongMutation } = useAdminMutations();

// Delete song
deleteSongMutation.mutate('song456', {
  onSuccess: () => console.log('Song deleted'),
});
```

**Auto-invalidation:**

- Invalidates all songs cache
- Invalidates all playlists cache

---

## Usage Examples

### Example 1: Display All Songs

```typescript
import { useSongs } from '@/hook/query';

export function SongList() {
  const { data, isLoading, error } = useSongs();

  if (isLoading) return <div>Loading songs...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data?.data?.map((song) => (
        <div key={song.id}>{song.title}</div>
      ))}
    </div>
  );
}
```

---

### Example 2: Like/Unlike Song with Optimistic Updates

```typescript
import { useSongMutations } from '@/hook/query';
import { useUser } from '@clerk/nextjs';

export function LikeButton({ songId }: { songId: string }) {
  const { user } = useUser();
  const { likeSongMutation, unlikeSongMutation } = useSongMutations();

  const handleLike = () => {
    likeSongMutation.mutate(
      { userId: user!.id, songId },
      {
        onSuccess: () => console.log('Liked!'),
        onError: (error) => console.error('Failed to like', error),
      }
    );
  };

  return (
    <button onClick={handleLike} disabled={likeSongMutation.isPending}>
      {likeSongMutation.isPending ? 'Liking...' : 'Like'}
    </button>
  );
}
```

---

### Example 3: Create Playlist with Loading State

```typescript
import { usePlaylistMutations } from '@/hook/query';
import { useState } from 'react';

export function CreatePlaylist({ userId, songId }: Props) {
  const [name, setName] = useState('');
  const { createPlaylistMutation } = usePlaylistMutations();

  const handleCreate = () => {
    createPlaylistMutation.mutate(
      { userId, playlistName: name, songId },
      {
        onSuccess: () => {
          setName('');
          alert('Playlist created!');
        },
      }
    );
  };

  return (
    <div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Playlist name"
      />
      <button
        onClick={handleCreate}
        disabled={!name || createPlaylistMutation.isPending}
      >
        {createPlaylistMutation.isPending ? 'Creating...' : 'Create'}
      </button>
    </div>
  );
}
```

---

### Example 4: Display User's Playlists

```typescript
import { useUserPlaylists } from '@/hook/query';
import { useUser } from '@clerk/nextjs';

export function MyPlaylists() {
  const { user } = useUser();
  const { data, isLoading } = useUserPlaylists(user?.id || '', !!user);

  if (!user) return <div>Please log in</div>;
  if (isLoading) return <div>Loading playlists...</div>;

  return (
    <div>
      <h2>My Playlists</h2>
      {data?.data?.map((playlist) => (
        <div key={playlist.id}>
          <h3>{playlist.name}</h3>
          <p>{playlist.playlistSongs.length} songs</p>
        </div>
      ))}
    </div>
  );
}
```

---

### Example 5: Upload Song with Progress

```typescript
import { useSongMutations } from '@/hook/query';
import { useState } from 'react';

export function UploadSong() {
  const [file, setFile] = useState<File | null>(null);
  const { uploadSongMutation } = useSongMutations();

  const handleUpload = () => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    uploadSongMutation.mutate(formData, {
      onSuccess: () => {
        setFile(null);
        alert('Song uploaded!');
      },
      onError: (error) => {
        alert('Upload failed: ' + error.message);
      },
    });
  };

  return (
    <div>
      <input
        type="file"
        accept="audio/*"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <button
        onClick={handleUpload}
        disabled={!file || uploadSongMutation.isPending}
      >
        {uploadSongMutation.isPending ? 'Uploading...' : 'Upload Song'}
      </button>
      {uploadSongMutation.isPending && <div>Progress: Uploading...</div>}
    </div>
  );
}
```

---

## Query Keys

All query keys are exported for manual cache manipulation:

```typescript
import { SONG_KEYS, PLAYLIST_KEYS } from '@/hook/query';

// Song keys
SONG_KEYS.all; // ['songs']
SONG_KEYS.liked(userId); // ['songs', 'liked', userId]

// Playlist keys
PLAYLIST_KEYS.all; // ['playlists']
PLAYLIST_KEYS.user(userId); // ['playlists', 'user', userId]
PLAYLIST_KEYS.detail(playlistId); // ['playlists', 'detail', playlistId]
```

**Manual Cache Invalidation:**

```typescript
import { useQueryClient } from '@tanstack/react-query';
import { SONG_KEYS } from '@/hook/query';

const queryClient = useQueryClient();

// Invalidate all songs
queryClient.invalidateQueries({ queryKey: SONG_KEYS.all });

// Invalidate specific user's liked songs
queryClient.invalidateQueries({ queryKey: SONG_KEYS.liked('user123') });
```

---

## Best Practices

1. **Use Query Hooks in Components** - Always prefer query hooks over direct API hooks in components
2. **Enable/Disable Queries** - Use the `enabled` parameter to control when queries run
3. **Handle Loading States** - Always handle `isLoading` and `error` states
4. **Mutations with Callbacks** - Use `onSuccess` and `onError` callbacks for user feedback
5. **Type Safety** - Add proper TypeScript types for data structures
6. **Error Boundaries** - Wrap components with error boundaries for better UX

---

## Migration from Old Code

**Before:**

```typescript
const response = await axios.get('/api/get-songs');
const songs = response.data;
```

**After:**

```typescript
const { data: songs, isLoading, error } = useSongs();
```

This gives you:

- ✅ Automatic caching
- ✅ Loading states
- ✅ Error handling
- ✅ Background refetch
- ✅ Optimistic updates
- ✅ Request deduplication

---

## Dependencies

Make sure you have these packages installed:

```bash
npm install @tanstack/react-query axios @clerk/nextjs
```

And wrap your app with `QueryClientProvider`:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Your app */}
    </QueryClientProvider>
  );
}
```
