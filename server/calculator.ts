export interface CalcParams {
  vehicleType: 'car' | 'jeep' | 'moto' | 'special' | 'special_vehicle';
  priceJPY: number;
  volumeCm3: number;
  ageYears: number;
  isForResale: boolean;
  isLegalEntity: boolean;
  fuelType?: 'gasoline' | 'hybrid' | 'diesel' | 'ev' | 'phev' | null;
}

interface CalcSuccess {
  success: true;
  japanTotalRub: number;
  freightRub: number;
  customsDutyRub: number;
  utilFeeRub: number;
  fixedFeesRub: number;
  finalTotalRub: number;
  isSanctioned: boolean;
  appliedRates: { JPY: number; USD: number; EUR: number };
}

interface CalcHumanRequired {
  success: false;
  requireHuman: true;
  message: string;
}

export type CalcResult = CalcSuccess | CalcHumanRequired;

const CBR_URL = 'https://www.cbr-xml-daily.ru/daily_json.js';
const BANK_SPREAD = 1.04;

const INLAND_JPY: Record<string, number> = {
  car: 80_000,
  jeep: 120_000,
  moto: 60_000,
};

const FREIGHT_USD: Record<string, number> = {
  car: 400,
  jeep: 500,
  moto: 300,
};

// Sanctions freight: vehicles with ICE >1900cc, all hybrids, and all EVs
// are banned from direct Japan→Russia export since August 2023.
// They go via third countries at higher fixed freight rates.
const SANCTIONS_FREIGHT_USD: Record<string, number> = {
  car: 3500,
  jeep: 4000,  // SUVs, full-size minivans (Alphard-class), large buses
  moto: 300,   // motorcycles are not sanctioned
};

const SANCTIONS_VOLUME_THRESHOLD_CM3 = 1900;

/**
 * Determine if a vehicle is sanctioned under Japan's August 2023 export ban.
 * Sanctioned = all hybrids, all EVs/PHEVs, or ICE with volume > 1900 cc.
 */
export function isSanctionedVehicle(
  volumeCm3: number,
  fuelType?: string | null,
): boolean {
  // All hybrids and EVs are sanctioned regardless of engine volume
  if (fuelType === 'hybrid' || fuelType === 'ev' || fuelType === 'phev') {
    return true;
  }
  // ICE vehicles with volume > 1900 cc are sanctioned
  return volumeCm3 > SANCTIONS_VOLUME_THRESHOLD_CM3;
}

const FIXED_FEES_RUB = 185_000;

const EXPORT_TAX_RATE = 0.10;

const COMMERCIAL_VOLUME_THRESHOLD_CM3 = 3000;

const RATE_PRECISION = 10_000;

interface CbrCurrency {
  Value: number;
  Nominal: number;
}

interface CbrResponse {
  Valute: Record<string, CbrCurrency>;
}

async function fetchCbrRates(): Promise<{ JPY_CBR: number; USD_CBR: number; EUR_CBR: number }> {
  const res = await fetch(CBR_URL);
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

function calcCustomsDutyEur(priceEur: number, volumeCm3: number, ageYears: number): number {
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

function calcRecyclingFee(
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

function calcMotoDutyEur(): number {
  return 0;
}

export async function calculateTurnkeyPrice(params: CalcParams): Promise<CalcResult> {
  const { vehicleType, priceJPY, volumeCm3, ageYears, isForResale, isLegalEntity, fuelType } = params;

  if (vehicleType === 'special' || vehicleType === 'special_vehicle') {
    return {
      success: false,
      requireHuman: true,
      message: 'Расчёт спецтехники и авто с нестандартной логистикой только по запросу. Перевожу на оператора.',
    };
  }

  const { JPY_CBR, USD_CBR, EUR_CBR } = await fetchCbrRates();

  const JPY_BANK = JPY_CBR * BANK_SPREAD;
  const USD_BANK = USD_CBR * BANK_SPREAD;

  const inlandJpy = INLAND_JPY[vehicleType] ?? INLAND_JPY['car'];
  const priceWithExport = priceJPY * (1 + EXPORT_TAX_RATE);
  const japanTotalJpy = priceWithExport + inlandJpy;
  const japanTotalRub = Math.round(japanTotalJpy * JPY_BANK);

  // Sanctions check: hybrids, EVs, and ICE >1900cc go via third countries
  const sanctioned = vehicleType !== 'moto' && isSanctionedVehicle(volumeCm3, fuelType);
  const freightTable = sanctioned ? SANCTIONS_FREIGHT_USD : FREIGHT_USD;
  const freightUsd = freightTable[vehicleType] ?? freightTable['car'];
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
    isSanctioned: sanctioned,
    appliedRates: {
      JPY: Math.round(JPY_BANK * RATE_PRECISION) / RATE_PRECISION,
      USD: Math.round(USD_BANK * RATE_PRECISION) / RATE_PRECISION,
      EUR: Math.round(EUR_CBR * RATE_PRECISION) / RATE_PRECISION,
    },
  };
}
