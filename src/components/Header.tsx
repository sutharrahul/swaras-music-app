'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Search, Music, List, Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import axios from 'axios';
import { useSong } from '@/context/SongContextProvider';
import { useUser, UserButton } from '@clerk/nextjs';
import Auth from './Auth';
import { useUserQueries } from '@/hook/query';

interface SearchResult {
  songs: Array<{
    id: string;
    title: string;
    artist: string[];
    coverUrl?: string;
  }>;
  playlists: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
}

export default function Header() {
  const router = useRouter();
  const { playSong } = useSong();
  const { isSignedIn } = useUser();
  const { useCheckAdmin } = useUserQueries();
  const { data: adminData } = useCheckAdmin();
  const isAdmin = adminData?.data?.isAdmin || false;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setShowResults(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { data } = await axios.get(`/api/search?q=${encodeURIComponent(searchQuery)}`);
        if (data?.success) {
          setSearchResults(data.data);
          setShowResults(true);
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSongClick = (songId: string) => {
    playSong(songId);
    setShowResults(false);
    setSearchQuery('');
  };

  const handlePlaylistClick = (playlistId: string) => {
    router.push(`/playlist/${playlistId}`);
    setShowResults(false);
    setSearchQuery('');
  };

  return (
    <header className="fixed top-0 right-0 left-0 md:left-64 z-40 bg-gradient-to-b from-[#1a0000] to-transparent backdrop-blur-sm border-b border-[#B40000]/10">
      <div className="flex items-center justify-between px-4 md:px-8 py-4 ml-12 md:ml-0">
        {/* Search Bar */}
        <div className="flex-1 max-w-2xl relative" ref={searchRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Search songs or playlists..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#262626] border-gray-700 text-white placeholder:text-gray-400 focus:border-[#B40000] focus:ring-[#B40000]"
            />
          </div>

          {/* Search Results Dropdown */}
          {showResults && searchResults && (
            <div className="absolute top-full mt-2 w-full bg-[#1a1a1a] border border-gray-700 rounded-lg shadow-2xl max-h-[70vh] overflow-y-auto z-30">
              {/* Songs Results */}
              {searchResults.songs.length > 0 && (
                <div className="p-3">
                  <h3 className="text-sm font-semibold text-gray-400 mb-2 flex items-center gap-2">
                    <Music className="w-4 h-4" />
                    Songs
                  </h3>
                  {searchResults.songs.slice(0, 5).map(song => (
                    <button
                      key={song.id}
                      onClick={() => handleSongClick(song.id)}
                      className="w-full flex items-center gap-3 p-2 hover:bg-[#262626] rounded-md transition-colors"
                    >
                      {song.coverUrl ? (
                        <img
                          src={song.coverUrl}
                          alt={song.title}
                          className="w-10 h-10 rounded object-cover"
                        />
                      ) : (
                        <img
                          src="/assets/songicon.png"
                          alt={song.title}
                          className="w-10 h-10 rounded object-cover"
                        />
                      )}
                      <div className="flex-1 text-left">
                        <p className="text-white text-sm font-medium truncate">{song.title}</p>
                        <p className="text-gray-400 text-xs truncate">{song.artist.join(', ')}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Playlists Results */}
              {searchResults.playlists.length > 0 && (
                <div className="p-3 border-t border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-400 mb-2 flex items-center gap-2">
                    <List className="w-4 h-4" />
                    Playlists
                  </h3>
                  {searchResults.playlists.slice(0, 5).map(playlist => (
                    <button
                      key={playlist.id}
                      onClick={() => handlePlaylistClick(playlist.id)}
                      className="w-full flex items-center gap-3 p-2 hover:bg-[#262626] rounded-md transition-colors"
                    >
                      <div className="w-10 h-10 rounded bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                        <List className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-white text-sm font-medium truncate">{playlist.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* No Results */}
              {searchResults.songs.length === 0 && searchResults.playlists.length === 0 && (
                <div className="p-6 text-center text-gray-400">
                  <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No results found for &quot;{searchQuery}&quot;</p>
                </div>
              )}
            </div>
          )}

          {/* Loading State */}
          {isSearching && (
            <div className="absolute top-full mt-2 w-full bg-[#1a1a1a] border border-gray-700 rounded-lg p-4 text-center text-gray-400">
              Searching...
            </div>
          )}
        </div>

        {/* Right side - User Actions */}
        <div className="ml-4 flex items-center gap-3">
          {isSignedIn && isAdmin && (
            <button
              onClick={() => router.push('/admin/upload-song')}
              className="flex items-center gap-2 px-4 py-2 bg-[#B40000] hover:bg-[#900000] text-white rounded-lg transition-colors font-medium"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Upload Songs</span>
            </button>
          )}
          
          {isSignedIn ? (
            <UserButton 
              appearance={{
                elements: {
                  avatarBox: 'w-9 h-9'
                }
              }}
            />
          ) : (
            <>
             <Auth/>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
