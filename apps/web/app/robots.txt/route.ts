/**
 * GET /robots.txt — plain-text robots with Yandex directives.
 *
 * Replaces the previous `app/robots.ts` metadata route: Next's
 * `MetadataRoute.Robots` cannot emit `Clean-param`, which we need so Yandex
 * collapses `/catalog` filter/pagination query duplicates. Built as a route
 * handler (single source, no static-file conflict) so the Sitemap URL always
 * derives from `SITE_URL`.
 */

import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";

export function GET(): Response {
  const body = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /og

Clean-param: page&fuelType&ageWindow&brand /catalog

Sitemap: ${SITE_URL}/sitemap.xml
`;

  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
