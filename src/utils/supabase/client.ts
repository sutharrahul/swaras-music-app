import { createBrowserClient } from '@supabase/ssr';

import type { Database } from '@/lib/database.types';

/**
 * Supabase client for browser / 'use client' code.
 *
 * Uses the publishable key, which is public by design: it carries no privileges
 * of its own and every request it makes is filtered by Row Level Security. The
 * secret key must never reach this file, directly or transitively.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
