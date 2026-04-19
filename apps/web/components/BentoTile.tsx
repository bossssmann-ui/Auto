import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A single tile inside <BentoGrid>. Spans are expressed in **12-col units**
 * and only applied at `lg`. At smaller breakpoints tiles take a sensible
 * half/full width (handled by the caller via `className` if needed).
 *
 * Tile padding: `p-4` mobile → `p-6` tablet → `p-8` desktop (spec §4.2).
 */
type Span = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

interface BentoTileProps extends React.ComponentProps<"div"> {
  colSpan?: Span;
  rowSpan?: 1 | 2 | 3;
  /** Render as an interactive tile — adds a hover-only shadow-sm per §4.1. */
  interactive?: boolean;
}

// Tailwind cannot resolve dynamic class names, so we map spans to
// concrete strings at build time.
const COL_SPAN: Record<Span, string> = {
  1: "lg:col-span-1",
  2: "col-span-2 lg:col-span-2",
  3: "col-span-2 md:col-span-3 lg:col-span-3",
  4: "col-span-2 md:col-span-3 lg:col-span-4",
  5: "col-span-2 md:col-span-4 lg:col-span-5",
  6: "col-span-2 md:col-span-6 lg:col-span-6",
  7: "col-span-2 md:col-span-6 lg:col-span-7",
  8: "col-span-2 md:col-span-6 lg:col-span-8",
  9: "col-span-2 md:col-span-6 lg:col-span-9",
  10: "col-span-2 md:col-span-6 lg:col-span-10",
  11: "col-span-2 md:col-span-6 lg:col-span-11",
  12: "col-span-2 md:col-span-6 lg:col-span-12",
};

const ROW_SPAN: Record<NonNullable<BentoTileProps["rowSpan"]>, string> = {
  1: "lg:row-span-1",
  2: "lg:row-span-2",
  3: "lg:row-span-3",
};

export function BentoTile({
  className,
  colSpan = 4,
  rowSpan = 1,
  interactive = false,
  ...props
}: BentoTileProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-4 md:p-6 lg:p-8",
        "text-card-foreground",
        interactive &&
          "transition-shadow duration-150 ease-out hover:shadow-sm focus-within:shadow-sm",
        COL_SPAN[colSpan],
        ROW_SPAN[rowSpan],
        className,
      )}
      {...props}
    />
  );
}
