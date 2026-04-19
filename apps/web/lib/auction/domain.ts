/**
 * Public domain types — all inferred from the zod schemas so nothing drifts.
 * Components and pages should import from here, not from `./schemas`.
 */

import type { z } from "zod";
import type {
  brandSchema,
  generationSchema,
  lotDetailSchema,
  lotSearchParamsSchema,
  lotSummarySchema,
  modelSchema,
  paginatedLotsSchema,
  priceRangeRubSchema,
  rawBrandSchema,
  rawLotSchema,
  ageWindowSchema,
  fuelTypeSchema,
  sortSchema,
} from "./schemas";

export type Brand = z.infer<typeof brandSchema>;
export type Model = z.infer<typeof modelSchema>;
export type Generation = z.infer<typeof generationSchema>;

export type LotListItem = z.infer<typeof lotSummarySchema>;
export type LotDetail = z.infer<typeof lotDetailSchema>;
export type PriceRangeRub = z.infer<typeof priceRangeRubSchema>;

export type LotSearchParams = z.input<typeof lotSearchParamsSchema>;
export type LotSearchParamsParsed = z.output<typeof lotSearchParamsSchema>;

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export type PaginatedLots = z.infer<typeof paginatedLotsSchema>;

export type AgeWindow = z.infer<typeof ageWindowSchema>;
export type FuelType = z.infer<typeof fuelTypeSchema>;
export type Sort = z.infer<typeof sortSchema>;

export type RawLot = z.infer<typeof rawLotSchema>;
export type RawBrand = z.infer<typeof rawBrandSchema>;
