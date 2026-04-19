/**
 * Public barrel for the auction data layer.
 *
 * Pages and components should import from `@/lib/auction`. They must NOT
 * import from `./providers/*`, `./schemas`, or any fixture directly — those
 * are implementation details that will change when the real API lands.
 */

export {
  getLot,
  listAllCategoryPaths,
  listAllLotIds,
  listBrands,
  listGenerations,
  listModels,
  searchLots,
} from "./client";

export type {
  AgeWindow,
  Brand,
  FuelType,
  Generation,
  LotDetail,
  LotListItem,
  LotSearchParams,
  Model,
  Paginated,
  PaginatedLots,
  PriceRangeRub,
  Sort,
} from "./domain";

export { AuctionProviderError } from "./provider";
