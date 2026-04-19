/**
 * Schema tests — the raw and view-model contracts that every provider must
 * respect. These catch fixture drift and mapper bugs at CI time, not in the
 * UI.
 */

import { describe, expect, it } from "vitest";
import {
  lotSearchParamsSchema,
  lotSummarySchema,
  rawLotSchema,
} from "../schemas";

const validRaw = {
  lot_id: "uss-tokyo-1",
  auction: "USS Tokyo",
  brand: "toyota",
  model: "harrier",
  year: 2022,
  mileage_km: 28000,
  body_type: "suv",
  fuel: "hybrid",
  engine_cc: 2500,
  auction_price_jpy: 3650000,
  photos: ["/placeholder.svg"],
} as const;

describe("rawLotSchema", () => {
  it("accepts a fully-populated lot", () => {
    const result = rawLotSchema.safeParse(validRaw);
    expect(result.success).toBe(true);
  });

  it("accepts a partial lot (no mileage / trim / photos)", () => {
    const partial = {
      lot_id: "partial-1",
      auction: "USS Tokyo",
      brand: "honda",
      model: "fit",
      year: 2022,
      body_type: "hatchback",
      fuel: "hybrid",
      engine_cc: 1500,
      auction_price_jpy: 1520000,
    };
    const result = rawLotSchema.safeParse(partial);
    expect(result.success).toBe(true);
    // Defaults fill in for optional collections.
    if (result.success) {
      expect(result.data.photos).toEqual([]);
      expect(result.data.mileage_km).toBeUndefined();
    }
  });

  it("rejects an invalid brand slug (uppercase)", () => {
    const bad = { ...validRaw, brand: "Toyota" };
    const result = rawLotSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects a future year beyond 2100", () => {
    const bad = { ...validRaw, year: 2200 };
    const result = rawLotSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects a negative auction price", () => {
    const bad = { ...validRaw, auction_price_jpy: -1 };
    const result = rawLotSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("accepts the optional require_human flag", () => {
    const flagged = {
      ...validRaw,
      require_human: true,
      human_reason: "Test",
    };
    const result = rawLotSchema.safeParse(flagged);
    expect(result.success).toBe(true);
  });
});

describe("lotSummarySchema (view-model)", () => {
  const goodVm = {
    id: "1",
    slug: "toyota-harrier-1",
    brandSlug: "toyota",
    modelSlug: "harrier",
    generationSlug: "xu80",
    title: "Toyota Harrier Z 2.5 Hybrid",
    year: 2022,
    mileageKm: 28000,
    auctionGrade: 4.5,
    volumeCm3: 2500,
    fuelType: "hybrid",
    bodyType: "suv",
    auctionPriceJpy: 3650000,
    thumbnail: "/placeholder.svg",
    priceRangeRub: { low: 4_100_000, high: 4_900_000 },
    requiresOperator: false,
    operatorReason: null,
  };

  it("accepts a valid view-model", () => {
    expect(lotSummarySchema.safeParse(goodVm).success).toBe(true);
  });

  it("accepts nulls for optional fields (partial data)", () => {
    const vm = {
      ...goodVm,
      mileageKm: null,
      auctionGrade: null,
      thumbnail: null,
    };
    expect(lotSummarySchema.safeParse(vm).success).toBe(true);
  });

  it("accepts requiresOperator=true with null price range", () => {
    const vm = {
      ...goodVm,
      priceRangeRub: null,
      requiresOperator: true,
      operatorReason: "flagged",
    };
    expect(lotSummarySchema.safeParse(vm).success).toBe(true);
  });

  it("rejects a negative low bound", () => {
    const vm = { ...goodVm, priceRangeRub: { low: -1, high: 100 } };
    expect(lotSummarySchema.safeParse(vm).success).toBe(false);
  });
});

describe("lotSearchParamsSchema", () => {
  it("applies defaults for page / pageSize / sort", () => {
    const result = lotSearchParamsSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(12);
    expect(result.sort).toBe("newest");
  });

  it("rejects pageSize > 60 to avoid runaway renders", () => {
    expect(() => lotSearchParamsSchema.parse({ pageSize: 1000 })).toThrow();
  });

  it("rejects unknown filters via strict mode", () => {
    expect(() =>
      lotSearchParamsSchema.parse({ notARealFilter: "oops" }),
    ).toThrow();
  });
});
