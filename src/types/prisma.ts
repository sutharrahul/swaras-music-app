// Type definitions for Prisma models
// These types are generated from the Prisma schema

import {
  Song as PrismaSong,
  User as PrismaUser,
  Playlist as PrismaPlaylist,
  Like as PrismaLike,
  PlaylistSong as PrismaPlaylistSong,
} from '../../generated/prisma';

// Export Prisma types
export type Song = PrismaSong;
export type User = PrismaUser;
export type Playlist = PrismaPlaylist;
export type Like = PrismaLike;
export type PlaylistSong = PrismaPlaylistSong;

// Extended types with relations
export type SongWithRelations = Song & {
  uploadedBy?: User;
  likes?: Like[];
  playlistSongs?: PlaylistSong[];
  _count?: {
    likes: number;
  };
};

export type PlaylistWithRelations = Playlist & {
  user?: User;
  playlistSongs?: (PlaylistSong & {
    song?: Song;
  })[];
};

export type LikeWithRelations = Like & {
  user?: User;
  song?: SongWithRelations;
};

export type UserWithRelations = User & {
  uploadedSongs?: Song[];
  playlists?: Playlist[];
  likes?: Like[];
};
