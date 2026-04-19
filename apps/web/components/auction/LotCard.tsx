import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { BentoTile } from "@/components/BentoTile";
import type { LotListItem } from "@/lib/auction";
import { formatPriceRangeRub, lotSummary } from "@/lib/format";

interface LotCardProps {
  lot: LotListItem;
  colSpan?: 3 | 4 | 6 | 8 | 12;
  rowSpan?: 1 | 2;
}

/**
 * Catalog-level card. Consumes only `LotListItem` — never the raw fixture.
 * When `requiresOperator` is true we show the operator CTA instead of a
 * number, per the data-layer contract.
 */
export function LotCard({ lot, colSpan = 4, rowSpan = 1 }: LotCardProps) {
  return (
    <BentoTile colSpan={colSpan} rowSpan={rowSpan} interactive>
      <Link
        href={`/lot/${lot.id}`}
        className="flex h-full flex-col justify-between"
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="label">JDM · {lot.bodyType}</span>
            {lot.auctionGrade !== null && (
              <Badge variant="outline" className="font-normal">
                grade {lot.auctionGrade}
              </Badge>
            )}
            {lot.requiresOperator && (
              <Badge variant="outline" className="font-normal">
                Оператор
              </Badge>
            )}
          </div>
          <h3 className="mt-4 font-display text-xl font-semibold">{lot.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{lotSummary(lot)}</p>
        </div>
        <div className="mt-6">
          <p className="label">Под ключ в РФ</p>
          {lot.requiresOperator ? (
            <p className="mt-1 font-display text-base font-medium">
              Цена по запросу
            </p>
          ) : (
            <p className="font-display text-xl font-semibold tabular-nums">
              {formatPriceRangeRub(lot.priceRangeRub)}
            </p>
          )}
        </div>
      </Link>
    </BentoTile>
  );
}
