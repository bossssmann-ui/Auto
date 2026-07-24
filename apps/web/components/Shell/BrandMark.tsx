import { cn } from "@/lib/utils";

/**
 * Brand wordmark: `SpecTechMash` + mandatory Russian double «Спецтехмаш»
 * (53-ФЗ: латиница финальна, но до регистрации ТЗ публичные материалы несут
 * русский дубль — PROJECT_PLAN §1 / P4-02).
 *
 * When the final SVG logo lands (see `public/brand/README.md`), swap the
 * text block below for an `next/image` of `/brand/logo.svg` — the component
 * boundary keeps header/footer untouched. Until then we deliberately render
 * a text wordmark and never fake a graphic logo.
 */
export function BrandMark({
  className,
  compact = false,
}: {
  className?: string;
  /** Tighter variant for the sticky header. */
  compact?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-baseline gap-2", className)}>
      <span
        className={cn(
          "font-display font-semibold tracking-tight",
          compact ? "text-lg" : "text-base",
        )}
      >
        SpecTechMash
      </span>
      <span
        className={cn(
          "text-muted-foreground",
          compact ? "hidden text-xs sm:inline" : "text-xs",
        )}
      >
        Спецтехмаш
      </span>
    </span>
  );
}
