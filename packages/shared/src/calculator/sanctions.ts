/**
 * Sanctions logic — Japan → Russia direct export ban (Aug 2023).
 * Sanctioned vehicles are re-routed via third countries → elevated freight.
 */

import type { CalcParams, FuelType } from './types';

export const SANCTIONED_FREIGHT_USD: Record<string, number> = {
  car: 3_500,
  jeep: 4_000,
  van: 4_000,
};

export const SANCTIONED_VOLUME_THRESHOLD_CM3 = 1_900;
export const MOTO_HUMAN_PRICE_THRESHOLD_JPY = 600_000;

/**
 * Determine if a vehicle falls under Japan's Aug 2023 export ban to Russia.
 * Sanctioned vehicles are imported via third countries with elevated freight.
 */
export function isSanctionedVehicle(
  vehicleType: CalcParams['vehicleType'],
  volumeCm3: number,
  fuelType: FuelType,
  isVan: boolean,
): boolean {
  if (vehicleType === 'moto') return false;
  if (fuelType === 'hybrid' || fuelType === 'electric') return true;
  if (volumeCm3 > SANCTIONED_VOLUME_THRESHOLD_CM3) return true;
  if (isVan) return true;
  return false;
}
