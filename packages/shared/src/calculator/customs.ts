/**
 * Customs duty + recycling-fee (утильсбор) tables.
 *
 * ⚠ Every number in this file must match the public Russian customs
 * regulations in force at the time it was last reviewed. Do not change any
 * threshold, rate, or bracket without a linked source.
 */

import type { CalcParams } from './types';

/**
 * Above this engine volume a vehicle is treated as commercial for the
 * recycling-fee schedule — regardless of buyer legal form.
 */
const COMMERCIAL_VOLUME_THRESHOLD_CM3 = 3000;

export function calcCustomsDutyEur(
  priceEur: number,
  volumeCm3: number,
  ageYears: number,
): number {
  if (ageYears <= 3) {
    return calcDutyNew(priceEur, volumeCm3);
  }
  if (ageYears <= 5) {
    return calcDutyMid(volumeCm3);
  }
  return calcDutyOld(volumeCm3);
}

function calcDutyNew(priceEur: number, volumeCm3: number): number {
  let pct: number;
  let minPerCm3: number;

  if (priceEur <= 8500) {
    pct = 0.54;
    minPerCm3 = 2.5;
  } else if (priceEur <= 16700) {
    pct = 0.48;
    minPerCm3 = 3.5;
  } else if (priceEur <= 42300) {
    pct = 0.48;
    minPerCm3 = 5.5;
  } else if (priceEur <= 84500) {
    pct = 0.48;
    minPerCm3 = 7.5;
  } else {
    pct = 0.48;
    minPerCm3 = 20;
  }

  const byPercent = priceEur * pct;
  const byVolume = volumeCm3 * minPerCm3;
  return Math.max(byPercent, byVolume);
}

function calcDutyMid(volumeCm3: number): number {
  let ratePerCm3: number;

  if (volumeCm3 <= 1000) {
    ratePerCm3 = 1.5;
  } else if (volumeCm3 <= 1500) {
    ratePerCm3 = 1.7;
  } else if (volumeCm3 <= 1800) {
    ratePerCm3 = 2.5;
  } else if (volumeCm3 <= 2300) {
    ratePerCm3 = 2.7;
  } else if (volumeCm3 <= 3000) {
    ratePerCm3 = 3.0;
  } else {
    ratePerCm3 = 3.6;
  }

  return volumeCm3 * ratePerCm3;
}

function calcDutyOld(volumeCm3: number): number {
  let ratePerCm3: number;

  if (volumeCm3 <= 1000) {
    ratePerCm3 = 3.0;
  } else if (volumeCm3 <= 1500) {
    ratePerCm3 = 3.2;
  } else if (volumeCm3 <= 1800) {
    ratePerCm3 = 3.5;
  } else if (volumeCm3 <= 2300) {
    ratePerCm3 = 4.8;
  } else if (volumeCm3 <= 3000) {
    ratePerCm3 = 5.0;
  } else {
    ratePerCm3 = 5.7;
  }

  return volumeCm3 * ratePerCm3;
}

export function calcRecyclingFee(
  vehicleType: CalcParams['vehicleType'],
  volumeCm3: number,
  ageYears: number,
  isLegalEntity: boolean,
  isForResale: boolean,
): number {
  if (vehicleType === 'moto') return 0;

  const isCommercial = isLegalEntity || isForResale || volumeCm3 >= COMMERCIAL_VOLUME_THRESHOLD_CM3;

  if (isCommercial) {
    return commercialRecyclingFee(volumeCm3, ageYears);
  }

  return ageYears <= 3 ? 3400 : 5200;
}

function commercialRecyclingFee(volumeCm3: number, ageYears: number): number {
  if (ageYears <= 3) {
    if (volumeCm3 < 1000) return 81_200;
    if (volumeCm3 <= 2000) return 306_000;
    if (volumeCm3 <= 3000) return 844_800;
    if (volumeCm3 <= 3500) return 970_000;
    return 1_235_200;
  }

  if (volumeCm3 < 1000) return 207_200;
  if (volumeCm3 <= 2000) return 528_800;
  if (volumeCm3 <= 3000) return 1_150_000;
  if (volumeCm3 <= 3500) return 1_485_000;
  return 1_623_800;
}

export function calcMotoDutyEur(): number {
  return 0;
}
