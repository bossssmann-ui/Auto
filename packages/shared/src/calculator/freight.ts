/**
 * Freight / inland-logistics constants for non-sanctioned vehicles.
 * Sanctioned vehicles use elevated freight — see ./sanctions.ts.
 */

/** Japan inland-logistics cost (delivery to port), in JPY, keyed by vehicle type. */
export const INLAND_JPY: Record<string, number> = {
  car: 80_000,
  jeep: 120_000,
  moto: 60_000,
};

/** Ocean freight for the standard (non-sanctioned) route, in USD, keyed by vehicle type. */
export const FREIGHT_USD: Record<string, number> = {
  car: 400,
  jeep: 500,
  moto: 300,
};

/** Japan export tax — applied to the FOB price before inland logistics. */
export const EXPORT_TAX_RATE = 0.10;

/** Fixed fees bundle on the Russia side (broker, SBKTS, EPTS, misc), in RUB. */
export const FIXED_FEES_RUB = 185_000;
