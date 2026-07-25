// Replaces the Prisma-generated model types that the UI used to import.
//
// IMPORTANT: these are API *wire* shapes, not database row shapes, and the two
// no longer agree. Prisma's `@map` hid the difference — the columns were
// snake_case but the client handed back camelCase, so the whole frontend reads
// `song.audioUrl`. supabase-js does no such mapping: PostgREST returns the raw
// column names, so a row is `audio_url`. See `Tables<'songs'>` in
// `@/lib/database.types` for the row shape.
//
// This file therefore describes what the endpoints under `src/app/api/**`
// currently put on the wire, which is what the components consume. Whoever
// rewrites those handlers onto supabase-js has to close the gap in one of two
// ways — map snake_case rows to this camelCase DTO inside the handler, or rename
// the fields all the way through the UI — and that decision is deliberately not
// made here.

export type Song = {
  id: string;
  title: string;
  duration: number;
  /**
   * A SIGNED, EXPIRING url, and null when the caller could not be given one —
   * in practice an anonymous visitor, because `song-audio` is a private bucket.
   * Browsing is public; streaming is not. Every consumer must handle null.
   */
  audioUrl: string | null;
  artist: string[];
  composers: string[];
  album: string | null;
  genre: string | null;
  /** Derived from the object path; `song-covers` is public, so this is stable. */
  coverUrl: string | null;
  lyrics: string | null;
  // Serialised over JSON, so a string here rather than the `Date` the Prisma
  // types claimed — that claim was already wrong on the client.
  createdAt: string;
  updatedAt: string;
};

export type User = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: 'USER' | 'ADMIN';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  profileImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SongWithRelations = Song & {
  uploadedBy?: User;
  _count?: {
    likes: number;
  };
};
