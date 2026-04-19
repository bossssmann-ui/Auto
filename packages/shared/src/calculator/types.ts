/**
 * Calculator type definitions. Shared between bot and web.
 *
 * ⚠ These types are the public contract of `@auto/shared`. Do not add, rename,
 * or reorder fields without coordinating with every consumer — the bot stores
 * some of these values in conversation state and on disk.
 */

export type FuelType = 'ice' | 'hybrid' | 'electric';

export interface CalcParams {
  vehicleType: 'car' | 'jeep' | 'moto' | 'special' | 'special_vehicle';
  priceJPY: number;
  volumeCm3: number;
  ageYears: number;
  isForResale: boolean;
  isLegalEntity: boolean;
  // Sanctions classification (Japan → Russia export ban since Aug 2023).
  // Optional for backward compatibility; when omitted, treated as 'ice' / non-VAN.
  fuelType?: FuelType;
  isVan?: boolean;
}

export interface CalcSuccess {
  success: true;
  japanTotalRub: number;
  freightRub: number;
  customsDutyRub: number;
  utilFeeRub: number;
  fixedFeesRub: number;
  finalTotalRub: number;
  sanctioned: boolean;
  appliedRates: { JPY: number; USD: number; EUR: number };
}

export interface CalcHumanRequired {
  success: false;
  requireHuman: true;
  message: string;
}

export type CalcResult = CalcSuccess | CalcHumanRequired;

export interface CbrRates {
  JPY_CBR: number;
  USD_CBR: number;
  EUR_CBR: number;
}
