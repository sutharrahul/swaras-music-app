'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogOut, User as UserIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSupabaseUser } from '@/hooks/useSupabaseUser';
import { createClient } from '@/utils/supabase/client';

/**
 * Replaces Clerk's `<UserButton>` and the old `Auth.tsx` sign-in/up buttons.
 *
 * `isLoaded` is checked before rendering anything so the header does not flash a
 * "Sign in" button at somebody who is already signed in — Clerk's component hid
 * that behind its own loading state and dropping it would have been a visible
 * regression.
 *
 * Which control is drawn is a *rendering* decision only. Nothing here authorizes
 * anything: the middleware and `requireUser()`/`requireAdmin()` decide that
 * again on the server, and RLS decides it once more in the database.
 */
export default function UserMenu() {
  const router = useRouter();
  const { user, isLoaded } = useSupabaseUser();
  const [signingOut, setSigningOut] = useState(false);

  if (!isLoaded) {
    // Same footprint as the avatar button, so the header does not shift.
    return <div aria-hidden="true" className="h-9 w-9 rounded-full bg-secondary" />;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Button asChild variant="ghost" size="sm" className="text-white hover:bg-secondary">
          <Link href="/sign-in">Sign in</Link>
        </Button>
        <Button asChild size="sm" className="bg-brand-gradient hover:bg-brand-gradient-hover">
          <Link href="/sign-up">Sign up</Link>
        </Button>
      </div>
    );
  }

  const handleSignOut = async () => {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    // refresh() re-runs the middleware and every Server Component with the
    // cleared cookies; without it the shell keeps its signed-in state until the
    // next navigation. push() first so a signed-out user is not left sitting on
    // a page the middleware would now bounce them off anyway.
    router.push('/');
    router.refresh();
  };

  const label = user.email ?? 'Account';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${label}`}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <UserIcon aria-hidden="true" className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
          {label}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={signingOut} onSelect={handleSignOut}>
          <LogOut aria-hidden="true" />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
