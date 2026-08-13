'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const THEME_STORAGE_KEY = 'swaras-theme';

/**
 * Flips the `dark` class on <html>, which is what every colour token in
 * `globals.css` keys off.
 *
 * The class is applied by a blocking script in `layout.tsx` before first paint,
 * NOT here — a `useEffect` runs after hydration, so a dark-mode user would get a
 * full cream page for a frame first. This component only owns the toggle and
 * keeps its icon in step with whatever that script decided.
 *
 * `mounted` guards the first render: the server has no way to know the stored
 * preference, so rendering the real icon immediately would mean the server said
 * "sun" while the client said "moon" — a hydration mismatch. Until mount, the
 * button renders as an empty box of the same size, so nothing shifts.
 */
export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
    setMounted(true);
  }, []);

  const toggle = () => {
    const next = !isDark;
    document.documentElement.classList.toggle('dark', next);
    setIsDark(next);
    // Wrapped: Safari in private mode throws on write, and a failed *save* is
    // no reason to leave the theme itself unchanged for this session.
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light');
    } catch {
      // Preference just won't survive a reload.
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mounted ? `Switch to ${isDark ? 'light' : 'dark'} mode` : 'Switch theme'}
      aria-pressed={mounted ? isDark : undefined}
      className="flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary"
    >
      {mounted &&
        (isDark ? (
          <Sun aria-hidden="true" className="size-5" />
        ) : (
          <Moon aria-hidden="true" className="size-5" />
        ))}
    </button>
  );
}
