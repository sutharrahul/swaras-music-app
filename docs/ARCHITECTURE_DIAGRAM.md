# Architecture Diagram

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         COMPONENTS                              │
│  (SongDashboard, PlaylistManager, YourComponent)               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ Import & Use
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                    TANSTACK QUERY HOOKS                         │
│                    (src/hook/query/)                            │
│                                                                 │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │ useSongQueries  │  │ usePlaylistQuer. │  │ useAdminQuer. │ │
│  │                 │  │                  │  │               │ │
│  │ • useSongs      │  │ • useUserPlaylist│  │ • deleteSong  │ │
│  │ • useLikedSongs │  │ • usePlaylist    │  │   Mutation    │ │
│  │ • useSongMutat. │  │ • usePlaylistMut │  │               │ │
│  └─────────────────┘  └──────────────────┘  └───────────────┘ │
│                                                                 │
│  Features:                                                      │
│  • Caching (5min/3min stale time)                             │
│  • Automatic cache invalidation                               │
│  • Loading & error states                                     │
│  • Optimistic updates                                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ Calls
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                      API HOOKS                                  │
│                    (src/hook/apiHooks/)                         │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ useSongApi  │  │ usePlaylist  │  │ useAdminApi  │          │
│  │             │  │ Api          │  │              │          │
│  │ • getSongs  │  │ • getUserPlay│  │ • deleteSong │          │
│  │ • uploadSong│  │ • getPlaylist│  │              │          │
│  │ • likeSong  │  │ • createPlay │  │              │          │
│  │ • unlikeSong│  │ • addSongTo  │  │              │          │
│  │ • getLiked  │  │ • deletePl   │  │              │          │
│  └─────────────┘  └──────────────┘  └──────────────┘          │
│                                                                 │
│                    Uses: useApiClient                           │
│                    • get, post, patch, del                      │
│                    • Clerk Authentication                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ HTTP Requests
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                     API ROUTES                                  │
│                    (src/app/api/)                               │
│                                                                 │
│  GET    /api/get-songs                                         │
│  POST   /api/upload-song                                       │
│  POST   /api/like-song                                         │
│  DELETE /api/like-song                                         │
│  GET    /api/get-liked-songs?userId=                           │
│  GET    /api/get-playlist?userId= | ?playlistId=               │
│  POST   /api/post-playlist                                     │
│  DELETE /api/delete-playlist                                   │
│  DELETE /api/remove-playlist-song                              │
│  DELETE /api/admin/delete-song                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ Prisma Queries
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                       DATABASE                                  │
│                     (PostgreSQL)                                │
│                                                                 │
│  Tables: User, Song, Like, Playlist, PlaylistSong              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Usage Flow

```
┌──────────────────────────────────────────────────────────────┐
│  Component: SongList.tsx                                     │
│                                                              │
│  import { useSongs } from '@/hook/query';                   │
│                                                              │
│  const { data, isLoading } = useSongs();                    │
│                                                              │
│  if (isLoading) return <Loading />;                         │
│  return <SongList songs={data} />;                          │
└──────────────────────────────────────────────────────────────┘
                         │
                         │ TanStack Query manages:
                         │ • Cache
                         │ • Refetch
                         │ • Loading states
                         ↓
┌──────────────────────────────────────────────────────────────┐
│  useSongs() Query Hook                                       │
│                                                              │
│  • queryKey: ['songs']                                      │
│  • queryFn: getSongs()  ←── Calls useSongApi               │
│  • staleTime: 5 minutes                                     │
│                                                              │
│  Cache Status:                                              │
│  • FRESH (< 5min): Returns cached data                     │
│  • STALE (> 5min): Refetches in background                 │
└──────────────────────────────────────────────────────────────┘
                         │
                         ↓
┌──────────────────────────────────────────────────────────────┐
│  useSongApi().getSongs()                                     │
│                                                              │
│  const response = await get('/api/get-songs');              │
│  return response.data;                                       │
└──────────────────────────────────────────────────────────────┘
                         │
                         ↓
                    API Response
```

---

## Mutation Flow with Cache Invalidation

```
User clicks "Like Song"
         │
         ↓
┌──────────────────────────────────────────────────────────────┐
│  Component                                                   │
│                                                              │
│  const { likeSongMutation } = useSongMutations();           │
│                                                              │
│  likeSongMutation.mutate({ userId, songId });               │
└──────────────────────────────────────────────────────────────┘
         │
         ↓
┌──────────────────────────────────────────────────────────────┐
│  likeSongMutation                                            │
│                                                              │
│  mutationFn: likeSong(data)  ←── Calls useSongApi          │
│                                                              │
│  onSuccess: (data, variables) => {                          │
│    ✅ Invalidate songs cache                                │
│    ✅ Invalidate liked songs cache                          │
│  }                                                           │
└──────────────────────────────────────────────────────────────┘
         │
         ↓
┌──────────────────────────────────────────────────────────────┐
│  useSongApi().likeSong()                                     │
│                                                              │
│  POST /api/like-song                                        │
│  Body: { userId, songId }                                   │
└──────────────────────────────────────────────────────────────┘
         │
         ↓
┌──────────────────────────────────────────────────────────────┐
│  Cache Invalidation                                          │
│                                                              │
│  queryClient.invalidateQueries(['songs'])                   │
│  queryClient.invalidateQueries(['songs','liked',userId])    │
│                                                              │
│  → All components using these queries re-fetch fresh data   │
└──────────────────────────────────────────────────────────────┘
```

---

## File Organization

```
src/
├── hook/
│   ├── apiHooks/              ← Low-level API calls
│   │   ├── index.ts           ← Export all API hooks
│   │   ├── useApiClient.ts    ← Base HTTP client
│   │   ├── useSongApi.ts      ← Song endpoints
│   │   ├── usePlaylistApi.ts  ← Playlist endpoints
│   │   └── useAdminApi.ts     ← Admin endpoints
│   │
│   └── query/                 ← TanStack Query layer
│       ├── index.ts           ← Export all query hooks
│       ├── useSongQueries.ts  ← Song queries + mutations
│       ├── usePlaylistQueries.ts ← Playlist queries + mutations
│       └── useAdminQueries.ts ← Admin mutations
│
├── components/
│   └── examples/
│       ├── SongDashboard.tsx      ← Example usage
│       └── PlaylistManager.tsx    ← Example usage
│
└── app/
    └── api/                   ← Next.js API routes
        ├── get-songs/
        ├── upload-song/
        ├── like-song/
        └── ...
```

---

## Query Key Structure

```
SONG_KEYS = {
  all: ['songs']
  liked: (userId) => ['songs', 'liked', userId]
}

PLAYLIST_KEYS = {
  all: ['playlists']
  user: (userId) => ['playlists', 'user', userId]
  detail: (playlistId) => ['playlists', 'detail', playlistId]
}

Example:
  ['songs']                          → All songs
  ['songs', 'liked', 'user123']      → User's liked songs
  ['playlists', 'user', 'user123']   → User's playlists
  ['playlists', 'detail', 'pl456']   → Specific playlist
```

---

## Benefits Visualization

```
WITHOUT TanStack Query:
┌─────────────────────────────────────────────────────────────┐
│ Component                                                   │
│ • Manual useState for data                                 │
│ • Manual useState for loading                              │
│ • Manual useState for error                                │
│ • Manual useEffect for fetching                            │
│ • Manual cache management                                  │
│ • Manual refetch logic                                     │
│ • No request deduplication                                 │
│ • Manual loading states                                    │
└─────────────────────────────────────────────────────────────┘
   ❌ 50+ lines of boilerplate code


WITH TanStack Query:
┌─────────────────────────────────────────────────────────────┐
│ Component                                                   │
│                                                             │
│ const { data, isLoading, error } = useSongs();             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
   ✅ 1 line, automatic everything!
```
