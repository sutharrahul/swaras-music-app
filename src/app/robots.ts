import type { MetadataRoute } from 'next';

/**
 * Everything public is crawlable; admin and account pages are not, matching
 * the same split `src/utils/supabase/middleware.ts` enforces for real access.
 * This is guidance for well-behaved crawlers only — it is not a security
 * boundary, since the middleware already denies those paths outright.
 *
 * No `sitemap` entry: there is no sitemap.xml route. Pointing at one that
 * 404s is worse than omitting the field.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/'],
    },
  };
}
