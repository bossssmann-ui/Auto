/**
 * GET /sitemap/{id}.xml — sitemap shards (P3-09).
 *
 * Shard 0 — static pages, geo pages, catalog taxonomy.
 * Shards 1..N — lots, 45k per file (excluded entirely while the catalog is
 * on mock fixtures — see `lib/sitemap-shards.ts`).
 *
 * Implemented as a route handler rather than the `app/sitemap.ts` metadata
 * convention: with `generateSitemaps()` the convention still claims
 * `/sitemap.xml`, which we need for the sitemap INDEX
 * (`app/sitemap.xml/route.ts`).
 */

import { notFound } from "next/navigation";
import { listAllCategoryPaths } from "@/lib/auction";
import { GEO_CITIES } from "@/lib/geo/cities";
import { SITE_URL } from "@/lib/seo";
import {
  LOTS_PER_SITEMAP,
  collectSitemapLotIds,
  countSitemapShards,
} from "@/lib/sitemap-shards";

export const dynamic = "force-static";

const STATIC_PATHS = [
  "",
  "/catalog",
  "/calculator",
  "/about",
  "/contacts",
  "/import-auto-japan",
  "/import-special-machinery",
  "/delivery",
  "/customs",
];

interface Entry {
  path: string;
  changeFrequency: "daily" | "weekly" | "monthly";
  priority: number;
}

export async function generateStaticParams(): Promise<Array<{ id: string }>> {
  const shards = await countSitemapShards();
  return Array.from({ length: shards }, (_, i) => ({ id: `${i}.xml` }));
}

async function shardEntries(shard: number): Promise<Entry[]> {
  if (shard === 0) {
    const entries: Entry[] = STATIC_PATHS.map((p) => ({
      path: p,
      changeFrequency: "weekly",
      priority: p === "" ? 1 : 0.7,
    }));
    for (const city of GEO_CITIES) {
      entries.push({
        path: `/avto-iz-yaponii/${city.slug}`,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
    for await (const path of listAllCategoryPaths()) {
      const parts = ["/catalog", path.brand];
      if (path.model) parts.push(path.model);
      if (path.generation) parts.push(path.generation);
      entries.push({ path: parts.join("/"), changeFrequency: "daily", priority: 0.6 });
    }
    return entries;
  }

  const lotIds = await collectSitemapLotIds();
  const start = (shard - 1) * LOTS_PER_SITEMAP;
  return lotIds.slice(start, start + LOTS_PER_SITEMAP).map((lotId) => ({
    path: `/lot/${lotId}`,
    changeFrequency: "daily",
    priority: 0.5,
  }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const match = /^(\d+)\.xml$/.exec(id);
  if (!match) notFound();
  const shard = Number(match[1]);

  const shards = await countSitemapShards();
  if (shard >= shards) notFound();

  const now = new Date().toISOString();
  const entries = await shardEntries(shard);

  const items = entries
    .map((e) =>
      [
        "  <url>",
        `    <loc>${SITE_URL}${e.path}</loc>`,
        `    <lastmod>${now}</lastmod>`,
        `    <changefreq>${e.changeFrequency}</changefreq>`,
        `    <priority>${e.priority}</priority>`,
        "  </url>",
      ].join("\n"),
    )
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</urlset>
`;

  return new Response(body, {
    status: 200,
    headers: { "content-type": "application/xml; charset=utf-8" },
  });
}
