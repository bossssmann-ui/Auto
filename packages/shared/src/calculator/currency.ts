/**
 * CBR daily-rates fetch. Kept as a separate module so the web app can mock or
 * swap it out without touching calculator internals.
 *
 * Performance/resilience layer (no effect on calculation formulas):
 *   - in-memory cache with a TTL — CBR publishes rates once a day, so two
 *     calls within the TTL (e.g. the low/high legs of a price range) share
 *     one HTTP response;
 *   - in-flight dedupe — parallel callers await the same request instead of
 *     firing duplicate fetches;
 *   - fetch timeout — a slow/unreachable CBR mirror fails fast so callers can
 *     fall back to the operator flow instead of hanging;
 *   - stale-if-error — when a refresh fails but an expired cache exists, the
 *     stale rates are served rather than failing the calculation.
 */

import type { CbrRates } from './types';

export const CBR_URL = 'https://www.cbr-xml-daily.ru/daily_json.js';

/**
 * Bank-side FX spread applied to CBR rates. Same spread for JPY and USD legs.
 */
export const BANK_SPREAD = 1.04;

/** Abort the CBR fetch after this long — callers degrade to operator flow. */
export const CBR_FETCH_TIMEOUT_MS = 5_000;

/** How long fetched rates stay fresh. CBR updates once a day; 1h is safe. */
export const CBR_CACHE_TTL_MS = 60 * 60 * 1_000;

interface CbrCurrency {
  Value: number;
  Nominal: number;
}

interface CbrResponse {
  Valute: Record<string, CbrCurrency>;
}

let cache: { rates: CbrRates; fetchedAt: number } | null = null;
let inFlight: Promise<CbrRates> | null = null;

/** Test-only helper: clear the module-level cache between test cases. */
export function __resetCbrRatesCache(): void {
  cache = null;
  inFlight = null;
}

async function fetchFromCbr(): Promise<CbrRates> {
  const res = await fetch(CBR_URL, {
    signal: AbortSignal.timeout(CBR_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`CBR API error: ${res.status}`);
  const data = (await res.json()) as CbrResponse;

  const jpy = data.Valute['JPY'];
  const usd = data.Valute['USD'];
  const eur = data.Valute['EUR'];

  if (!jpy || !usd || !eur) throw new Error('Missing currency data from CBR');

  return {
    JPY_CBR: jpy.Value / jpy.Nominal,
    USD_CBR: usd.Value / usd.Nominal,
    EUR_CBR: eur.Value / eur.Nominal,
  };
}

export async function fetchCbrRates(): Promise<CbrRates> {
  if (cache && Date.now() - cache.fetchedAt < CBR_CACHE_TTL_MS) {
    return cache.rates;
  }

  if (!inFlight) {
    inFlight = fetchFromCbr().finally(() => {
      inFlight = null;
    });
  }

  try {
    const rates = await inFlight;
    cache = { rates, fetchedAt: Date.now() };
    return rates;
  } catch (err) {
    // Stale-if-error: an outdated rate is far better than no calculation.
    if (cache) return cache.rates;
    throw err;
  }
}
