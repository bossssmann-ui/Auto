/**
 * Zod schemas for the auction data layer.
 *
 * We parse at **two** boundaries:
 *
 *   1. `rawLotSchema` / `rawBrandSchema` — whatever a concrete provider hands
 *      back (mock fixtures today, a real JSON API tomorrow). We tolerate
 *      partial data here: `mileageKm`, `trim`, `photos` and similar fields
 *      are optional so reality doesn't crash the app.
 *
 *   2. `lotListItemSchema` / `lotDetailSchema` — the normalized view-model
 *      the UI consumes. Defined precisely; mappers that produce it bad get
 *      caught by tests, not by users.
 *
 * Types are derived from schemas via `z.infer` in `./domain.ts` so there is
 * exactly one source of truth per shape.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export const brandSlugSchema = z
  .string()
  .min(1)
  .max(32)
  .regex(/^[a-z0-9-]+$/, "Slugs must be kebab-case ASCII");

export const fuelTypeSchema = z.enum(["ice", "hybrid", "electric", "diesel"]);

export const ageWindowSchema = z.enum([
  "passable",
  "non_passable_under3",
  "non_passable_over5",
]);

export const sortSchema = z.enum([
  "price_asc",
  "price_desc",
  "newest",
  "ending_soon",
]);

// ---------------------------------------------------------------------------
// RAW schemas (provider boundary)
// ---------------------------------------------------------------------------

export const rawBrandSchema = z.object({
  slug: brandSlugSchema,
  name: z.string().min(1),
  models: z
    .array(
      z.object({
        slug: brandSlugSchema,
        name: z.string().min(1),
        generations: z
          .array(
            z.object({
              slug: brandSlugSchema,
              name: z.string().min(1),
              years: z.tuple([z.number().int(), z.number().int().nullable()]),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
});

export const rawLotSchema = z.object({
  /** Provider-assigned stable id. Real APIs use their auction+lot number. */
  lot_id: z.string().min(1),
  auction: z.string().min(1),
  brand: brandSlugSchema,
  model: brandSlugSchema,
  generation: brandSlugSchema.optional(),
  year: z.number().int().min(1980).max(2100),
  mileage_km: z.number().int().min(0).optional(),
  body_type: z
    .enum(["sedan", "suv", "wagon", "van", "hatchback", "coupe", "pickup", "moto", "special"])
    .default("sedan"),
  fuel: fuelTypeSchema.default("ice"),
  engine_cc: z.number().int().min(0).max(10_000),
  transmission: z.enum(["at", "mt", "cvt", "dct", "amt", "unknown"]).default("unknown"),
  drive: z.enum(["fwd", "rwd", "awd", "4wd", "unknown"]).default("unknown"),
  color: z.string().min(1).optional(),
  grade: z.number().min(0).max(6).optional(),
  auction_price_jpy: z.number().int().min(0),
  auction_date: z.string().optional(),
  photos: z.array(z.string().url().or(z.string().startsWith("/"))).default([]),
  trim: z.string().optional(),
  /**
   * Force human-only review regardless of sanctions / moto logic. Used by the
   * fixtures to exercise the "flagged record" case explicitly — matches the
   * `requireHuman` shape of `calculateTurnkeyPrice`.
   */
  require_human: z.boolean().optional(),
  human_reason: z.string().optional(),
});

export const rawLotListSchema = z.array(rawLotSchema);
export const rawBrandListSchema = z.array(rawBrandSchema);

// ---------------------------------------------------------------------------
// VIEW-MODEL schemas (UI boundary)
// ---------------------------------------------------------------------------

export const priceRangeRubSchema = z.object({
  low: z.number().int().nonnegative(),
  high: z.number().int().nonnegative(),
});

export const lotSummarySchema = z.object({
  id: z.string(),
  slug: z.string(), // URL-safe combined slug for nicer links if needed
  brandSlug: brandSlugSchema,
  modelSlug: brandSlugSchema,
  generationSlug: brandSlugSchema.optional(),
  title: z.string(), // e.g. "Toyota Harrier Z 2.5 Hybrid"
  year: z.number().int(),
  mileageKm: z.number().int().nonnegative().nullable(),
  auctionGrade: z.number().nullable(),
  volumeCm3: z.number().int().nonnegative(),
  fuelType: fuelTypeSchema,
  bodyType: rawLotSchema.shape.body_type,
  auctionPriceJpy: z.number().int().nonnegative(),
  thumbnail: z.string().nullable(),
  /** `null` when `requiresOperator` is true. */
  priceRangeRub: priceRangeRubSchema.nullable(),
  /** True for sanctioned / moto > 600k / `special` vehicles. */
  requiresOperator: z.boolean(),
  /** Human-readable reason the UI can show in the operator card. */
  operatorReason: z.string().nullable(),
});

export const lotDetailSchema = lotSummarySchema.extend({
  auction: z.string(),
  auctionDate: z.string().nullable(),
  color: z.string().nullable(),
  transmission: rawLotSchema.shape.transmission,
  drive: rawLotSchema.shape.drive,
  trim: z.string().nullable(),
  photos: z.array(z.string()),
});

export const brandSchema = z.object({
  slug: brandSlugSchema,
  name: z.string(),
  modelCount: z.number().int().nonnegative(),
});

export const modelSchema = z.object({
  slug: brandSlugSchema,
  name: z.string(),
  brandSlug: brandSlugSchema,
  generationCount: z.number().int().nonnegative(),
});

export const generationSchema = z.object({
  slug: brandSlugSchema,
  name: z.string(),
  brandSlug: brandSlugSchema,
  modelSlug: brandSlugSchema,
  yearsFrom: z.number().int(),
  yearsTo: z.number().int().nullable(),
});

export const paginatedLotsSchema = z.object({
  items: z.array(lotSummarySchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().nonnegative(),
});

// ---------------------------------------------------------------------------
// Search params (UI → provider)
// ---------------------------------------------------------------------------

export const lotSearchParamsSchema = z
  .object({
    brand: brandSlugSchema.optional(),
    model: brandSlugSchema.optional(),
    generation: brandSlugSchema.optional(),
    ageWindow: ageWindowSchema.optional(),
    fuelType: fuelTypeSchema.optional(),
    volumeCm3Min: z.number().int().nonnegative().optional(),
    volumeCm3Max: z.number().int().nonnegative().optional(),
    priceJpyMin: z.number().int().nonnegative().optional(),
    priceJpyMax: z.number().int().nonnegative().optional(),
    auctionGradeMin: z.number().min(0).max(6).optional(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(60).default(12),
    sort: sortSchema.default("newest"),
  })
  .strict();
