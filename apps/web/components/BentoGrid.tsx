import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Strict Bento grid primitive per spec §4.2.
 *
 * - 12-column grid at `lg` and up.
 * - Collapses to 6 at `md`, 2 at base.
 * - Gaps: `gap-4` mobile, `gap-6` desktop.
 *
 * Tiles are placed by passing `colSpan` / `rowSpan` props to <BentoTile>.
 */
export function BentoGrid({
  className,
  children,
  ...props
}: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "grid w-full grid-cols-2 gap-4 md:grid-cols-6 md:gap-5 lg:grid-cols-12 lg:gap-6",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}
