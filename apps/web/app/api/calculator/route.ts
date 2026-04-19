/**
 * POST /api/calculator — server-side wrapper around `calculateTurnkeyPrice`.
 *
 * Why server-side instead of calling `@auto/shared` directly from the client:
 *   - `calculateTurnkeyPrice` calls `fetchCbrRates()` which hits an external
 *     CBR-mirror endpoint. Keeping that fetch server-side avoids CORS
 *     sensitivity and lets the platform cache the response.
 *   - It's the only place the web app invokes the calculator, which mirrors
 *     how `lib/auction/mappers.ts` is the only mapper → calculator caller
 *     (spec §7.2 — no direct imports from pages/components).
 *
 * The route is called twice-internally to produce the "from X ₽ to Y ₽"
 * range the bot's «ВИЛКА ЦЕНЫ» block also emits (spec §7.6.2).
 */

import { NextResponse } from "next/server";
import {
  calculateTurnkeyPrice,
  isSanctionedVehicle,
  type CalcParams,
  type CalcResult,
  type FuelType,
} from "@auto/shared";
import {
  calculatorInputSchema,
  type CalculatorInput,
  type CalculatorResult,
} from "@/lib/calculator-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Collapse the UI fuel alias (`diesel`) to the shared-contract ones. */
function normalizeFuel(fuel: CalculatorInput["fuelType"]): FuelType {
  return fuel === "diesel" ? "ice" : fuel;
}

function toCalcParams(input: CalculatorInput, priceJPY: number): CalcParams {
  return {
    vehicleType: input.vehicleType,
    priceJPY,
    volumeCm3: input.volumeCm3,
    ageYears: input.ageYears,
    isForResale: input.isForResale,
    isLegalEntity: input.isLegalEntity,
    fuelType: normalizeFuel(input.fuelType),
    isVan: input.isVan,
  };
}

function extractLeg(res: CalcResult) {
  if (!res.success) return null;
  return {
    japanTotalRub: res.japanTotalRub,
    freightRub: res.freightRub,
    customsDutyRub: res.customsDutyRub,
    utilFeeRub: res.utilFeeRub,
    fixedFeesRub: res.fixedFeesRub,
    finalTotalRub: res.finalTotalRub,
    appliedRates: res.appliedRates,
  };
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json" },
      { status: 400 },
    );
  }

  const parsed = calculatorInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // Operator-required cases per spec §7.6.3: sanctioned vehicles, special
  // vehicles (calculator rejects these itself), and moto > 600 000 ¥. The
  // client pre-checks these too, but we enforce server-side so a direct API
  // call can't bypass the rule.
  const sanctioned = isSanctionedVehicle(
    input.vehicleType,
    input.volumeCm3,
    normalizeFuel(input.fuelType),
    input.isVan,
  );

  if (sanctioned) {
    const result: CalculatorResult = {
      requiresOperator: true,
      reason:
        "Это санкционный автомобиль (Япония → РФ с августа 2023). Индивидуальный фрахт — расчёт и подтверждение через оператора.",
    };
    return NextResponse.json(result, { status: 200 });
  }

  let lowRes: CalcResult;
  let highRes: CalcResult;
  try {
    [lowRes, highRes] = await Promise.all([
      calculateTurnkeyPrice(toCalcParams(input, input.priceJpyLow)),
      calculateTurnkeyPrice(toCalcParams(input, input.priceJpyHigh)),
    ]);
  } catch {
    // CBR API unreachable, etc. Fail open to operator (graceful degradation,
    // same pattern mapLotSummary uses — see repo memory "mapper operator-
    // required rules").
    const result: CalculatorResult = {
      requiresOperator: true,
      reason:
        "Курсы ЦБ временно недоступны. Уточните расчёт у оператора — ответим в течение нескольких минут.",
    };
    return NextResponse.json(result, { status: 200 });
  }

  if (!lowRes.success || !highRes.success) {
    // moto > 600k ¥ or special — both legs return requireHuman.
    const message =
      (!lowRes.success && lowRes.message) ||
      (!highRes.success && highRes.message) ||
      "Этот расчёт мы подтверждаем вручную. Передаю оператору.";
    const result: CalculatorResult = {
      requiresOperator: true,
      reason: message,
    };
    return NextResponse.json(result, { status: 200 });
  }

  const low = extractLeg(lowRes);
  const high = extractLeg(highRes);
  if (!low || !high) {
    // Unreachable given the success check above, but keep the type story tight.
    const result: CalculatorResult = {
      requiresOperator: true,
      reason: "Расчёт недоступен. Передаю оператору.",
    };
    return NextResponse.json(result, { status: 200 });
  }

  const result: CalculatorResult = {
    requiresOperator: false,
    sanctioned: lowRes.sanctioned || highRes.sanctioned,
    low,
    high,
  };
  return NextResponse.json(result, { status: 200 });
}
