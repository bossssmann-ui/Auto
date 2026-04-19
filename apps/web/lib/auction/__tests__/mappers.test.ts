/**
 * Mapper tests — the heart of Phase 4's data-contract guarantee.
 *
 * We inject a deterministic calculator (`fakeCalc`) so we don't depend on the
 * real CBR fetch. This keeps the test hermetic and lets us assert the exact
 * branching:
 *
 *   valid lot        → priceRangeRub populated, requiresOperator=false
 *   partial lot      → renders with null mileageKm/auctionGrade/thumbnail
 *   require_human    → priceRangeRub=null, requiresOperator=true + reason
 *   moto > 600k JPY  → calculator returns requireHuman → flagged
 *   sanctioned lot   → NOT flagged on sanctions alone (price still renders)
 *   special vehicle  → calculator returns requireHuman → flagged
 */

import { describe, expect, it } from "vitest";
import type {
  CalcParams,
  CalcResult,
} from "@auto/shared";

import { mapLotDetail, mapLotSummary, PRICE_RANGE_SPREAD } from "../mappers";
import type { RawLot } from "../domain";
import { lotDetailSchema, lotSummarySchema } from "../schemas";

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

/**
 * Deterministic calculator:
 *   - `special` / `special_vehicle`  → requireHuman
 *   - `moto` with priceJPY > 600 000 → requireHuman
 *   - otherwise: finalTotalRub = priceJPY * 1.5 (bumps freight/duty linearly)
 *
 * Ratio is intentionally linear so the low/high call-pair produces distinct
 * values and we can verify the spread.
 */
const fakeCalc = async (params: CalcParams): Promise<CalcResult> => {
  if (params.vehicleType === "special" || params.vehicleType === "special_vehicle") {
    return {
      success: false,
      requireHuman: true,
      message: "special vehicle",
    };
  }
  if (params.vehicleType === "moto" && params.priceJPY > 600_000) {
    return {
      success: false,
      requireHuman: true,
      message: "moto over threshold",
    };
  }
  const sanctioned = params.fuelType === "hybrid" || params.fuelType === "electric";
  return {
    success: true,
    japanTotalRub: params.priceJPY,
    freightRub: sanctioned ? 350_000 : 200_000,
    customsDutyRub: 100_000,
    utilFeeRub: 5200,
    fixedFeesRub: 80_000,
    finalTotalRub: Math.round(params.priceJPY * 1.5),
    sanctioned,
    appliedRates: { JPY: 0.66, USD: 95, EUR: 103 },
  };
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseRaw: RawLot = {
  lot_id: "t-1",
  auction: "USS Tokyo",
  brand: "honda",
  model: "vezel",
  generation: "ru",
  year: 2019,
  mileage_km: 62000,
  body_type: "suv",
  fuel: "ice",
  engine_cc: 1500,
  transmission: "cvt",
  drive: "fwd",
  color: "white",
  grade: 4.5,
  auction_price_jpy: 1_100_000,
  auction_date: "2026-04-10",
  photos: ["/x.svg"],
  trim: "X",
};

// ---------------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------------

describe("mapLotSummary — valid lot", () => {
  it("produces a populated priceRangeRub via low/high calculator calls", async () => {
    const vm = await mapLotSummary(baseRaw, { calculate: fakeCalc });
    expect(vm.requiresOperator).toBe(false);
    expect(vm.priceRangeRub).not.toBeNull();

    // Spread is PRICE_RANGE_SPREAD = 0.1; fakeCalc is linear so:
    //   low  = round(priceJPY * 0.9) * 1.5
    //   high = round(priceJPY * 1.1) * 1.5
    const low = Math.round(Math.round(baseRaw.auction_price_jpy * (1 - PRICE_RANGE_SPREAD)) * 1.5);
    const high = Math.round(Math.round(baseRaw.auction_price_jpy * (1 + PRICE_RANGE_SPREAD)) * 1.5);
    expect(vm.priceRangeRub).toEqual({ low, high });
    expect(low).toBeLessThan(high);
  });

  it("copies identity fields faithfully and produces a valid view-model", async () => {
    const vm = await mapLotSummary(baseRaw, { calculate: fakeCalc });
    expect(vm.id).toBe(baseRaw.lot_id);
    expect(vm.brandSlug).toBe("honda");
    expect(vm.modelSlug).toBe("vezel");
    expect(vm.year).toBe(2019);
    expect(vm.mileageKm).toBe(62000);
    expect(vm.auctionGrade).toBe(4.5);
    expect(vm.thumbnail).toBe("/x.svg");
    expect(vm.title).toContain("Honda");
    expect(vm.title).toContain("Vezel");

    // And the view-model schema must accept the result round-trip.
    expect(lotSummarySchema.safeParse(vm).success).toBe(true);
  });
});

describe("mapLotSummary — partial lot", () => {
  it("renders nullable fields as null without throwing", async () => {
    const partial: RawLot = {
      lot_id: "p-1",
      auction: "USS Tokyo",
      brand: "honda",
      model: "fit",
      year: 2022,
      body_type: "hatchback",
      fuel: "hybrid",
      engine_cc: 1500,
      auction_price_jpy: 1_520_000,
      photos: [],
      transmission: "unknown",
      drive: "unknown",
    };
    const vm = await mapLotSummary(partial, { calculate: fakeCalc });

    expect(vm.mileageKm).toBeNull();
    expect(vm.auctionGrade).toBeNull();
    expect(vm.thumbnail).toBeNull();
    expect(vm.requiresOperator).toBe(false);
    expect(vm.priceRangeRub).not.toBeNull();
    expect(lotSummarySchema.safeParse(vm).success).toBe(true);
  });
});

describe("mapLotSummary — flagged (require_human)", () => {
  it("forces requiresOperator=true and nulls the price range", async () => {
    const flagged: RawLot = {
      ...baseRaw,
      lot_id: "flagged-1",
      require_human: true,
      human_reason: "Custom reason",
    };
    const vm = await mapLotSummary(flagged, { calculate: fakeCalc });
    expect(vm.requiresOperator).toBe(true);
    expect(vm.priceRangeRub).toBeNull();
    expect(vm.operatorReason).toBe("Custom reason");
  });

  it("falls back to a default reason when none is provided", async () => {
    const flagged: RawLot = { ...baseRaw, lot_id: "flagged-2", require_human: true };
    const vm = await mapLotSummary(flagged, { calculate: fakeCalc });
    expect(vm.requiresOperator).toBe(true);
    expect(vm.operatorReason).toMatch(/оператора/i);
  });

  it("does NOT call the calculator when require_human is true", async () => {
    let called = 0;
    const spy = async (p: CalcParams) => {
      called += 1;
      return fakeCalc(p);
    };
    const flagged: RawLot = { ...baseRaw, lot_id: "flagged-3", require_human: true };
    await mapLotSummary(flagged, { calculate: spy });
    expect(called).toBe(0);
  });
});

describe("mapLotSummary — calculator says requireHuman", () => {
  it("flags moto over 600k ¥ from the calculator's response", async () => {
    const moto: RawLot = {
      ...baseRaw,
      lot_id: "moto-sanctioned",
      brand: "suzuki",
      model: "hayabusa",
      body_type: "moto",
      engine_cc: 1340,
      auction_price_jpy: 920_000,
    };
    const vm = await mapLotSummary(moto, { calculate: fakeCalc });
    expect(vm.requiresOperator).toBe(true);
    expect(vm.priceRangeRub).toBeNull();
    expect(vm.operatorReason).toMatch(/moto/i);
  });

  it("leaves cheap moto (< 600k ¥) priced normally", async () => {
    const moto: RawLot = {
      ...baseRaw,
      lot_id: "moto-ok",
      brand: "suzuki",
      model: "hayabusa",
      body_type: "moto",
      engine_cc: 1340,
      auction_price_jpy: 480_000,
    };
    const vm = await mapLotSummary(moto, { calculate: fakeCalc });
    expect(vm.requiresOperator).toBe(false);
    expect(vm.priceRangeRub).not.toBeNull();
  });

  it("flags special-body vehicles via the calculator", async () => {
    const special: RawLot = {
      ...baseRaw,
      lot_id: "special-1",
      body_type: "special",
      engine_cc: 4000,
      auction_price_jpy: 5_200_000,
    };
    const vm = await mapLotSummary(special, { calculate: fakeCalc });
    expect(vm.requiresOperator).toBe(true);
    expect(vm.priceRangeRub).toBeNull();
  });
});

describe("mapLotSummary — calculator errors", () => {
  it("falls back to requiresOperator when the calculator rejects", async () => {
    const throwingCalc = async (): Promise<CalcResult> => {
      throw new Error("CBR unreachable");
    };
    const vm = await mapLotSummary(baseRaw, { calculate: throwingCalc });
    expect(vm.requiresOperator).toBe(true);
    expect(vm.priceRangeRub).toBeNull();
    expect(vm.operatorReason).not.toBeNull();
  });
});

describe("mapLotSummary — sanctioned but not flagged", () => {
  it("hybrid 2.5 SUV keeps a price range (sanctions raise freight, not operator flag)", async () => {
    const harrier: RawLot = {
      ...baseRaw,
      lot_id: "harrier-1",
      brand: "toyota",
      model: "harrier",
      body_type: "suv",
      fuel: "hybrid",
      engine_cc: 2500,
      auction_price_jpy: 3_650_000,
    };
    const vm = await mapLotSummary(harrier, { calculate: fakeCalc });
    expect(vm.requiresOperator).toBe(false);
    expect(vm.priceRangeRub).not.toBeNull();
  });
});

describe("mapLotDetail", () => {
  it("extends the summary with detail-only fields", async () => {
    const detail = await mapLotDetail(baseRaw, { calculate: fakeCalc });
    expect(detail.auction).toBe("USS Tokyo");
    expect(detail.auctionDate).toBe("2026-04-10");
    expect(detail.color).toBe("white");
    expect(detail.transmission).toBe("cvt");
    expect(detail.drive).toBe("fwd");
    expect(detail.trim).toBe("X");
    expect(detail.photos).toEqual(["/x.svg"]);
    expect(lotDetailSchema.safeParse(detail).success).toBe(true);
  });

  it("nulls optional detail fields when raw omits them", async () => {
    const minimal: RawLot = {
      lot_id: "min-1",
      auction: "USS Tokyo",
      brand: "honda",
      model: "fit",
      year: 2020,
      body_type: "hatchback",
      fuel: "ice",
      engine_cc: 1500,
      auction_price_jpy: 900_000,
      transmission: "unknown",
      drive: "unknown",
      photos: [],
    };
    const detail = await mapLotDetail(minimal, { calculate: fakeCalc });
    expect(detail.auctionDate).toBeNull();
    expect(detail.color).toBeNull();
    expect(detail.trim).toBeNull();
    expect(detail.photos).toEqual([]);
    expect(lotDetailSchema.safeParse(detail).success).toBe(true);
  });
});
