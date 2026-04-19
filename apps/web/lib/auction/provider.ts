/**
 * `AuctionProvider` — the only thing page/component code should know about.
 *
 * Concrete providers (mock, http, …) implement this. `client.ts` picks one at
 * startup from env. Swapping providers is a one-line change in `client.ts`;
 * no page, component, or mapper touches a provider directly.
 */

import type {
  Brand,
  Generation,
  LotDetail,
  LotListItem,
  LotSearchParams,
  Model,
  Paginated,
} from "./domain";

export type AuctionErrorCode =
  | "not_found"
  | "upstream"
  | "timeout"
  | "validation"
  | "not_implemented";

export class AuctionProviderError extends Error {
  readonly code: AuctionErrorCode;
  constructor(code: AuctionErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AuctionProviderError";
    this.code = code;
  }
}

export interface AuctionProvider {
  listBrands(): Promise<Brand[]>;
  listModels(brandSlug: string): Promise<Model[]>;
  listGenerations(brandSlug: string, modelSlug: string): Promise<Generation[]>;

  searchLots(params: LotSearchParams): Promise<Paginated<LotListItem>>;
  /** Returns `null` when the id is syntactically valid but no lot exists. */
  getLot(id: string): Promise<LotDetail | null>;

  /** Used by `app/sitemap.ts`. Stream form so large catalogs don't blow memory. */
  listAllLotIds(): AsyncIterable<string>;
  listAllCategoryPaths(): AsyncIterable<{
    brand: string;
    model?: string;
    generation?: string;
  }>;
}
