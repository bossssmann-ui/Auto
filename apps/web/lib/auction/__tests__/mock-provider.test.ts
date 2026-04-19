/**
 * Provider tests — exercises the mock against the real fixtures it ships
 * with so drift (e.g. a new lot that doesn't match the raw schema) fails CI
 * immediately.
 */

import { describe, expect, it } from "vitest";
import type { CalcParams, CalcResult } from "@auto/shared";

import { MockAuctionProvider } from "../providers/mock";
import { AuctionProviderError } from "../provider";
import { lotDetailSchema, lotSummarySchema } from "../schemas";

const fakeCalc = async (params: CalcParams): Promise<CalcResult> => {
  if (params.vehicleType === "special" || params.vehicleType === "special_vehicle") {
    return { success: false, requireHuman: true, message: "special" };
  }
  if (params.vehicleType === "moto" && params.priceJPY > 600_000) {
    return { success: false, requireHuman: true, message: "moto" };
  }
  return {
    success: true,
    japanTotalRub: params.priceJPY,
    freightRub: 200_000,
    customsDutyRub: 100_000,
    utilFeeRub: 5200,
    fixedFeesRub: 80_000,
    finalTotalRub: Math.round(params.priceJPY * 1.5),
    sanctioned: false,
    appliedRates: { JPY: 0.66, USD: 95, EUR: 103 },
  };
};

function makeProvider() {
  return new MockAuctionProvider({ calculate: fakeCalc });
}

describe("MockAuctionProvider — taxonomy", () => {
  it("listBrands returns parsed fixture brands", async () => {
    const provider = makeProvider();
    const brands = await provider.listBrands();
    expect(brands.length).toBeGreaterThan(0);
    const toyota = brands.find((b) => b.slug === "toyota");
    expect(toyota?.modelCount).toBeGreaterThan(0);
  });

  it("listModels throws not_found for unknown brand", async () => {
    const provider = makeProvider();
    await expect(provider.listModels("ferrari")).rejects.toThrowError(AuctionProviderError);
  });

  it("listGenerations returns the fixture generations", async () => {
    const provider = makeProvider();
    const gens = await provider.listGenerations("toyota", "harrier");
    expect(gens.map((g) => g.slug)).toContain("xu80");
  });
});

describe("MockAuctionProvider — searchLots", () => {
  it("returns validated view-models and paginates", async () => {
    const provider = makeProvider();
    const result = await provider.searchLots({ page: 1, pageSize: 5 });
    expect(result.items).toHaveLength(5);
    expect(result.total).toBeGreaterThan(5);

    for (const item of result.items) {
      expect(lotSummarySchema.safeParse(item).success).toBe(true);
    }
  });

  it("filters by brand and fuelType", async () => {
    const provider = makeProvider();
    const result = await provider.searchLots({
      brand: "toyota",
      fuelType: "hybrid",
      pageSize: 30,
    });
    expect(result.items.length).toBeGreaterThan(0);
    for (const item of result.items) {
      expect(item.brandSlug).toBe("toyota");
      expect(item.fuelType).toBe("hybrid");
    }
  });

  it("sorts by price_asc", async () => {
    const provider = makeProvider();
    const result = await provider.searchLots({ sort: "price_asc", pageSize: 30 });
    const prices = result.items.map((i) => i.auctionPriceJpy);
    const sorted = [...prices].sort((a, b) => a - b);
    expect(prices).toEqual(sorted);
  });

  it("rejects invalid search params with a validation error", async () => {
    const provider = makeProvider();
    await expect(
      // @ts-expect-error — intentionally invalid input for the test.
      provider.searchLots({ pageSize: -1 }),
    ).rejects.toThrowError(AuctionProviderError);
  });

  it("surfaces operator-required lots with priceRangeRub=null", async () => {
    const provider = makeProvider();
    // Request the flagged page size big enough to include all fixtures.
    const result = await provider.searchLots({ pageSize: 60 });
    const flagged = result.items.filter((i) => i.requiresOperator);
    expect(flagged.length).toBeGreaterThan(0);
    for (const f of flagged) {
      expect(f.priceRangeRub).toBeNull();
      expect(f.operatorReason).not.toBeNull();
    }
  });
});

describe("MockAuctionProvider — getLot", () => {
  it("returns null (not throws) when the id is unknown", async () => {
    const provider = makeProvider();
    const result = await provider.getLot("does-not-exist");
    expect(result).toBeNull();
  });

  it("returns a validated LotDetail for a known id", async () => {
    const provider = makeProvider();
    const result = await provider.getLot("uss-tokyo-442290");
    expect(result).not.toBeNull();
    if (!result) return;
    expect(lotDetailSchema.safeParse(result).success).toBe(true);
    expect(result.brandSlug).toBe("honda");
    expect(result.modelSlug).toBe("vezel");
    expect(result.requiresOperator).toBe(false);
  });

  it("flags the require_human fixture lot as operator-required", async () => {
    const provider = makeProvider();
    const result = await provider.getLot("flagged-special-forklift-001");
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.requiresOperator).toBe(true);
    expect(result.priceRangeRub).toBeNull();
    expect(result.operatorReason).toMatch(/оператор/i);
  });
});

describe("MockAuctionProvider — iterators", () => {
  it("listAllLotIds yields every lot id", async () => {
    const provider = makeProvider();
    const ids: string[] = [];
    for await (const id of provider.listAllLotIds()) ids.push(id);
    // Deduplicate defensively — fixtures should already be unique.
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThan(15);
  });

  it("listAllCategoryPaths yields brand, brand+model, brand+model+generation tuples", async () => {
    const provider = makeProvider();
    const paths: Array<{ brand: string; model?: string; generation?: string }> = [];
    for await (const p of provider.listAllCategoryPaths()) paths.push(p);

    const brandOnly = paths.filter((p) => !p.model);
    const modelLevel = paths.filter((p) => p.model && !p.generation);
    const genLevel = paths.filter((p) => p.generation);
    expect(brandOnly.length).toBeGreaterThan(0);
    expect(modelLevel.length).toBeGreaterThan(0);
    expect(genLevel.length).toBeGreaterThan(0);
  });
});
