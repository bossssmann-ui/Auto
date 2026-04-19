/**
 * URL state helpers for the turnkey calculator.
 *
 * Round-trips `CalculatorInput` to/from `URLSearchParams` so customers can
 * share a pre-filled calculator link (spec §7.6.4). Keys are whitelisted and
 * parsed through zod so a malformed URL gracefully falls back to defaults.
 */

import { calculatorInputSchema, type CalculatorInput } from "./calculator-schema";

const booleanFromString = (v: string | null): boolean | undefined => {
  if (v === null) return undefined;
  if (v === "1" || v === "true") return true;
  if (v === "0" || v === "false") return false;
  return undefined;
};

const intFromString = (v: string | null): number | undefined => {
  if (v === null || v === "") return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Turn a validated form state into URLSearchParams with stable key order.
 * The caller controls whether to push this via `router.replace` or copy as
 * a shareable link.
 */
export function encodeCalculatorState(state: CalculatorInput): URLSearchParams {
  const sp = new URLSearchParams();
  sp.set("type", state.vehicleType);
  sp.set("volume", String(state.volumeCm3));
  sp.set("age", String(state.ageYears));
  sp.set("fuel", state.fuelType);
  sp.set("van", state.isVan ? "1" : "0");
  sp.set("lowJpy", String(state.priceJpyLow));
  sp.set("highJpy", String(state.priceJpyHigh));
  sp.set("resale", state.isForResale ? "1" : "0");
  sp.set("legal", state.isLegalEntity ? "1" : "0");
  return sp;
}

/**
 * Try to decode a `CalculatorInput` from searchParams. Returns `null` if
 * anything is missing or fails zod validation — callers fall back to form
 * defaults in that case.
 */
export function decodeCalculatorState(
  params: URLSearchParams | ReadonlyURLSearchParams,
): CalculatorInput | null {
  const get = (k: string) => params.get(k);

  const candidate = {
    vehicleType: get("type") ?? undefined,
    volumeCm3: intFromString(get("volume")),
    ageYears: intFromString(get("age")),
    fuelType: get("fuel") ?? undefined,
    isVan: booleanFromString(get("van")),
    priceJpyLow: intFromString(get("lowJpy")),
    priceJpyHigh: intFromString(get("highJpy")),
    isForResale: booleanFromString(get("resale")),
    isLegalEntity: booleanFromString(get("legal")),
  };

  // Require every field to be present — a partial URL is not a valid share.
  for (const v of Object.values(candidate)) {
    if (v === undefined) return null;
  }

  const parsed = calculatorInputSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

/** Minimal subset of the Next useSearchParams return type we rely on. */
export interface ReadonlyURLSearchParams {
  get(name: string): string | null;
}
