/**
 * View-model formatting helpers for the catalog layer.
 * Everything is RU-locale so the UI stays consistent.
 */

import type { FuelType, LotListItem, PriceRangeRub } from "@/lib/auction";

const RUB = new Intl.NumberFormat("ru-RU");

export function formatRub(value: number): string {
  return `${RUB.format(value)} ₽`;
}

export function formatJpy(value: number): string {
  return `${RUB.format(value)} ¥`;
}

export function formatKm(value: number | null): string | null {
  if (value === null) return null;
  return `${RUB.format(value)} км`;
}

export function formatPriceRangeRub(range: PriceRangeRub | null): string | null {
  if (!range) return null;
  return `${formatRub(range.low)} — ${formatRub(range.high)}`;
}

export function fuelLabel(f: FuelType): string {
  switch (f) {
    case "ice":
      return "Бензин";
    case "hybrid":
      return "Гибрид";
    case "electric":
      return "Электро";
    case "diesel":
      return "Дизель";
  }
}

export function volumeLabel(cm3: number): string {
  if (cm3 === 0) return "EV";
  return `${(cm3 / 1000).toFixed(1)} л`;
}

export function lotSummary(lot: LotListItem): string {
  const bits = [
    String(lot.year),
    volumeLabel(lot.volumeCm3),
    fuelLabel(lot.fuelType),
  ];
  const km = formatKm(lot.mileageKm);
  if (km) bits.push(km);
  if (lot.auctionGrade !== null) bits.push(`grade ${lot.auctionGrade}`);
  return bits.join(" · ");
}
