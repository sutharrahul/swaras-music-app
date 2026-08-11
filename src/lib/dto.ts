/**
 * The wire shape the API emits, and the mapping from PostgREST rows onto it.
 *
 * Why this file exists: Prisma's `@map` hid the fact that the columns are
 * snake_case while its client handed back camelCase, so the whole frontend reads
 * `song.audioUrl`, `song._count.likes`, `playlist.playlistSongs`. supabase-js
 * does no such mapping — a row is `audio_url`. Renaming the fields through every
 * component is task #14; until then the gap is closed here, in one place, so the
 * handlers stay the only thing that changed.
 *
 * The column lists are explicit on purpose. `select('*')` on `songs` would put
 * `uploaded_by_user_id` back on a public endpoint, which is most of bug 5.
 */

import type { Tables } from '@/lib/database.types';
import type { ServerClient } from '@/lib/auth';
import { coverUrl } from '@/lib/storage';
import { signAudioUrls } from '@/lib/storage.server';

/**
 * Note what is absent: `uploaded_by_user_id`, and any join onto `users`. Every
 * uploader is an admin, so the old `uploadedBy: { id, email, … }` published
 * admin email addresses to anonymous visitors.
 *
 * `audio_path` / `cover_path` replaced `audio_url` / `cover_url` when Cloudinary
 * went. The columns hold Storage object paths, and the URLs on the wire are
 * derived from them per request — signed for audio (private bucket), a plain
 * public URL for covers.
 */
export const SONG_COLUMNS =
  'id, title, duration, audio_path, artist, composers, album, movie, genre, cover_path, lyrics, created_at, updated_at';

type SongRow = Pick<
  Tables<'songs'>,
  | 'id'
  | 'title'
  | 'duration'
  | 'audio_path'
  | 'artist'
  | 'composers'
  | 'album'
  | 'movie'
  | 'genre'
  | 'cover_path'
  | 'lyrics'
  | 'created_at'
  | 'updated_at'
>;

export type SongDto = {
  id: string;
  title: string;
  duration: number;
  /**
   * Null only when signing genuinely failed — a `songs` row whose Storage object
   * is missing, or the Storage API erroring. NOT the anonymous case: anonymous
   * visitors get working URLs, because listening is public. Consumers must still
   * treat it as optional, and must say so rather than mounting a dead player.
   */
  audioUrl: string | null;
  artist: string[];
  composers: string[];
  album: string | null;
  movie: string | null;
  genre: string | null;
  coverUrl: string | null;
  lyrics: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { likes: number };
};

function toSongDto(row: SongRow, likes: number, audioUrl: string | null): SongDto {
  return {
    id: row.id,
    title: row.title,
    duration: row.duration,
    audioUrl,
    artist: row.artist,
    composers: row.composers,
    album: row.album,
    movie: row.movie,
    genre: row.genre,
    coverUrl: coverUrl(row.cover_path),
    lyrics: row.lyrics,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    _count: { likes },
  };
}

/**
 * Like counts for a page of songs.
 *
 * This cannot be an embedded `likes(count)`: `public.likes` is under an
 * owner-only RLS policy, so an embedded aggregate counts only the caller's own
 * likes and would render 0 for everyone else. `song_like_counts` is a
 * SECURITY DEFINER function that returns nothing but `(song_id, count)` — the
 * aggregate was already public in this UI; the individual rows stay private.
 *
 * Returns an empty map on failure: a missing like count degrades a badge, and
 * that is not worth failing the whole request over.
 */
export async function likeCounts(
  supabase: ServerClient,
  songIds: string[]
): Promise<Map<string, number>> {
  if (songIds.length === 0) return new Map();

  const { data, error } = await supabase.rpc('song_like_counts', { p_song_ids: songIds });

  if (error) {
    console.error('Failed to load like counts:', error);
    return new Map();
  }

  return new Map(data.map(row => [row.song_id, Number(row.like_count)]));
}

/**
 * Map a page of song rows: like counts and signed playback URLs, one extra
 * round-trip each for the whole page rather than one per song.
 *
 * Signed for every caller, anonymous included: browsing and listening are both
 * public, exactly as they were before Storage replaced Cloudinary. What the
 * private bucket buys is issuance control and expiry, not secrecy — see
 * `storage.server.ts`.
 *
 * Any handler that returns the result of this MUST be `private, no-store`. The
 * signed audio URLs carry an expiry, so a shared cache would keep serving a
 * token that is already part-spent.
 */
export async function toSongDtos(supabase: ServerClient, rows: SongRow[]): Promise<SongDto[]> {
  const [counts, audioUrls] = await Promise.all([
    likeCounts(
      supabase,
      rows.map(row => row.id)
    ),
    signAudioUrls(rows.map(row => row.audio_path)),
  ]);

  return rows.map(row =>
    toSongDto(row, counts.get(row.id) ?? 0, audioUrls.get(row.audio_path) ?? null)
  );
}

/**
 * Artists.
 *
 * `public.artists` is a PROFILE side-table keyed by `name` — it carries the
 * photo and nothing else the app reads. Which songs belong to an artist is
 * still answered by `songs.artist text[]`, via the `artist_song_counts()`
 * aggregate. There is no FK between the two, so an artist with no row here is
 * the normal case, not an error: it just has no photo.
 */
export const ARTIST_COLUMNS = 'name, bio, image_path';

export type ArtistDto = {
  name: string;
  songCount: number;
  /** Null when the artist has no `artists` row, or has one with no photo. Both are normal. */
  imageUrl: string | null;
};

/**
 * Photos for a page of artist names — one round-trip for the whole page rather
 * than one per artist. Same shape as `likeCounts()` above, and the same reason.
 *
 * Returns an empty map on failure rather than throwing: a missing photo degrades
 * a card to its placeholder glyph, which is not worth failing a listing over.
 * That also means this survives `image_path` not existing yet — unlike
 * `SONG_COLUMNS`, which took the whole app down when it named a column the
 * database did not have (see the `movie` comment at the top of this file).
 */
export async function artistImagePaths(
  supabase: ServerClient,
  names: string[]
): Promise<Map<string, string | null>> {
  if (names.length === 0) return new Map();

  const { data, error } = await supabase.from('artists').select(ARTIST_COLUMNS).in('name', names);

  if (error) {
    console.error('Failed to load artist photos:', error);
    return new Map();
  }

  return new Map((data ?? []).map(row => [row.name, row.image_path]));
}

/**
 * Albums, derived from `songs.album` by `album_song_counts()`.
 *
 * No profile side-table and no `artistImagePaths` equivalent: an album's artwork
 * is one of its songs' covers, which the aggregate already returns, so there is
 * nothing to merge in and nothing that can drift.
 */
export type AlbumDto = {
  name: string;
  songCount: number;
  /** The newest song artwork in the album, or null when none of them have any. */
  coverUrl: string | null;
};

export const PLAYLIST_COLUMNS = 'id, name, description, created_at, updated_at';

type PlaylistRow = Pick<
  Tables<'playlists'>,
  'id' | 'name' | 'description' | 'created_at' | 'updated_at'
>;

export type PlaylistSummaryDto = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { playlistSongs: number };
};

export function toPlaylistSummaryDto(row: PlaylistRow, songCount: number): PlaylistSummaryDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    _count: { playlistSongs: songCount },
  };
}
