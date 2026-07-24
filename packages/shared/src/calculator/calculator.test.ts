/**
 * Golden-sample tests for `@auto/shared`'s turnkey price calculator.
 *
 * These tests lock in the exact numeric output produced by every branch of
 * `calculateTurnkeyPrice` against a fixed, synthetic CBR response. The expected
 * values were captured via a side-by-side comparison against the pre-refactor
 * `server/calculator.ts` (see the Phase 2 PR description for the run log).
 *
 * Goal: any future change that accidentally mutates a bracket, threshold, or
 * rounding step causes a test failure *before* it reaches production.
 *
 * ⚠ Do not change expected numbers unless a real customs/sanctions rule is
 * changing and you have a linked source. Update the fixture rates only if you
 * also update every expected value.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateTurnkeyPrice } from './index';
import { __resetCbrRatesCache } from './currency';
import { isSanctionedVehicle } from './sanctions';
import type { CalcParams, CalcSuccess } from './types';

/**
 * Synthetic CBR response. Values chosen for clean arithmetic, not realism.
 * After `BANK_SPREAD = 1.04` is applied the effective bank rates are:
 *   JPY = 0.676, USD = 98.8, EUR = 103 (EUR has no spread on the CBR leg).
 */
const FAKE_CBR_JSON = {
  Valute: {
    JPY: { Value: 0.65, Nominal: 1 },
    USD: { Value: 95.0, Nominal: 1 },
    EUR: { Value: 103.0, Nominal: 1 },
  },
};

beforeEach(() => {
  // Every test gets a clean fetch stub that returns the same rates. No test
  // should ever hit the real CBR endpoint. The rates cache is reset so each
  // case exercises the full fetch path.
  __resetCbrRatesCache();
  const ok = {
    ok: true,
    json: async () => FAKE_CBR_JSON,
  } as unknown as Response;
  vi.stubGlobal('fetch', vi.fn(async () => ok));
});

// --------------------------------------------------------------------------
// Pure helper: isSanctionedVehicle. All branches.
// --------------------------------------------------------------------------
describe('isSanctionedVehicle', () => {
  it('returns false for moto regardless of other inputs', () => {
    expect(isSanctionedVehicle('moto', 9999, 'electric', true)).toBe(false);
  });

  it('flags any hybrid as sanctioned', () => {
    expect(isSanctionedVehicle('car', 1500, 'hybrid', false)).toBe(true);
  });

  it('flags any electric as sanctioned', () => {
    expect(isSanctionedVehicle('car', 0, 'electric', false)).toBe(true);
  });

  it('flags ICE above the 1900cc volume threshold', () => {
    expect(isSanctionedVehicle('car', 1901, 'ice', false)).toBe(true);
    expect(isSanctionedVehicle('car', 1900, 'ice', false)).toBe(false); // boundary
  });

  it('flags VAN regardless of volume', () => {
    expect(isSanctionedVehicle('car', 1500, 'ice', true)).toBe(true);
  });

  it('non-sanctioned passenger ICE under 1900cc', () => {
    expect(isSanctionedVehicle('car', 1500, 'ice', false)).toBe(false);
  });
});

// --------------------------------------------------------------------------
// End-to-end golden cases. Every field matters — don't loosen the assertions.
// --------------------------------------------------------------------------
describe('calculateTurnkeyPrice — golden samples', () => {
  it('Honda Vezel 1.5 ICE, >5 years, personal (non-sanctioned, duty-old bracket)', async () => {
    const result = await calculateTurnkeyPrice({
      vehicleType: 'car',
      priceJPY: 600_000,
      volumeCm3: 1500,
      ageYears: 7,
      isForResale: false,
      isLegalEntity: false,
      fuelType: 'ice',
    });
    expect(result).toEqual<CalcSuccess>({
      success: true,
      japanTotalRub: 500_240,
      freightRub: 39_520,
      customsDutyRub: 494_400,
      utilFeeRub: 5200,
      fixedFeesRub: 185_000,
      finalTotalRub: 1_224_360,
      sanctioned: false,
      appliedRates: { JPY: 0.676, USD: 98.8, EUR: 103 },
    });
  });

  it('Toyota Harrier 2.5 hybrid, 3 years, personal (sanctioned via hybrid, duty-new bracket)', async () => {
    const result = await calculateTurnkeyPrice({
      vehicleType: 'jeep',
      priceJPY: 3_000_000,
      volumeCm3: 2500,
      ageYears: 3,
      isForResale: false,
      isLegalEntity: false,
      fuelType: 'hybrid',
    });
    expect(result).toEqual<CalcSuccess>({
      success: true,
      japanTotalRub: 2_311_920,
      freightRub: 395_200,
      customsDutyRub: 1_416_250,
      utilFeeRub: 3400,
      fixedFeesRub: 185_000,
      finalTotalRub: 4_311_770,
      sanctioned: true,
      appliedRates: { JPY: 0.676, USD: 98.8, EUR: 103 },
    });
  });

  it('Toyota Alphard 2.5 ICE VAN, 4 years, personal (sanctioned via isVan, duty-mid bracket)', async () => {
    const result = await calculateTurnkeyPrice({
      vehicleType: 'car',
      priceJPY: 2_800_000,
      volumeCm3: 2500,
      ageYears: 4,
      isForResale: false,
      isLegalEntity: false,
      fuelType: 'ice',
      isVan: true,
    });
    expect(result).toEqual<CalcSuccess>({
      success: true,
      japanTotalRub: 2_136_160,
      freightRub: 395_200,
      customsDutyRub: 772_500,
      utilFeeRub: 5200,
      fixedFeesRub: 185_000,
      finalTotalRub: 3_494_060,
      sanctioned: true,
      appliedRates: { JPY: 0.676, USD: 98.8, EUR: 103 },
    });
  });

  it('Motorcycle under 600 000 JPY threshold — non-sanctioned, zero duty, no util fee', async () => {
    const result = await calculateTurnkeyPrice({
      vehicleType: 'moto',
      priceJPY: 500_000,
      volumeCm3: 600,
      ageYears: 4,
      isForResale: false,
      isLegalEntity: false,
    });
    expect(result).toEqual<CalcSuccess>({
      success: true,
      japanTotalRub: 412_360,
      freightRub: 29_640,
      customsDutyRub: 0,
      utilFeeRub: 0,
      fixedFeesRub: 185_000,
      finalTotalRub: 627_000,
      sanctioned: false,
      appliedRates: { JPY: 0.676, USD: 98.8, EUR: 103 },
    });
  });

  it('Motorcycle above 600 000 JPY threshold returns requireHuman', async () => {
    const result = await calculateTurnkeyPrice({
      vehicleType: 'moto',
      priceJPY: 700_000,
      volumeCm3: 600,
      ageYears: 4,
      isForResale: false,
      isLegalEntity: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.requireHuman).toBe(true);
      expect(result.message).toMatch(/600 000 иен FOB/);
    }
  });

  it('Diesel ICE 2.2, 4 years, commercial (for resale) — sanctioned via >1900cc, commercial util fee', async () => {
    const result = await calculateTurnkeyPrice({
      vehicleType: 'car',
      priceJPY: 1_500_000,
      volumeCm3: 2200,
      ageYears: 4,
      isForResale: true,
      isLegalEntity: false,
      fuelType: 'ice',
    });
    expect(result).toEqual<CalcSuccess>({
      success: true,
      japanTotalRub: 1_169_480,
      freightRub: 345_800,
      customsDutyRub: 611_820,
      utilFeeRub: 1_150_000,
      fixedFeesRub: 185_000,
      finalTotalRub: 3_462_100,
      sanctioned: true,
      appliedRates: { JPY: 0.676, USD: 98.8, EUR: 103 },
    });
  });

  it('Special vehicle (heavy machinery) returns requireHuman without hitting CBR', async () => {
    const result = await calculateTurnkeyPrice({
      vehicleType: 'special',
      priceJPY: 1_000_000,
      volumeCm3: 4000,
      ageYears: 3,
      isForResale: true,
      isLegalEntity: true,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.requireHuman).toBe(true);
      expect(result.message).toMatch(/спецтехник/i);
    }
    // special must short-circuit before any network call
    expect(fetch).not.toHaveBeenCalled();
  });

  it('Passenger EV — sanctioned via fuelType even at 0 cm³', async () => {
    const result = await calculateTurnkeyPrice({
      vehicleType: 'car',
      priceJPY: 2_000_000,
      volumeCm3: 0,
      ageYears: 2,
      isForResale: false,
      isLegalEntity: false,
      fuelType: 'electric',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.sanctioned).toBe(true);
      // EV-specific freight must be the sanctioned 'car' rate: 3500 USD × 98.8 = 345800
      expect(result.freightRub).toBe(345_800);
    }
  });
});

// --------------------------------------------------------------------------
// Regression guards for individual orchestration details.
// --------------------------------------------------------------------------
describe('calculateTurnkeyPrice — invariants', () => {
  const baseParams: CalcParams = {
    vehicleType: 'car',
    priceJPY: 1_000_000,
    volumeCm3: 1500,
    ageYears: 4,
    isForResale: false,
    isLegalEntity: false,
    fuelType: 'ice',
  };

  it('omitting fuelType defaults to ice (identical result to explicit ice)', async () => {
    const withDefault = await calculateTurnkeyPrice({
      ...baseParams,
      fuelType: undefined,
    });
    const withExplicit = await calculateTurnkeyPrice(baseParams);
    expect(withDefault).toEqual(withExplicit);
  });

  it('finalTotalRub always equals the sum of its parts', async () => {
    const result = await calculateTurnkeyPrice(baseParams);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.finalTotalRub).toBe(
        result.japanTotalRub +
          result.freightRub +
          result.customsDutyRub +
          result.utilFeeRub +
          result.fixedFeesRub,
      );
    }
  });
});
