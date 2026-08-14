'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import Image from 'next/image';
import { Search, Music, List, Upload, X } from 'lucide-react';
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
  const pathname = usePathname();
  // `/admin` has its own search box (Manage Songs) and its own Upload tab —
  // showing the global song search and the Upload shortcut here too just
  // duplicates them on screen.
  const isAdminPage = pathname.startsWith('/admin');
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
  // Below `sm` the field collapses to a magnifier; there is not room for a text
  // input, the Admin shortcut and the avatar on a phone at once.
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const wasSearchOpenRef = useRef(false);

  // Opening the collapsed field should put the caret in it — otherwise the tap
  // that opened it is wasted and a second one is needed to start typing.
  useEffect(() => {
    if (isSearchOpen) {
      inputRef.current?.focus();
      wasSearchOpenRef.current = true;
      // The debounce keys off `searchQuery`, which has not changed, so nothing
      // would re-fetch — the field would reopen holding text with no
      // suggestions under it until the next keystroke.
      if (searchQuery.trim() && searchResults) setShowResults(true);
      return;
    }
    // Closing unmounts the input, and focus would otherwise fall to <body> —
    // a keyboard user would have to Tab from the top of the page to get back.
    // Hand it to the magnifier that took the field's place. Guarded so it only
    // fires after a real open, never on first mount.
    if (wasSearchOpenRef.current) {
      wasSearchOpenRef.current = false;
      searchButtonRef.current?.focus();
    }
    // `searchQuery` and `searchResults` are read only at the instant the field
    // opens; listing them would re-run this on every keystroke and steal focus
    // back mid-typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSearchOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const insideWidget =
        searchRef.current?.contains(target) || searchButtonRef.current?.contains(target);
      if (insideWidget) return;

      setShowResults(false);
      // Collapse unconditionally, not only when the query is empty. Keeping the
      // field open just because text remained also kept the Admin shortcut and
      // user menu at display:none long after the search was visually over — the
      // exact state `handleSongClick` already collapses to avoid. The text is
      // NOT discarded: it is restored, with its results, on reopening.
      setIsSearchOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchQuery]);

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
    // Also collapse on mobile: leaving the field expanded kept the Admin
    // shortcut and user menu hidden after the search was already over.
    setIsSearchOpen(false);
  };

  const handlePlaylistClick = (playlistId: string) => {
    router.push(`/playlist/${playlistId}`);
    closeResults();
    setSearchQuery('');
    setIsSearchOpen(false);
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
      if (showResults) {
        closeResults();
      } else {
        setSearchQuery('');
        setIsSearchOpen(false);
      }
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
    // `h-header` and an OPAQUE background, not the old fade + blur.
    //
    // The scroll container reserves `--header-height` (5rem) of padding for this
    // bar, but the bar only measured 69px, so an 11px strip of reserved space
    // sat below it with nothing covering it — and because the old background was
    // a gradient to transparent, scrolled content ghosted through both that
    // strip and the bar's own lower half. Pinning the height to the same token
    // the padding uses makes the two agree by construction, and a solid fill
    // means nothing shows through.
    <header className="fixed top-0 right-0 left-0 md:left-64 z-40 h-header bg-background border-b border-border">
      {/* `h-full` + centring instead of vertical padding: the height now comes
          from the header itself, so padding would only fight it. */}
      <div className="flex h-full items-center justify-between gap-2 px-2 sm:px-4 md:px-8 ml-12 md:ml-0">
        {/* Search Bar — hidden on /admin, which has its own (Manage Songs) search */}
        {!isAdminPage && !isSearchOpen && (
          // Phones only. From `sm` up the real field is always on screen, so
          // this never renders there and there is no duplicate control.
          <button
            type="button"
            ref={searchButtonRef}
            onClick={() => setIsSearchOpen(true)}
            aria-label="Open search"
            className="flex size-10 flex-shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary sm:hidden"
          >
            <Search aria-hidden="true" className="size-6" />
          </button>
        )}

        {!isAdminPage && (
          <div
            ref={searchRef}
            className={`relative flex-1 sm:block sm:max-w-md md:max-w-2xl ${
              isSearchOpen ? 'max-w-none' : 'hidden max-w-xs'
            }`}
          >
            <div className="relative">
              <Search
                aria-hidden="true"
                className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 sm:w-5 sm:h-5"
              />
              <Input
                ref={inputRef}
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
                className={`w-full pl-8 sm:pl-10 py-1.5 sm:py-2 text-sm sm:text-base bg-secondary border-border text-foreground placeholder:text-muted-foreground ${
                  isSearchOpen ? 'pr-9 sm:pr-4' : 'pr-2 sm:pr-4'
                }`}
              />
              {isSearchOpen && (
                // Collapses the field again. `sm:hidden` because from `sm` up
                // the field is permanent and there is nothing to collapse to.
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    closeResults();
                    setIsSearchOpen(false);
                  }}
                  aria-label="Close search"
                  className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background sm:hidden"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              )}
            </div>

            {/* Search Results Dropdown */}
            {showResults && searchResults && (
              <div
                id={LISTBOX_ID}
                role="listbox"
                aria-label="Search results"
                className="absolute top-full left-0 mt-2 w-full bg-card border border-border rounded-lg shadow-2xl max-h-[60vh] sm:max-h-[70vh] overflow-y-auto z-30"
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
                          <p className="text-foreground text-xs sm:text-sm font-medium truncate">
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
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded bg-primary flex items-center justify-center flex-shrink-0">
                          <List
                            aria-hidden="true"
                            className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground"
                          />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className="text-foreground text-xs sm:text-sm font-medium truncate">
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
                className="absolute top-full left-0 mt-2 w-full bg-card border border-border rounded-lg p-3 sm:p-4 text-center text-muted-foreground text-sm"
              >
                Searching...
              </div>
            )}
          </div>
        )}

        {/* Right side - User Actions */}
        <div
          className={`ml-auto items-center gap-1.5 sm:gap-2 md:gap-3 flex-shrink-0 sm:flex ${
            isSearchOpen ? 'hidden' : 'flex'
          }`}
        >
          {isSignedIn && isAdmin && !isAdminPage && (
            <button
              onClick={() => router.push('/admin?tab=upload')}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors font-medium text-xs sm:text-sm"
            >
              <Upload aria-hidden="true" className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Admin</span>
              <span className="sr-only sm:hidden">Admin panel</span>
            </button>
          )}

          <UserMenu />
        </div>
      </div>
    </header>
  );
}
