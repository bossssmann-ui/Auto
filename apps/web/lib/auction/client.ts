/**
 * Process-wide auction client.
 *
 * Rules:
 *   - Components NEVER import `process.env`. This module does.
 *   - `AUCTION_PROVIDER=mock` (default) selects the in-memory mock (bundled
 *     fixtures) — for local dev and tests.
 *   - `AUCTION_PROVIDER=http` + `AUCTION_API_BASE_URL` selects the JSON-feed
 *     provider — the production data source. Feed format is documented in
 *     `lib/auction/README.md`.
 *
 * Reads are wrapped in `unstable_cache` per §6.6 of the spec so identical
 * calls share cache entries within the SSR request. TTLs:
 *   - taxonomy (brands/models/generations): 1 h
 *   - lot searches / details:                5 min
 */

import { unstable_cache } from "next/cache";

import type {
  Brand,
  Generation,
  LotDetail,
  LotListItem,
  LotSearchParams,
  Model,
  Paginated,
} from "./domain";
import { AuctionProviderError, type AuctionProvider } from "./provider";
import { HttpAuctionProvider } from "./providers/http";
import { MockAuctionProvider } from "./providers/mock";

const TAXONOMY_TTL_SECONDS = 60 * 60;
const LOT_TTL_SECONDS = 5 * 60;

function createProvider(): AuctionProvider {
  const kind = (process.env.AUCTION_PROVIDER ?? "mock").toLowerCase();

  if (kind === "http") {
    const baseUrl = process.env.AUCTION_API_BASE_URL;
    if (!baseUrl) {
      throw new AuctionProviderError(
        "validation",
        "AUCTION_PROVIDER=http but AUCTION_API_BASE_URL is not set.",
      );
    }
    return new HttpAuctionProvider({ baseUrl });
  }

  if (kind !== "mock") {
    // Explicit opt-out: guard against typos silently falling back.
    throw new AuctionProviderError(
      "validation",
      `Unknown AUCTION_PROVIDER "${kind}". Expected "mock" or "http".`,
    );
  }

  return new MockAuctionProvider();
}

// Lazy singleton — avoids re-parsing the fixture JSON on every server render.
let providerSingleton: AuctionProvider | undefined;

function provider(): AuctionProvider {
  if (!providerSingleton) providerSingleton = createProvider();
  return providerSingleton;
}

// ---------------------------------------------------------------------------
// Cached public API
//
// `unstable_cache` requires a deterministic key array; we pass the string
// representations of each argument so hits are identical across renders.
// ---------------------------------------------------------------------------

export const listBrands = unstable_cache(
  async (): Promise<Brand[]> => provider().listBrands(),
  ["auction", "brands"],
  { revalidate: TAXONOMY_TTL_SECONDS, tags: ["auction:taxonomy"] },
);

export const listModels = unstable_cache(
  async (brandSlug: string): Promise<Model[]> => provider().listModels(brandSlug),
  ["auction", "models"],
  { revalidate: TAXONOMY_TTL_SECONDS, tags: ["auction:taxonomy"] },
);

export const listGenerations = unstable_cache(
  async (brandSlug: string, modelSlug: string): Promise<Generation[]> =>
    provider().listGenerations(brandSlug, modelSlug),
  ["auction", "generations"],
  { revalidate: TAXONOMY_TTL_SECONDS, tags: ["auction:taxonomy"] },
);

export const searchLots = unstable_cache(
  async (params: LotSearchParams): Promise<Paginated<LotListItem>> =>
    provider().searchLots(params),
  ["auction", "search-lots"],
  { revalidate: LOT_TTL_SECONDS, tags: ["auction:lots"] },
);

export const getLot = unstable_cache(
  async (id: string): Promise<LotDetail | null> => provider().getLot(id),
  ["auction", "lot"],
  { revalidate: LOT_TTL_SECONDS, tags: ["auction:lots"] },
);

// Iterators can't be cached by `unstable_cache` (it expects a serializable
// return). They're only used by `sitemap.ts` / `generateStaticParams`, both
// of which have their own caching at the Next.js layer.
export function listAllLotIds(): AsyncIterable<string> {
  return provider().listAllLotIds();
}

export function listAllCategoryPaths(): AsyncIterable<{
  brand: string;
  model?: string;
  generation?: string;
}> {
  return provider().listAllCategoryPaths();
}

/**
 * True while the catalog runs on bundled mock fixtures (no real feed).
 * SEO layers use this to keep fixture lots out of the index and the sitemap
 * (P3-09 / P2-02) until `AUCTION_PROVIDER=http` is configured.
 */
export function isMockCatalog(): boolean {
  return (process.env.AUCTION_PROVIDER ?? "mock").toLowerCase() !== "http";
}

/**
 * Test-only hook: reset the singleton between test files.
 * Not exported from the barrel.
 */
export function __resetAuctionClientForTests(): void {
  providerSingleton = undefined;
}
