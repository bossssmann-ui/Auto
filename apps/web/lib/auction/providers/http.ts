/**
 * HTTP provider stub. Real implementation arrives when the upstream auction
 * API is available; until then every method throws `not_implemented` so we
 * fail loud if someone accidentally sets `AUCTION_PROVIDER=http` in dev.
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

export interface HttpProviderOptions {
  baseUrl: string;
  /** Optional override so tests / staging can inject a mock fetch. */
  fetchImpl?: typeof fetch;
}

export class HttpAuctionProvider implements AuctionProvider {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: HttpProviderOptions) {
    this.baseUrl = opts.baseUrl;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private notImplemented(method: string): never {
    // Reference the stored config once so TS doesn't flag these as unused
    // while the real HTTP client is still a stub. They'll power `fetch` calls
    // in Phase 7 when the upstream API is ready.
    void this.baseUrl;
    void this.fetchImpl;
    throw new AuctionProviderError(
      "not_implemented",
      `HttpAuctionProvider.${method} is not implemented yet. Set AUCTION_PROVIDER=mock.`,
    );
  }

  listBrands(): Promise<Brand[]> {
    this.notImplemented("listBrands");
  }
  listModels(brandSlug: string): Promise<Model[]> {
    void brandSlug;
    this.notImplemented("listModels");
  }
  listGenerations(brandSlug: string, modelSlug: string): Promise<Generation[]> {
    void brandSlug;
    void modelSlug;
    this.notImplemented("listGenerations");
  }
  searchLots(params: LotSearchParams): Promise<Paginated<LotListItem>> {
    void params;
    this.notImplemented("searchLots");
  }
  getLot(id: string): Promise<LotDetail | null> {
    void id;
    this.notImplemented("getLot");
  }
  async *listAllLotIds(): AsyncIterable<string> {
    this.notImplemented("listAllLotIds");
  }
  async *listAllCategoryPaths(): AsyncIterable<{
    brand: string;
    model?: string;
    generation?: string;
  }> {
    this.notImplemented("listAllCategoryPaths");
  }
}
