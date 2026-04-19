/**
 * Shared zod schema + types for the turnkey calculator.
 *
 * Lives here so the client form, the `/api/calculator` route handler, the
 * URL state helper, and tests all reference one contract — same spirit as
 * `lib/auction/schemas.ts`.
 */

import { z } from "zod";

/**
 * Fuel types accepted by the form. The calculator's @auto/shared contract
 * only recognises 'ice' | 'hybrid' | 'electric'; we surface 'diesel' to
 * customers (it's a common RU mental model) but collapse it to 'ice' when
 * calling the shared calculator, because customs/sanctions rules treat
 * diesels as plain ICE.
 */
export const calcFuelSchema = z.enum(["ice", "hybrid", "electric", "diesel"]);
export type CalcFormFuel = z.infer<typeof calcFuelSchema>;

export const calcVehicleTypeSchema = z.enum(["car", "jeep", "moto"]);
export type CalcFormVehicleType = z.infer<typeof calcVehicleTypeSchema>;

/**
 * Client + server input contract. Age is expressed as a number of years —
 * UI collects either a year or an age-window radio and normalizes.
 */
export const calculatorInputSchema = z
  .object({
    vehicleType: calcVehicleTypeSchema,
    volumeCm3: z.number().int().min(0).max(10_000),
    ageYears: z.number().int().min(0).max(40),
    fuelType: calcFuelSchema,
    isVan: z.boolean(),
    priceJpyLow: z.number().int().min(0),
    priceJpyHigh: z.number().int().min(0),
    isForResale: z.boolean(),
    isLegalEntity: z.boolean(),
  })
  .refine((v) => v.priceJpyHigh >= v.priceJpyLow, {
    path: ["priceJpyHigh"],
    message: "Верхняя граница должна быть не меньше нижней",
  })
  .refine((v) => v.fuelType !== "electric" || v.volumeCm3 === 0, {
    path: ["volumeCm3"],
    message: "Для электромобиля объём должен быть 0",
  });

export type CalculatorInput = z.infer<typeof calculatorInputSchema>;

/**
 * Success response: both price legs plus meta derived from either leg.
 * `low` and `high` are the raw @auto/shared CalcResult objects, unwrapped
 * to their success shape only — the route handler surfaces requireHuman
 * in the top-level `requiresOperator` flag instead.
 */
export const calcLegSchema = z.object({
  japanTotalRub: z.number().int().nonnegative(),
  freightRub: z.number().int().nonnegative(),
  customsDutyRub: z.number().int().nonnegative(),
  utilFeeRub: z.number().int().nonnegative(),
  fixedFeesRub: z.number().int().nonnegative(),
  finalTotalRub: z.number().int().nonnegative(),
  appliedRates: z.object({
    JPY: z.number(),
    USD: z.number(),
    EUR: z.number(),
  }),
});
export type CalcLeg = z.infer<typeof calcLegSchema>;

export const calculatorResultSchema = z.discriminatedUnion("requiresOperator", [
  z.object({
    requiresOperator: z.literal(false),
    sanctioned: z.boolean(),
    low: calcLegSchema,
    high: calcLegSchema,
  }),
  z.object({
    requiresOperator: z.literal(true),
    reason: z.string(),
  }),
]);
export type CalculatorResult = z.infer<typeof calculatorResultSchema>;
