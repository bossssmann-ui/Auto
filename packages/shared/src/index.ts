// @auto/shared — public API.
// Per COPILOT_INSTRUCTIONS.md §2.3 — this surface is the only thing external
// workspaces (@auto/bot, @auto/web) may import. Internal helpers stay private.

export type {
  CalcParams,
  CalcResult,
  CalcSuccess,
  CalcHumanRequired,
  FuelType,
  CbrRates,
} from './calculator/types';
export { calculateTurnkeyPrice } from './calculator';
export { isSanctionedVehicle } from './calculator/sanctions';
export { fetchCbrRates, __resetCbrRatesCache } from './calculator/currency';
