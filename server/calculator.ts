// Standalone customs calculator module
// Replicates the official Russian Customs Calculator (tks.ru) for importing vehicles from Japan

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CalcParams {
  vehicleType: 'car' | 'jeep' | 'moto' | 'special' | 'sanctioned';
  priceJPY: number;
  volumeCm3: number;
  ageYears: number;
  isForResale: boolean;
  isLegalEntity: boolean;
}

interface CalcSuccess {
  success: true;
  japanTotalRub: number;
  freightRub: number;
  customsDutyRub: number;
  utilFeeRub: number;
  fixedFeesRub: number;
  finalTotalRub: number;
  appliedRates: { JPY: number; USD: number; EUR: number };
}

interface CalcHumanRequired {
  success: false;
  requireHuman: true;
  message: string;
}

export type CalcResult = CalcSuccess | CalcHumanRequired;

// ── Constants ──────────────────────────────────────────────────────────────────

const CBR_URL = 'https://www.cbr-xml-daily.ru/daily_json.js';
const BANK_SPREAD = 1.04; // +4% spread when buying currency

/** Inland Japan logistics cost (JPY) */
const INLAND_JPY: Record<string, number> = {
  car: 80_000,
  jeep: 120_000,
  moto: 60_000,
};

/** Sea freight cost (USD) */
const FREIGHT_USD: Record<string, number> = {
  car: 400,
  jeep: 500,
  moto: 300,
};

/** Fixed Russian fees (SVH + SBKTS + Broker + Agent + SWIFT), RUB */
const FIXED_FEES_RUB = 185_000;

/** Export tax rate applied in Japan */
const EXPORT_TAX_RATE = 0.10;

// ── CBR Exchange Rates ─────────────────────────────────────────────────────────

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

// ── EAEU Customs Duty ──────────────────────────────────────────────────────────

function calcCustomsDutyEur(priceEur: number, volumeCm3: number, ageYears: number): number {
  if (ageYears <= 3) {
    return calcDutyNew(priceEur, volumeCm3);
  }
  if (ageYears <= 5) {
    return calcDutyMid(volumeCm3);
  }
  return calcDutyOld(volumeCm3);
}

/** Age ≤ 3 years: percentage of value with minimum per cm³ */
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

/** Age 3–5 years: strictly by volume */
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

/** Age > 5 years: strictly by volume (higher rates) */
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

// ── Recycling Fee (Утильсбор) ──────────────────────────────────────────────────

function calcRecyclingFee(
  vehicleType: CalcParams['vehicleType'],
  volumeCm3: number,
  ageYears: number,
  isLegalEntity: boolean,
  isForResale: boolean,
): number {
  if (vehicleType === 'moto') return 0;

  const isCommercial = isLegalEntity || isForResale || volumeCm3 >= 3000;

  if (isCommercial) {
    return commercialRecyclingFee(volumeCm3, ageYears);
  }

  // Personal rate
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

  // ageYears > 3
  if (volumeCm3 < 1000) return 207_200;
  if (volumeCm3 <= 2000) return 528_800;
  if (volumeCm3 <= 3000) return 1_150_000;
  if (volumeCm3 <= 3500) return 1_485_000;
  return 1_623_800;
}

// ── Moto Customs Duty (flat 0% for simplification placeholder) ─────────────────

function calcMotoDutyEur(priceEur: number, volumeCm3: number): number {
  // Motorcycles use a simplified flat duty of 0% + per-cm3 rates are not
  // defined in the EAEU grid provided. We apply the same logic as cars for
  // consistency with the calculator spec (the spec only provides car/jeep grids).
  // For moto, many calculators use a flat 10-20% rate or specific tables.
  // Since the spec doesn't detail moto grids, we fall back to 0 (freight only).
  void priceEur;
  void volumeCm3;
  return 0;
}

// ── Main Calculator ────────────────────────────────────────────────────────────

export async function calculateTurnkeyPrice(params: CalcParams): Promise<CalcResult> {
  const { vehicleType, priceJPY, volumeCm3, ageYears, isForResale, isLegalEntity } = params;

  // Exception: special & sanctioned vehicles
  if (vehicleType === 'special' || vehicleType === 'sanctioned') {
    return {
      success: false,
      requireHuman: true,
      message: 'Расчет спецтехники и санкционных авто только по запросу. Перевожу на оператора.',
    };
  }

  // Fetch live CBR rates
  const { JPY_CBR, USD_CBR, EUR_CBR } = await fetchCbrRates();

  // Bank spread rates (used for converting actual cash costs)
  const JPY_BANK = JPY_CBR * BANK_SPREAD;
  const USD_BANK = USD_CBR * BANK_SPREAD;

  // ── Japan-side costs ──────────────────────────────────────────────────────
  const inlandJpy = INLAND_JPY[vehicleType] ?? INLAND_JPY['car'];
  const priceWithExport = priceJPY * (1 + EXPORT_TAX_RATE);
  const japanTotalJpy = priceWithExport + inlandJpy;
  const japanTotalRub = Math.round(japanTotalJpy * JPY_BANK);

  // ── Freight ───────────────────────────────────────────────────────────────
  const freightUsd = FREIGHT_USD[vehicleType] ?? FREIGHT_USD['car'];
  const freightRub = Math.round(freightUsd * USD_BANK);

  // ── Customs Duty ──────────────────────────────────────────────────────────
  // Customs value in EUR (strict CBR rate, no spread)
  const customsValueEur = (priceJPY * JPY_CBR) / EUR_CBR;

  let dutyEur: number;
  if (vehicleType === 'moto') {
    dutyEur = calcMotoDutyEur(customsValueEur, volumeCm3);
  } else {
    dutyEur = calcCustomsDutyEur(customsValueEur, volumeCm3, ageYears);
  }

  const customsDutyRub = Math.round(dutyEur * EUR_CBR);

  // ── Recycling Fee (Утильсбор) ─────────────────────────────────────────────
  const utilFeeRub = calcRecyclingFee(vehicleType, volumeCm3, ageYears, isLegalEntity, isForResale);

  // ── Fixed Fees ────────────────────────────────────────────────────────────
  const fixedFeesRub = FIXED_FEES_RUB;

  // ── Total ─────────────────────────────────────────────────────────────────
  const finalTotalRub = japanTotalRub + freightRub + customsDutyRub + utilFeeRub + fixedFeesRub;

  return {
    success: true,
    japanTotalRub,
    freightRub,
    customsDutyRub,
    utilFeeRub,
    fixedFeesRub,
    finalTotalRub,
    appliedRates: {
      JPY: Math.round(JPY_BANK * 10000) / 10000,
      USD: Math.round(USD_BANK * 10000) / 10000,
      EUR: Math.round(EUR_CBR * 10000) / 10000,
    },
  };
}
