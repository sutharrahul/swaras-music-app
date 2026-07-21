import type { NextConfig } from 'next';

/**
 * Cover art is served from the public Supabase Storage bucket, so the optimizer
 * has to be told that host is allowed. The pattern is derived from
 * NEXT_PUBLIC_SUPABASE_URL rather than hardcoded, because the project ref is
 * environment-specific and a stale literal here fails as a silently broken image
 * rather than a build error.
 *
 * `pathname` is pinned to the public object route: this permits exactly the
 * covers and nothing else on the same host — not the auth endpoints, not
 * PostgREST, not signed URLs (which the optimizer must never cache anyway,
 * since they expire).
 *
 * If NEXT_PUBLIC_SUPABASE_URL is absent at BUILD time the list is empty and
 * remote images are refused. That is the intended failure: an unconfigured build
 * should not quietly proxy arbitrary hosts.
 */
const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHostname
      ? [
          {
            protocol: 'https',
            hostname: supabaseHostname,
            pathname: '/storage/v1/object/public/**',
          },
        ]
      : [],
  },
};

export default nextConfig;
