/**
 * `@auto/shared` — turnkey price calculator.
 *
 * `calculateTurnkeyPrice` is the only orchestrator. Internals are split into
 * topic-specific modules but the behavior is byte-for-byte identical to the
 * pre-refactor `server/calculator.ts`.
 */

import type { CalcParams, CalcResult } from './types';
import { calcCustomsDutyEur, calcMotoDutyEur, calcRecyclingFee } from './customs';
import { BANK_SPREAD, fetchCbrRates } from './currency';
import {
  EXPORT_TAX_RATE,
  FIXED_FEES_RUB,
  FREIGHT_USD,
  INLAND_JPY,
} from './freight';
import {
  MOTO_HUMAN_PRICE_THRESHOLD_JPY,
  SANCTIONED_FREIGHT_USD,
  isSanctionedVehicle,
} from './sanctions';

const RATE_PRECISION = 10_000;

export async function calculateTurnkeyPrice(params: CalcParams): Promise<CalcResult> {
  const { vehicleType, priceJPY, volumeCm3, ageYears, isForResale, isLegalEntity } = params;
  const fuelType = params.fuelType ?? 'ice';
  const isVan = params.isVan ?? false;

  if (vehicleType === 'special' || vehicleType === 'special_vehicle') {
    return {
      success: false,
      requireHuman: true,
      message: 'Расчёт спецтехники и авто с нестандартной логистикой только по запросу. Перевожу на оператора.',
    };
  }

  // Motorcycles over 600 000 JPY FOB are sanctioned → freight is individual, human must quote.
  if (vehicleType === 'moto' && priceJPY > MOTO_HUMAN_PRICE_THRESHOLD_JPY) {
    return {
      success: false,
      requireHuman: true,
      message: 'Мотоцикл дороже 600 000 иен FOB — считается санкционным, фрахт рассчитывается индивидуально. Перевожу на оператора.',
    };
  }

  const sanctioned = isSanctionedVehicle(vehicleType, volumeCm3, fuelType, isVan);

  const { JPY_CBR, USD_CBR, EUR_CBR } = await fetchCbrRates();

  const JPY_BANK = JPY_CBR * BANK_SPREAD;
  const USD_BANK = USD_CBR * BANK_SPREAD;

  const inlandJpy = INLAND_JPY[vehicleType] ?? INLAND_JPY['car'];
  const priceWithExport = priceJPY * (1 + EXPORT_TAX_RATE);
  const japanTotalJpy = priceWithExport + inlandJpy;
  const japanTotalRub = Math.round(japanTotalJpy * JPY_BANK);

  // Freight: sanctioned vehicles are routed via third countries at higher fixed rates.
  let freightUsd: number;
  if (sanctioned) {
    const key = isVan ? 'van' : vehicleType;
    freightUsd = SANCTIONED_FREIGHT_USD[key] ?? SANCTIONED_FREIGHT_USD['car'];
  } else {
    freightUsd = FREIGHT_USD[vehicleType] ?? FREIGHT_USD['car'];
  }
  const freightRub = Math.round(freightUsd * USD_BANK);

  const customsValueEur = (priceJPY * JPY_CBR) / EUR_CBR;

  let dutyEur: number;
  if (vehicleType === 'moto') {
    dutyEur = calcMotoDutyEur();
  } else {
    dutyEur = calcCustomsDutyEur(customsValueEur, volumeCm3, ageYears);
  }

  const customsDutyRub = Math.round(dutyEur * EUR_CBR);

  const utilFeeRub = calcRecyclingFee(vehicleType, volumeCm3, ageYears, isLegalEntity, isForResale);

  const fixedFeesRub = FIXED_FEES_RUB;

  const finalTotalRub = japanTotalRub + freightRub + customsDutyRub + utilFeeRub + fixedFeesRub;

  return {
    success: true,
    japanTotalRub,
    freightRub,
    customsDutyRub,
    utilFeeRub,
    fixedFeesRub,
    finalTotalRub,
    sanctioned,
    appliedRates: {
      JPY: Math.round(JPY_BANK * RATE_PRECISION) / RATE_PRECISION,
      USD: Math.round(USD_BANK * RATE_PRECISION) / RATE_PRECISION,
      EUR: Math.round(EUR_CBR * RATE_PRECISION) / RATE_PRECISION,
    },
  };
}

// Sub-module re-exports so callers that want a specific helper (e.g. the
// sanctions test in a future Vitest suite) don't have to reach past the barrel.
export type {
  CalcParams,
  CalcResult,
  CalcSuccess,
  CalcHumanRequired,
  FuelType,
  CbrRates,
} from './types';
export { isSanctionedVehicle } from './sanctions';
export { fetchCbrRates, CBR_URL, BANK_SPREAD } from './currency';
