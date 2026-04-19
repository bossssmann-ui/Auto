import { describe, it, expect } from "vitest";
import {
  encodeCalculatorState,
  decodeCalculatorState,
} from "@/lib/calculator-url";
import type { CalculatorInput } from "@/lib/calculator-schema";

const SAMPLE: CalculatorInput = {
  vehicleType: "car",
  volumeCm3: 2500,
  ageYears: 4,
  fuelType: "ice",
  isVan: false,
  priceJpyLow: 1_500_000,
  priceJpyHigh: 2_200_000,
  isForResale: false,
  isLegalEntity: false,
};

describe("calculator URL state", () => {
  it("round-trips a valid state", () => {
    const sp = encodeCalculatorState(SAMPLE);
    const back = decodeCalculatorState(sp);
    expect(back).toEqual(SAMPLE);
  });

  it("serializes booleans as 0/1", () => {
    const sp = encodeCalculatorState({ ...SAMPLE, isVan: true, isLegalEntity: true });
    expect(sp.get("van")).toBe("1");
    expect(sp.get("legal")).toBe("1");
    expect(sp.get("resale")).toBe("0");
  });

  it("returns null when any field is missing", () => {
    const sp = new URLSearchParams({
      type: "car",
      volume: "2000",
      age: "3",
      fuel: "ice",
      van: "0",
      lowJpy: "1000000",
      // highJpy missing
      resale: "0",
      legal: "0",
    });
    expect(decodeCalculatorState(sp)).toBeNull();
  });

  it("rejects invalid enum values", () => {
    const sp = encodeCalculatorState(SAMPLE);
    sp.set("type", "tank");
    expect(decodeCalculatorState(sp)).toBeNull();
  });

  it("rejects a high-below-low price range via schema refine", () => {
    const sp = encodeCalculatorState({
      ...SAMPLE,
      priceJpyLow: 3_000_000,
      priceJpyHigh: 1_000_000,
    });
    // Round-trip still carries the numbers, but the schema refuses it.
    expect(decodeCalculatorState(sp)).toBeNull();
  });

  it("rejects electric with non-zero volume", () => {
    const sp = encodeCalculatorState({
      ...SAMPLE,
      fuelType: "electric",
      volumeCm3: 2000,
    });
    expect(decodeCalculatorState(sp)).toBeNull();
  });

  it("accepts electric with zero volume", () => {
    const sp = encodeCalculatorState({
      ...SAMPLE,
      fuelType: "electric",
      volumeCm3: 0,
    });
    const back = decodeCalculatorState(sp);
    expect(back?.fuelType).toBe("electric");
    expect(back?.volumeCm3).toBe(0);
  });

  it("tolerates 'true'/'false' boolean encoding as well as 0/1", () => {
    const sp = encodeCalculatorState(SAMPLE);
    sp.set("van", "true");
    sp.set("legal", "false");
    const back = decodeCalculatorState(sp);
    expect(back?.isVan).toBe(true);
    expect(back?.isLegalEntity).toBe(false);
  });
});
