/**
 * Deterministic in-memory provider reading `../fixtures/*.json`.
 *
 * Validation happens at construction: if a fixture drifts from the raw schema
 * we throw a `validation` error with the zod issue path. This is what makes
 * the test suite a real data-contract check, not just a rendering smoke test.
 *
 * Catalog semantics (filtering/sorting/mapping) live in
 * `InMemoryAuctionProvider` and are shared with the HTTP provider.
 */

import brandsJson from "../fixtures/brands.json" with { type: "json" };
import lotsJson from "../fixtures/lots.json" with { type: "json" };

import type { RawBrand, RawLot } from "../domain";
import { AuctionProviderError } from "../provider";
import { rawBrandListSchema, rawLotListSchema } from "../schemas";
import { InMemoryAuctionProvider, type CalculateFn } from "./in-memory";

function parseFixtures() {
  const brandsResult = rawBrandListSchema.safeParse(brandsJson);
  if (!brandsResult.success) {
    throw new AuctionProviderError(
      "validation",
      `brands.json is malformed: ${brandsResult.error.message}`,
      { cause: brandsResult.error },
    );
  }
  const lotsResult = rawLotListSchema.safeParse(lotsJson);
  if (!lotsResult.success) {
    throw new AuctionProviderError(
      "validation",
      `lots.json is malformed: ${lotsResult.error.message}`,
      { cause: lotsResult.error },
    );
  }
  return { brands: brandsResult.data, lots: lotsResult.data };
}

export interface MockProviderOptions {
  /** Override the fixtures — used by tests to inject edge cases. */
  brands?: RawBrand[];
  lots?: RawLot[];
  /** Passed through to `mapLotSummary` / `mapLotDetail`. */
  calculate?: CalculateFn;
}

export class MockAuctionProvider extends InMemoryAuctionProvider {
  constructor(opts: MockProviderOptions = {}) {
    if (opts.brands && opts.lots) {
      super(opts.brands, opts.lots, opts.calculate);
    } else {
      const parsed = parseFixtures();
      super(opts.brands ?? parsed.brands, opts.lots ?? parsed.lots, opts.calculate);
    }
  }
}
