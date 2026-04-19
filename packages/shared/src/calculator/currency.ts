/**
 * CBR daily-rates fetch. Kept as a separate module so the web app can mock or
 * swap it out without touching calculator internals.
 */

import type { CbrRates } from './types';

export const CBR_URL = 'https://www.cbr-xml-daily.ru/daily_json.js';

/**
 * Bank-side FX spread applied to CBR rates. Same spread for JPY and USD legs.
 */
export const BANK_SPREAD = 1.04;

interface CbrCurrency {
  Value: number;
  Nominal: number;
}

interface CbrResponse {
  Valute: Record<string, CbrCurrency>;
}

export async function fetchCbrRates(): Promise<CbrRates> {
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
