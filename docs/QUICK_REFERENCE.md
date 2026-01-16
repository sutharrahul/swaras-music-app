# API Hooks Quick Reference

## 🚀 Quick Import

```typescript
// Import query hooks (recommended)
import {
  useSongs,
  useLikedSongs,
  useSongMutations,
  useUserPlaylists,
  usePlaylist,
  usePlaylistMutations,
  useAdminMutations,
} from '@/hook/query';
```

---

## 📖 Queries (Read Data)

### Songs

```typescript
// Get all songs
const { data, isLoading, error } = useSongs();

// Get user's liked songs
const { data, isLoading } = useLikedSongs(userId);
const { data, isLoading } = useLikedSongs(userId, false); // Disabled
```

### Playlists

```typescript
// Get user's playlists
const { data, isLoading } = useUserPlaylists(userId);

// Get specific playlist
const { data, isLoading } = usePlaylist(playlistId);
```

---

## ✏️ Mutations (Write Data)

### Song Mutations

```typescript
const { uploadSongMutation, likeSongMutation, unlikeSongMutation } = useSongMutations();

// Upload song
const formData = new FormData();
formData.append('file', file);
uploadSongMutation.mutate(formData);

// Like song
likeSongMutation.mutate({ userId, songId });

// Unlike song
unlikeSongMutation.mutate({ userId, songId });
```

### Playlist Mutations

```typescript
const {
  createPlaylistMutation,
  addSongToPlaylistMutation,
  deletePlaylistMutation,
  removeSongFromPlaylistMutation,
} = usePlaylistMutations();

// Create playlist
createPlaylistMutation.mutate({
  userId,
  playlistName: 'My Favorites',
  songId,
});

// Add song to playlist
addSongToPlaylistMutation.mutate({ playlistId, songId });

// Delete playlist
deletePlaylistMutation.mutate({ playlistId, userId });

// Remove song from playlist
removeSongFromPlaylistMutation.mutate({ playlistId, songId });
```

### Admin Mutations

```typescript
const { deleteSongMutation } = useAdminMutations();

// Delete song (admin only)
deleteSongMutation.mutate(songId);
```

---

## 💡 Common Patterns

### Pattern: Query with Callbacks

```typescript
const { data, isLoading, error, refetch } = useSongs();

if (isLoading) return <Loading />;
if (error) return <Error message={error.message} />;
if (!data?.data) return <Empty />;

return <List items={data.data} />;
```

### Pattern: Mutation with Callbacks

```typescript
mutation.mutate(data, {
  onSuccess: response => {
    console.log('Success!', response);
  },
  onError: error => {
    console.error('Failed:', error);
  },
});
```

### Pattern: Mutation with Loading State

```typescript
const { uploadSongMutation } = useSongMutations();

<button
  onClick={handleUpload}
  disabled={uploadSongMutation.isPending}
>
  {uploadSongMutation.isPending ? 'Uploading...' : 'Upload'}
</button>
```

### Pattern: Conditional Query

```typescript
// Only fetch if userId exists
const { data } = useUserPlaylists(userId, !!userId);

// Only fetch if enabled
const { data } = usePlaylist(playlistId, isModalOpen);
```

---

## 🎯 Response Structure

All API responses follow this structure:

```typescript
{
  success: boolean;
  message: string;
  data: any; // Your actual data
  statusCode: number;
}
```

Access data: `response.data.data` or `data?.data` from query

---

## 🔑 Query Keys

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

---

## 🔄 Manual Cache Control

```typescript
import { useQueryClient } from '@tanstack/react-query';
import { SONG_KEYS } from '@/hook/query';

const queryClient = useQueryClient();

// Invalidate (refetch)
queryClient.invalidateQueries({ queryKey: SONG_KEYS.all });

// Set data manually
queryClient.setQueryData(SONG_KEYS.all, newData);

// Get cached data
const cachedSongs = queryClient.getQueryData(SONG_KEYS.all);

// Remove from cache
queryClient.removeQueries({ queryKey: SONG_KEYS.all });
```

---

## ⚙️ Configuration Options

### Query Options

```typescript
useSongs({
  staleTime: 1000 * 60 * 5, // 5 minutes
  cacheTime: 1000 * 60 * 10, // 10 minutes
  refetchOnWindowFocus: true, // Refetch on focus
  refetchOnMount: true, // Refetch on mount
  retry: 3, // Retry failed requests
  enabled: true, // Enable/disable query
});
```

### Mutation Options

```typescript
mutation.mutate(data, {
  onSuccess: data => {},
  onError: error => {},
  onSettled: (data, error) => {}, // Runs after success or error
  onMutate: variables => {}, // Runs before mutation
});
```

---

## 🐛 Error Handling

```typescript
const { data, error, isError } = useSongs();

if (isError) {
  console.error(error);
  return <ErrorBoundary error={error} />;
}
```

### Mutation Error Handling

```typescript
mutation.mutate(data, {
  onError: (error: any) => {
    if (error.response?.status === 401) {
      // Unauthorized
    } else if (error.response?.status === 404) {
      // Not found
    } else {
      // Other errors
    }
  },
});
```

---

## 📊 Loading States

```typescript
const { isLoading, isFetching, isPending } = useSongs();

// isLoading: First time fetching
// isFetching: Refetching (background)
// isPending: Mutation is in progress

if (isLoading) return <Skeleton />;
if (isFetching) return <div>Updating... <Content /></div>;
```

---

## 🎨 TypeScript Types

```typescript
// Song type
interface Song {
  id: string;
  title: string;
  uploadedBy: User;
  _count: { likes: number };
  // ... other fields
}

// Playlist type
interface Playlist {
  id: string;
  name: string;
  userId: string;
  playlistSongs: PlaylistSong[];
  // ... other fields
}

// Use with queries
const { data } = useSongs();
const songs: Song[] = data?.data || [];
```

---

## 📱 Full Component Example

```typescript
'use client';

import { useSongs, useSongMutations } from '@/hook/query';
import { useUser } from '@clerk/nextjs';

export default function SongPage() {
  const { user } = useUser();
  const { data, isLoading, error } = useSongs();
  const { likeSongMutation } = useSongMutations();

  const handleLike = (songId: string) => {
    if (!user) return;
    likeSongMutation.mutate({ userId: user.id, songId });
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {data?.data?.map((song) => (
        <div key={song.id}>
          <h3>{song.title}</h3>
          <button
            onClick={() => handleLike(song.id)}
            disabled={likeSongMutation.isPending}
          >
            Like
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

## 🔗 Useful Links

- Full Documentation: `docs/API_HOOKS_GUIDE.md`
- Architecture: `docs/ARCHITECTURE_DIAGRAM.md`
- Examples: `src/components/examples/`
- TanStack Query Docs: https://tanstack.com/query/latest

---

## ⚡ Pro Tips

1. **Use Query Hooks in Components** - Not API hooks
2. **Enable/Disable Queries** - Control when queries run
3. **Invalidate Smart** - Target specific query keys
4. **Handle All States** - Loading, error, empty
5. **Use Callbacks** - For side effects after mutations
6. **Type Everything** - Better DX with TypeScript
7. **Check isPending** - Disable buttons during mutations
8. **Use Optimistic Updates** - For better UX (advanced)

---

## 🎯 Decision Tree: Which Hook to Use?

```
Need to fetch data?
├─ Yes → Use Query Hook (useSongs, useUserPlaylists, etc.)
│   ├─ Need to control when it runs?
│   │   └─ Use `enabled` parameter
│   └─ Need to refetch manually?
│       └─ Call `refetch()` from query result
│
└─ Need to modify data?
    └─ Use Mutation Hook (useSongMutations, usePlaylistMutations)
        ├─ Need success/error feedback?
        │   └─ Use onSuccess/onError callbacks
        └─ Need loading state?
            └─ Check `isPending` property
```
