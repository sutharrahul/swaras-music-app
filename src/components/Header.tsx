'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import Image from 'next/image';
import { Search, Music, List, Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import axios from 'axios';
import { useSong } from '@/context/SongContextProvider';
import { useSupabaseUser } from '@/hooks/useSupabaseUser';
import UserMenu from '@/components/auth/UserMenu';
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

const LISTBOX_ID = 'search-results-listbox';
const optionId = (index: number) => `search-option-${index}`;

export default function Header() {
  const router = useRouter();
  const { playSong } = useSong();
  const { user } = useSupabaseUser();
  const isSignedIn = Boolean(user);
  const { useCheckAdmin } = useUserQueries();
  const { data: adminData } = useCheckAdmin(isSignedIn);
  const isAdmin = adminData?.data?.isAdmin || false;

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
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

  const songs = searchResults?.songs.slice(0, 5) ?? [];
  const playlists = searchResults?.playlists.slice(0, 5) ?? [];
  // One flat list so arrow keys walk both groups in visual order.
  const options = [
    ...songs.map(song => ({ kind: 'song' as const, id: song.id })),
    ...playlists.map(playlist => ({ kind: 'playlist' as const, id: playlist.id })),
  ];

  // A stale active index would point at nothing once results change.
  useEffect(() => {
    setActiveIndex(-1);
  }, [searchResults]);

  const closeResults = () => {
    setShowResults(false);
    setActiveIndex(-1);
  };

  const handleSongClick = (songId: string) => {
    playSong(songId);
    closeResults();
    setSearchQuery('');
  };

  const handlePlaylistClick = (playlistId: string) => {
    router.push(`/playlist/${playlistId}`);
    closeResults();
    setSearchQuery('');
  };

  const selectOption = (index: number) => {
    const option = options[index];
    if (!option) return;
    if (option.kind === 'song') {
      handleSongClick(option.id);
    } else {
      handlePlaylistClick(option.id);
    }
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      closeResults();
      return;
    }

    if (!showResults || options.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex(prev => (prev + 1) % options.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex(prev => (prev <= 0 ? options.length - 1 : prev - 1));
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      selectOption(activeIndex);
    }
  };

  const optionClasses = (index: number) =>
    `w-full flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 rounded-md transition-colors ${
      activeIndex === index ? 'bg-secondary' : 'hover:bg-secondary'
    }`;

  return (
    <header className="fixed top-0 right-0 left-0 md:left-64 z-40 bg-brand-fade backdrop-blur-sm border-b border-brand/10">
      <div className="flex items-center justify-between gap-2 px-2 sm:px-4 md:px-8 py-3 md:py-4 ml-12 md:ml-0">
        {/* Search Bar */}
        <div className="flex-1 max-w-xs sm:max-w-md md:max-w-2xl relative" ref={searchRef}>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 sm:w-5 sm:h-5"
            />
            <Input
              type="text"
              role="combobox"
              aria-label="Search songs and playlists"
              aria-expanded={showResults}
              aria-controls={LISTBOX_ID}
              aria-autocomplete="list"
              aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
              placeholder="Search..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full pl-8 sm:pl-10 pr-2 sm:pr-4 py-1.5 sm:py-2 text-sm sm:text-base bg-secondary dark:bg-secondary border-border text-white placeholder:text-muted-foreground"
            />
          </div>

          {/* Search Results Dropdown */}
          {showResults && searchResults && (
            <div
              id={LISTBOX_ID}
              role="listbox"
              aria-label="Search results"
              className="absolute top-full mt-2 w-full sm:w-auto sm:min-w-[400px] right-0 sm:right-auto bg-card border border-border rounded-lg shadow-2xl max-h-[60vh] sm:max-h-[70vh] overflow-y-auto z-30"
            >
              {/* Songs Results */}
              {songs.length > 0 && (
                <div className="p-2 sm:p-3">
                  <h3 className="text-xs sm:text-sm font-semibold text-muted-foreground mb-1.5 sm:mb-2 flex items-center gap-1.5 sm:gap-2">
                    <Music aria-hidden="true" className="w-3 h-3 sm:w-4 sm:h-4" />
                    Songs
                  </h3>
                  {songs.map((song, index) => (
                    <button
                      key={song.id}
                      type="button"
                      id={optionId(index)}
                      role="option"
                      aria-selected={activeIndex === index}
                      tabIndex={-1}
                      onClick={() => handleSongClick(song.id)}
                      className={optionClasses(index)}
                    >
                      <Image
                        src={song.coverUrl || '/assets/songicon.png'}
                        alt=""
                        width={40}
                        height={40}
                        className="w-8 h-8 sm:w-10 sm:h-10 rounded object-cover flex-shrink-0"
                      />
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-white text-xs sm:text-sm font-medium truncate">
                          {song.title}
                        </p>
                        <p className="text-muted-foreground text-[10px] sm:text-xs truncate">
                          {song.artist.join(', ')}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Playlists Results */}
              {playlists.length > 0 && (
                <div className="p-2 sm:p-3 border-t border-border">
                  <h3 className="text-xs sm:text-sm font-semibold text-muted-foreground mb-1.5 sm:mb-2 flex items-center gap-1.5 sm:gap-2">
                    <List aria-hidden="true" className="w-3 h-3 sm:w-4 sm:h-4" />
                    Playlists
                  </h3>
                  {playlists.map((playlist, index) => (
                    <button
                      key={playlist.id}
                      type="button"
                      id={optionId(songs.length + index)}
                      role="option"
                      aria-selected={activeIndex === songs.length + index}
                      tabIndex={-1}
                      onClick={() => handlePlaylistClick(playlist.id)}
                      className={optionClasses(songs.length + index)}
                    >
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded bg-brand-gradient flex items-center justify-center flex-shrink-0">
                        <List aria-hidden="true" className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-white text-xs sm:text-sm font-medium truncate">
                          {playlist.name}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* No Results */}
              {songs.length === 0 && playlists.length === 0 && (
                <div className="p-4 sm:p-6 text-center text-muted-foreground">
                  <Search
                    aria-hidden="true"
                    className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-2 opacity-50"
                  />
                  <p className="text-xs sm:text-sm">
                    No results found for &quot;{searchQuery}&quot;
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Loading State */}
          {isSearching && (
            <div
              role="status"
              className="absolute top-full mt-2 w-full sm:w-auto sm:min-w-[400px] right-0 sm:right-auto bg-card border border-border rounded-lg p-3 sm:p-4 text-center text-muted-foreground text-sm"
            >
              Searching...
            </div>
          )}
        </div>

        {/* Right side - User Actions */}
        <div className="ml-1 sm:ml-2 md:ml-4 flex items-center gap-1.5 sm:gap-2 md:gap-3 flex-shrink-0">
          {isSignedIn && isAdmin && (
            <button
              onClick={() => router.push('/admin/upload-song')}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 bg-primary hover:bg-brand-hover text-white rounded-lg transition-colors font-medium text-xs sm:text-sm"
            >
              <Upload aria-hidden="true" className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Upload</span>
              <span className="sr-only sm:hidden">Upload songs</span>
            </button>
          )}

          <UserMenu />
        </div>
      </div>
    </header>
  );
}
