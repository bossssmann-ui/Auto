/**
 * Shared in-memory catalog engine.
 *
 * Both concrete providers use it:
 *   - `MockAuctionProvider` feeds it the bundled fixtures;
 *   - `HttpAuctionProvider` feeds it a validated snapshot fetched from the
 *     remote JSON feed.
 *
 * Filtering / sorting / mapping logic lives here exactly once, so a provider
 * swap can never change catalog semantics.
 */

import type {
  Brand,
  Generation,
  LotDetail,
  LotListItem,
  LotSearchParams,
  LotSearchParamsParsed,
  Model,
  Paginated,
  RawBrand,
  RawLot,
} from "../domain";
import { mapLotDetail, mapLotSummary } from "../mappers";
import { AuctionProviderError, type AuctionProvider } from "../provider";
import { lotSearchParamsSchema } from "../schemas";

export type CalculateFn = NonNullable<
  Parameters<typeof mapLotSummary>[1]
>["calculate"];

export class InMemoryAuctionProvider implements AuctionProvider {
  protected readonly brands: RawBrand[];
  protected readonly lots: RawLot[];
  protected readonly calculate?: CalculateFn;

  constructor(brands: RawBrand[], lots: RawLot[], calculate?: CalculateFn) {
    this.brands = brands;
    this.lots = lots;
    this.calculate = calculate;
  }

  // -------------------------------------------------------------------------
  // Taxonomy
  // -------------------------------------------------------------------------

  async listBrands(): Promise<Brand[]> {
    return this.brands.map((b) => ({
      slug: b.slug,
      name: b.name,
      modelCount: b.models.length,
    }));
  }

  async listModels(brandSlug: string): Promise<Model[]> {
    const brand = this.brands.find((b) => b.slug === brandSlug);
    if (!brand) {
      throw new AuctionProviderError("not_found", `Brand "${brandSlug}" not found`);
    }
    return brand.models.map((m) => ({
      slug: m.slug,
      name: m.name,
      brandSlug: brand.slug,
      generationCount: m.generations.length,
    }));
  }

  async listGenerations(brandSlug: string, modelSlug: string): Promise<Generation[]> {
    const brand = this.brands.find((b) => b.slug === brandSlug);
    if (!brand) {
      throw new AuctionProviderError("not_found", `Brand "${brandSlug}" not found`);
    }
    const model = brand.models.find((m) => m.slug === modelSlug);
    if (!model) {
      throw new AuctionProviderError(
        "not_found",
        `Model "${modelSlug}" not found in brand "${brandSlug}"`,
      );
    }
    return model.generations.map((g) => ({
      slug: g.slug,
      name: g.name,
      brandSlug: brand.slug,
      modelSlug: model.slug,
      yearsFrom: g.years[0],
      yearsTo: g.years[1],
    }));
  }

  // -------------------------------------------------------------------------
  // Lots
  // -------------------------------------------------------------------------

  async searchLots(input: LotSearchParams): Promise<Paginated<LotListItem>> {
    const parsed = this.parseSearchParams(input);

    const matching = this.lots.filter((lot) => this.matches(lot, parsed));
    const sorted = this.sortLots(matching, parsed.sort);
    const total = sorted.length;

    const start = (parsed.page - 1) * parsed.pageSize;
    const end = start + parsed.pageSize;
    const page = sorted.slice(start, end);

    const items = await Promise.all(
      page.map((lot) => mapLotSummary(lot, { calculate: this.calculate })),
    );

    return { items, total, page: parsed.page, pageSize: parsed.pageSize };
  }

  async getLot(id: string): Promise<LotDetail | null> {
    const raw = this.lots.find((l) => l.lot_id === id);
    if (!raw) return null;
    return mapLotDetail(raw, { calculate: this.calculate });
  }

  async *listAllLotIds(): AsyncIterable<string> {
    for (const lot of this.lots) yield lot.lot_id;
  }

  async *listAllCategoryPaths(): AsyncIterable<{
    brand: string;
    model?: string;
    generation?: string;
  }> {
    for (const brand of this.brands) {
      yield { brand: brand.slug };
      for (const model of brand.models) {
        yield { brand: brand.slug, model: model.slug };
        for (const gen of model.generations) {
          yield { brand: brand.slug, model: model.slug, generation: gen.slug };
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private parseSearchParams(input: LotSearchParams): LotSearchParamsParsed {
    const result = lotSearchParamsSchema.safeParse(input);
    if (!result.success) {
      throw new AuctionProviderError(
        "validation",
        `Invalid search params: ${result.error.message}`,
        { cause: result.error },
      );
    }
    return result.data;
  }

  private matches(lot: RawLot, p: LotSearchParamsParsed): boolean {
    if (p.brand && lot.brand !== p.brand) return false;
    if (p.model && lot.model !== p.model) return false;
    if (p.generation && lot.generation !== p.generation) return false;
    if (p.fuelType && lot.fuel !== p.fuelType) return false;
    if (p.volumeCm3Min !== undefined && lot.engine_cc < p.volumeCm3Min) return false;
    if (p.volumeCm3Max !== undefined && lot.engine_cc > p.volumeCm3Max) return false;
    if (p.priceJpyMin !== undefined && lot.auction_price_jpy < p.priceJpyMin) return false;
    if (p.priceJpyMax !== undefined && lot.auction_price_jpy > p.priceJpyMax) return false;
    if (p.auctionGradeMin !== undefined) {
      if (lot.grade === undefined || lot.grade < p.auctionGradeMin) return false;
    }

    if (p.ageWindow) {
      const age = new Date().getFullYear() - lot.year;
      if (p.ageWindow === "non_passable_under3" && age >= 3) return false;
      if (p.ageWindow === "non_passable_over5" && age <= 5) return false;
      if (p.ageWindow === "passable" && (age < 3 || age > 5)) return false;
    }

    return true;
  }

  private sortLots(lots: RawLot[], sort: LotSearchParamsParsed["sort"]): RawLot[] {
    const copy = [...lots];
    switch (sort) {
      case "price_asc":
        return copy.sort((a, b) => a.auction_price_jpy - b.auction_price_jpy);
      case "price_desc":
        return copy.sort((a, b) => b.auction_price_jpy - a.auction_price_jpy);
      case "newest":
        return copy.sort((a, b) => b.year - a.year);
      case "ending_soon":
        return copy.sort((a, b) => {
          const da = a.auction_date ?? "";
          const db = b.auction_date ?? "";
          return da.localeCompare(db);
        });
    }
  }
}
