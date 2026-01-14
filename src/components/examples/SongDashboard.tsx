/**
 * Example Component: Song Management Dashboard
 *
 * This component demonstrates how to use the TanStack Query hooks
 * for managing songs in the Swaras Music App.
 */

'use client';

import { useSongs, useSongMutations } from '@/hook/query';
import { useUser } from '@clerk/nextjs';
import { useState } from 'react';

export default function SongDashboard() {
  const { user } = useUser();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Query: Fetch all songs
  const { data: songsResponse, isLoading, error } = useSongs();

  // Mutations: Upload, Like, Unlike songs
  const { uploadSongMutation, likeSongMutation, unlikeSongMutation } = useSongMutations();

  // Handle file upload
  const handleUpload = () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('file', selectedFile);

    uploadSongMutation.mutate(formData, {
      onSuccess: () => {
        setSelectedFile(null);
        alert('Song uploaded successfully!');
      },
      onError: (error: any) => {
        alert(`Upload failed: ${error.message}`);
      },
    });
  };

  // Handle like/unlike toggle
  const handleLikeToggle = (songId: string, isLiked: boolean) => {
    if (!user) return;

    const mutation = isLiked ? unlikeSongMutation : likeSongMutation;
    mutation.mutate(
      { userId: user.id, songId },
      {
        onError: (error: any) => {
          alert(`Failed: ${error.message}`);
        },
      }
    );
  };

  // Loading state
  if (isLoading) {
    return <div className="p-4">Loading songs...</div>;
  }

  // Error state
  if (error) {
    return <div className="p-4 text-red-500">Error: {error.message}</div>;
  }

  const songs = songsResponse?.data || [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Song Dashboard</h1>

      {/* Upload Section */}
      {user && (
        <div className="mb-8 p-4 bg-gray-100 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Upload Song</h2>
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept="audio/*"
              onChange={e => setSelectedFile(e.target.files?.[0] || null)}
              className="flex-1"
            />
            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploadSongMutation.isPending}
              className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-400"
            >
              {uploadSongMutation.isPending ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>
      )}

      {/* Songs List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">All Songs ({songs.length})</h2>
        {songs.map((song: any) => (
          <div key={song.id} className="p-4 border rounded-lg flex justify-between items-center">
            <div>
              <h3 className="font-semibold">{song.title}</h3>
              <p className="text-sm text-gray-600">
                {song.uploadedBy?.firstName} {song.uploadedBy?.lastName}
              </p>
              <p className="text-xs text-gray-500">{song._count?.likes || 0} likes</p>
            </div>

            {user && (
              <button
                onClick={() => handleLikeToggle(song.id, false)} // You'd check if actually liked
                disabled={likeSongMutation.isPending || unlikeSongMutation.isPending}
                className="px-4 py-2 bg-pink-500 text-white rounded disabled:bg-gray-400"
              >
                {likeSongMutation.isPending || unlikeSongMutation.isPending ? '...' : '♥ Like'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
