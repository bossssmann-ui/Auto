import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Brand, FuelType } from "@/lib/auction";
import { fuelLabel } from "@/lib/format";

interface FilterBarProps {
  brands: Brand[];
  /** Current selections (URL-driven). */
  selected: {
    brand?: string;
    fuelType?: FuelType;
    ageWindow?: string;
  };
  /** Pathname the bar should return to when a filter is cleared. */
  basePath: string;
}

const FUEL_OPTIONS: FuelType[] = ["ice", "hybrid", "electric", "diesel"];
const AGE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "non_passable_under3", label: "до 3 лет" },
  { value: "passable", label: "3–5 лет" },
  { value: "non_passable_over5", label: "старше 5 лет" },
];

/**
 * Server-rendered filter bar. State lives in the URL so every link is
 * shareable and the page re-renders through the provider cache. No client-side
 * JS required for navigation.
 */
export function FilterBar({ brands, selected, basePath }: FilterBarProps) {
  const build = (patch: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { ...selected, ...patch };
    for (const [k, v] of Object.entries(merged)) {
      if (v) sp.set(k, v);
    }
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="mb-8 space-y-4 rounded-xl border border-border bg-card p-4">
      <FilterRow label="Бренд">
        <FilterChip href={build({ brand: undefined })} active={!selected.brand}>
          Все
        </FilterChip>
        {brands.map((b) => (
          <FilterChip
            key={b.slug}
            href={build({ brand: b.slug })}
            active={selected.brand === b.slug}
          >
            {b.name}
          </FilterChip>
        ))}
      </FilterRow>

      <FilterRow label="Топливо">
        <FilterChip href={build({ fuelType: undefined })} active={!selected.fuelType}>
          Любое
        </FilterChip>
        {FUEL_OPTIONS.map((f) => (
          <FilterChip
            key={f}
            href={build({ fuelType: f })}
            active={selected.fuelType === f}
          >
            {fuelLabel(f)}
          </FilterChip>
        ))}
      </FilterRow>

      <FilterRow label="Возраст">
        <FilterChip
          href={build({ ageWindow: undefined })}
          active={!selected.ageWindow}
        >
          Любой
        </FilterChip>
        {AGE_OPTIONS.map((a) => (
          <FilterChip
            key={a.value}
            href={build({ ageWindow: a.value })}
            active={selected.ageWindow === a.value}
          >
            {a.label}
          </FilterChip>
        ))}
      </FilterRow>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="label min-w-20 text-foreground">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="inline-flex">
      <Badge
        variant={active ? "default" : "outline"}
        className="cursor-pointer font-normal"
      >
        {children}
      </Badge>
    </Link>
  );
}
