/**
 * GET /sitemap.xml — sitemap INDEX (P3-09).
 *
 * Search engines start here (robots.txt points at this URL) and discover
 * every shard emitted by `app/sitemap.ts` (`/sitemap/{id}.xml`). Next's
 * `generateSitemaps()` produces the shards but no index — this route fills
 * that gap so sharding scales to thousands of lots without robots changes.
 */

import { SITE_URL } from "@/lib/seo";
import { countSitemapShards } from "@/lib/sitemap-shards";

export const dynamic = "force-static";

export async function GET(): Promise<Response> {
  const shards = await countSitemapShards();
  const now = new Date().toISOString();

  const items = Array.from({ length: shards }, (_, id) =>
    [
      "  <sitemap>",
      `    <loc>${SITE_URL}/sitemap/${id}.xml</loc>`,
      `    <lastmod>${now}</lastmod>`,
      "  </sitemap>",
    ].join("\n"),
  ).join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</sitemapindex>
`;

  return new Response(body, {
    status: 200,
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}
