/**
 * Raw provider data → normalized view-model.
 *
 * The mapper is the ONLY place that calls `@auto/shared`'s calculator. Pages
 * and components never touch `CalcParams` or `CalcResult`; they only see
 * `LotListItem.priceRangeRub` / `requiresOperator`.
 *
 * Contract for "flagged records":
 *   - `calculateTurnkeyPrice` returns `requireHuman: true` for `special`
 *     vehicles and motos > 600 000 ¥. We surface that as
 *     `requiresOperator: true` with a null price range.
 *   - `isSanctionedVehicle()` true → freight rises but price still computes;
 *     the lot is NOT marked `requiresOperator` purely for sanctions.
 *   - An explicit `require_human: true` in the raw lot forces the operator
 *     card regardless (useful for edge cases a real API might flag).
 */

import {
  calculateTurnkeyPrice,
  type CalcParams,
  type CalcResult,
  type FuelType as CalcFuelType,
} from "@auto/shared";

import type { FuelType, LotDetail, LotListItem, RawBrand, RawLot } from "./domain";

/**
 * Spread applied to `auction_price_jpy` to produce the low/high estimates.
 * Kept here (not in `@auto/shared`) because it's a presentation decision, not
 * a calculator one.
 */
export const PRICE_RANGE_SPREAD = 0.1 as const;

interface MapperOptions {
  /**
   * Allows tests to inject a deterministic price calculator. Production code
   * uses the real one.
   */
  calculate?: (params: CalcParams) => Promise<CalcResult>;
}

// ---------------------------------------------------------------------------
// Fuel → calculator fuel bridge
// ---------------------------------------------------------------------------

/**
 * `@auto/shared` only knows `ice | hybrid | electric`. Diesel is treated as
 * ICE for duty purposes (the calculator doesn't branch on diesel) but stays
 * visible on the view-model so the UI can label it correctly.
 */
function toCalcFuel(fuel: FuelType): CalcFuelType {
  if (fuel === "hybrid") return "hybrid";
  if (fuel === "electric") return "electric";
  return "ice";
}

function deriveAgeYears(year: number, now: Date = new Date()): number {
  return Math.max(0, now.getFullYear() - year);
}

function toVehicleType(
  bodyType: RawLot["body_type"],
): CalcParams["vehicleType"] {
  if (bodyType === "moto") return "moto";
  if (bodyType === "special") return "special";
  // The calculator uses "jeep" for SUVs/pickups (higher freight). VAN is
  // handled via `isVan`, not vehicleType.
  if (bodyType === "suv" || bodyType === "pickup") return "jeep";
  return "car";
}

function buildCalcParams(lot: RawLot): CalcParams {
  return {
    vehicleType: toVehicleType(lot.body_type),
    priceJPY: lot.auction_price_jpy,
    volumeCm3: lot.engine_cc,
    ageYears: deriveAgeYears(lot.year),
    fuelType: toCalcFuel(lot.fuel),
    isVan: lot.body_type === "van",
    // Defaults for catalog preview. Individual lot pages use the same defaults;
    // fine-grained tuning happens on the standalone calculator (Phase 6).
    isForResale: false,
    isLegalEntity: false,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Map raw → summary. Always resolves — on calculator failure it returns a
 * view-model flagged with `requiresOperator: true`.
 */
export async function mapLotSummary(
  raw: RawLot,
  opts: MapperOptions = {},
): Promise<LotListItem> {
  const calc = opts.calculate ?? calculateTurnkeyPrice;
  const base = buildSummaryBase(raw);

  // Fixtures can force a flagged record without relying on calculator rules.
  if (raw.require_human) {
    return {
      ...base,
      priceRangeRub: null,
      requiresOperator: true,
      operatorReason: raw.human_reason ?? DEFAULT_OPERATOR_REASON,
    };
  }

  const params = buildCalcParams(raw);

  const lowPromise = calc({
    ...params,
    priceJPY: Math.round(raw.auction_price_jpy * (1 - PRICE_RANGE_SPREAD)),
  });
  const highPromise = calc({
    ...params,
    priceJPY: Math.round(raw.auction_price_jpy * (1 + PRICE_RANGE_SPREAD)),
  });

  // If the calculator throws (e.g. CBR rates API down / blocked at build
  // time), fall back to an operator card rather than crashing the page.
  // This is also the correct product behavior: if we can't price, we ask.
  const settled = await Promise.allSettled([lowPromise, highPromise]);
  if (settled[0].status === "rejected" || settled[1].status === "rejected") {
    return {
      ...base,
      priceRangeRub: null,
      requiresOperator: true,
      operatorReason: DEFAULT_OPERATOR_REASON,
    };
  }
  const low = settled[0].value;
  const high = settled[1].value;

  // If either bound flags as human-required, fall back to the operator card.
  // `success: false` is a CalcHumanRequired — narrow via `.success`.
  if (low.success !== true || high.success !== true) {
    const reason =
      (low.success === false ? low.message : undefined) ??
      (high.success === false ? high.message : undefined) ??
      DEFAULT_OPERATOR_REASON;
    return {
      ...base,
      priceRangeRub: null,
      requiresOperator: true,
      operatorReason: reason,
    };
  }

  return {
    ...base,
    priceRangeRub: {
      low: low.finalTotalRub,
      high: high.finalTotalRub,
    },
    requiresOperator: false,
    operatorReason: null,
  };
}

export async function mapLotDetail(
  raw: RawLot,
  opts: MapperOptions = {},
): Promise<LotDetail> {
  const summary = await mapLotSummary(raw, opts);
  return {
    ...summary,
    auction: raw.auction,
    auctionDate: raw.auction_date ?? null,
    color: raw.color ?? null,
    transmission: raw.transmission,
    drive: raw.drive,
    trim: raw.trim ?? null,
    photos: raw.photos,
  };
}

export function mapBrands(raws: RawBrand[]): Array<{
  slug: string;
  name: string;
  modelCount: number;
}> {
  return raws.map((b) => ({
    slug: b.slug,
    name: b.name,
    modelCount: b.models.length,
  }));
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const DEFAULT_OPERATOR_REASON =
  "Этот лот считается индивидуально. Перевожу на оператора — ответим в течение 15 минут.";

function buildSummaryBase(raw: RawLot) {
  const brandName = capitalize(raw.brand);
  const modelName = capitalize(raw.model);
  const trimLabel = raw.trim ? ` ${raw.trim}` : "";
  const fuelLabel = raw.fuel === "hybrid" ? " Hybrid" : raw.fuel === "electric" ? " EV" : "";

  return {
    id: raw.lot_id,
    slug: `${raw.brand}-${raw.model}-${raw.lot_id}`,
    brandSlug: raw.brand,
    modelSlug: raw.model,
    generationSlug: raw.generation,
    title:
      `${brandName} ${modelName}${trimLabel} ${(raw.engine_cc / 1000).toFixed(1)}${fuelLabel}`.trim(),
    year: raw.year,
    mileageKm: raw.mileage_km ?? null,
    auctionGrade: raw.grade ?? null,
    volumeCm3: raw.engine_cc,
    fuelType: raw.fuel,
    bodyType: raw.body_type,
    auctionPriceJpy: raw.auction_price_jpy,
    thumbnail: raw.photos[0] ?? null,
  } satisfies Omit<LotListItem, "priceRangeRub" | "requiresOperator" | "operatorReason">;
}

function capitalize(slug: string): string {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
