/**
 * HTTP JSON-feed provider — the production data source for the catalog.
 *
 * The feed is two static JSON documents served from `AUCTION_API_BASE_URL`:
 *
 *   GET {baseUrl}/brands.json — array matching `rawBrandListSchema`
 *   GET {baseUrl}/lots.json   — array matching `rawLotListSchema`
 *
 * The format is identical to the bundled fixtures in `../fixtures/`, so the
 * owner can manage the catalog with any tool that produces JSON (hand-edited
 * file on the VPS, S3 object, export from a sheet/CRM). See
 * `apps/web/lib/auction/README.md` for the contract and examples.
 *
 * Behavior:
 *   - the snapshot is cached in-process for `AUCTION_FEED_TTL_MS` (default
 *     5 min) with in-flight dedupe, mirroring the CBR-rates cache pattern;
 *   - fetch failures fall back to the last good snapshot (stale-if-error);
 *   - with no snapshot at all, a clear `AuctionProviderError` is thrown:
 *     `timeout` / `upstream` / `validation` — never a cryptic crash.
 */

import type {
  Brand,
  Generation,
  LotDetail,
  LotListItem,
  LotSearchParams,
  Model,
  Paginated,
} from "../domain";
import { AuctionProviderError, type AuctionProvider } from "../provider";
import { rawBrandListSchema, rawLotListSchema } from "../schemas";
import { InMemoryAuctionProvider, type CalculateFn } from "./in-memory";

export const DEFAULT_FEED_TTL_MS = 5 * 60 * 1_000;
export const FEED_FETCH_TIMEOUT_MS = 10_000;

export interface HttpProviderOptions {
  baseUrl: string;
  /** Optional override so tests / staging can inject a mock fetch. */
  fetchImpl?: typeof fetch;
  /** Snapshot freshness window; default 5 minutes. */
  ttlMs?: number;
  /** Passed through to the shared in-memory engine. */
  calculate?: CalculateFn;
}

export class HttpAuctionProvider implements AuctionProvider {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly ttlMs: number;
  private readonly calculate?: CalculateFn;

  private snapshot: { catalog: InMemoryAuctionProvider; fetchedAt: number } | null =
    null;
  private inFlight: Promise<InMemoryAuctionProvider> | null = null;

  constructor(opts: HttpProviderOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.ttlMs = opts.ttlMs ?? DEFAULT_FEED_TTL_MS;
    this.calculate = opts.calculate;
  }

  // -------------------------------------------------------------------------
  // Feed loading
  // -------------------------------------------------------------------------

  private async fetchJson(path: string): Promise<unknown> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        signal: AbortSignal.timeout(FEED_FETCH_TIMEOUT_MS),
      });
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "TimeoutError";
      throw new AuctionProviderError(
        timedOut ? "timeout" : "upstream",
        `Auction feed ${path} is unreachable at ${this.baseUrl}: ${
          err instanceof Error ? err.message : String(err)
        }. Check AUCTION_API_BASE_URL or switch AUCTION_PROVIDER=mock.`,
        { cause: err },
      );
    }
    if (!res.ok) {
      throw new AuctionProviderError(
        "upstream",
        `Auction feed ${path} responded ${res.status} at ${this.baseUrl}. ` +
          "Check AUCTION_API_BASE_URL or switch AUCTION_PROVIDER=mock.",
      );
    }
    try {
      return await res.json();
    } catch (err) {
      throw new AuctionProviderError(
        "validation",
        `Auction feed ${path} is not valid JSON.`,
        { cause: err },
      );
    }
  }

  private async loadCatalog(): Promise<InMemoryAuctionProvider> {
    const [brandsJson, lotsJson] = await Promise.all([
      this.fetchJson("/brands.json"),
      this.fetchJson("/lots.json"),
    ]);

    const brands = rawBrandListSchema.safeParse(brandsJson);
    if (!brands.success) {
      throw new AuctionProviderError(
        "validation",
        `Auction feed brands.json failed schema validation: ${brands.error.message}`,
        { cause: brands.error },
      );
    }
    const lots = rawLotListSchema.safeParse(lotsJson);
    if (!lots.success) {
      throw new AuctionProviderError(
        "validation",
        `Auction feed lots.json failed schema validation: ${lots.error.message}`,
        { cause: lots.error },
      );
    }

    return new InMemoryAuctionProvider(brands.data, lots.data, this.calculate);
  }

  private async catalog(): Promise<InMemoryAuctionProvider> {
    if (this.snapshot && Date.now() - this.snapshot.fetchedAt < this.ttlMs) {
      return this.snapshot.catalog;
    }

    if (!this.inFlight) {
      this.inFlight = this.loadCatalog().finally(() => {
        this.inFlight = null;
      });
    }

    try {
      const catalog = await this.inFlight;
      this.snapshot = { catalog, fetchedAt: Date.now() };
      return catalog;
    } catch (err) {
      // Stale-if-error: keep serving the last good snapshot instead of
      // taking the whole catalog down because one refresh failed.
      if (this.snapshot) return this.snapshot.catalog;
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // AuctionProvider surface — thin delegation to the snapshot engine
  // -------------------------------------------------------------------------

  async listBrands(): Promise<Brand[]> {
    return (await this.catalog()).listBrands();
  }

  async listModels(brandSlug: string): Promise<Model[]> {
    return (await this.catalog()).listModels(brandSlug);
  }

  async listGenerations(brandSlug: string, modelSlug: string): Promise<Generation[]> {
    return (await this.catalog()).listGenerations(brandSlug, modelSlug);
  }

  async searchLots(params: LotSearchParams): Promise<Paginated<LotListItem>> {
    return (await this.catalog()).searchLots(params);
  }

  async getLot(id: string): Promise<LotDetail | null> {
    return (await this.catalog()).getLot(id);
  }

  async *listAllLotIds(): AsyncIterable<string> {
    yield* (await this.catalog()).listAllLotIds();
  }

  async *listAllCategoryPaths(): AsyncIterable<{
    brand: string;
    model?: string;
    generation?: string;
  }> {
    yield* (await this.catalog()).listAllCategoryPaths();
  }
}
