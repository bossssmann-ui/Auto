/**
 * Shared sitemap sharding math (P3-09).
 *
 * Shard 0 — static pages, geo pages, catalog taxonomy.
 * Shards 1..N — lots, `LOTS_PER_SITEMAP` per shard (protocol limit is
 * 50 000 URLs / 50 MB per file; we stay under it with headroom).
 *
 * While the catalog runs on mock fixtures, lot URLs are excluded entirely
 * (P2-02: fixture lots must not reach the index), so there is exactly one
 * shard. The same code scales to thousands of lots once the real feed is
 * configured — no rewrite needed.
 */

import { isMockCatalog, listAllLotIds } from "@/lib/auction";

export const LOTS_PER_SITEMAP = 45_000;

export async function collectSitemapLotIds(): Promise<string[]> {
  if (isMockCatalog()) return [];
  const ids: string[] = [];
  for await (const id of listAllLotIds()) ids.push(id);
  return ids;
}

/** Total shard count: 1 (static/taxonomy) + lot shards. */
export async function countSitemapShards(): Promise<number> {
  const lotIds = await collectSitemapLotIds();
  return 1 + Math.ceil(lotIds.length / LOTS_PER_SITEMAP);
}
