'use client';

import { useEffect } from 'react';

type MediaSessionTrack = {
  title?: string;
  artist?: string[];
  album?: string | null;
  coverUrl?: string | null;
} | null;

type UseMediaSessionOptions = {
  track: MediaSessionTrack;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onNextTrack: () => void;
  onPreviousTrack: () => void;
};

/**
 * Mirrors the current track into the OS media session, so lock screens,
 * notification shades and hardware media keys show the right song and can
 * control playback. Silently does nothing where the API is unavailable.
 */
export function useMediaSession({
  track,
  isPlaying,
  onPlay,
  onPause,
  onNextTrack,
  onPreviousTrack,
}: UseMediaSessionOptions) {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;

    if (!track) {
      session.metadata = null;
      return;
    }

    session.metadata = new MediaMetadata({
      title: track.title ?? 'Unknown title',
      artist: track.artist?.join(', ') ?? '',
      album: track.album ?? '',
      artwork: track.coverUrl ? [{ src: track.coverUrl }] : [],
    });
  }, [track]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const session = navigator.mediaSession;

    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ['play', onPlay],
      ['pause', onPause],
      ['nexttrack', onNextTrack],
      ['previoustrack', onPreviousTrack],
    ];

    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action, handler);
      } catch {
        // Not every browser supports every action.
      }
    }

    return () => {
      for (const [action] of handlers) {
        try {
          session.setActionHandler(action, null);
        } catch {
          // Ignore — nothing to clean up if it was never registered.
        }
      }
    };
  }, [onPlay, onPause, onNextTrack, onPreviousTrack]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);
}
