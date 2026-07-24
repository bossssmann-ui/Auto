import Link from "next/link";
import type { Metadata } from "next";
import { BentoGrid } from "@/components/BentoGrid";
import { LotCard } from "@/components/auction/LotCard";
import { FilterBar } from "@/components/auction/FilterBar";
import { Separator } from "@/components/ui/separator";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbJsonLd } from "@/lib/seo";
import {
  listBrands,
  searchLots,
  type FuelType,
  type AgeWindow,
} from "@/lib/auction";

export const revalidate = 3600;

interface CatalogPageProps {
  searchParams: Promise<{
    brand?: string;
    fuelType?: string;
    ageWindow?: string;
    page?: string;
  }>;
}

const FUEL_TYPES = new Set<FuelType>(["ice", "hybrid", "electric", "diesel"]);
const AGE_WINDOWS = new Set<AgeWindow>([
  "passable",
  "non_passable_under3",
  "non_passable_over5",
]);

function asFuelType(v: string | undefined): FuelType | undefined {
  return v && FUEL_TYPES.has(v as FuelType) ? (v as FuelType) : undefined;
}
function asAgeWindow(v: string | undefined): AgeWindow | undefined {
  return v && AGE_WINDOWS.has(v as AgeWindow) ? (v as AgeWindow) : undefined;
}

/**
 * Canonical/robots policy for facets and pagination (P3-02):
 *   - pagination (`?page>=2`) gets a SELF-canonical (with its valid params)
 *     so page 2+ is not reported as a duplicate of `/catalog`;
 *   - a single valuable facet (brand OR fuelType OR ageWindow) stays
 *     indexable with a self-canonical;
 *   - facet intersections (2+ filters) are `noindex,follow` — crawlable but
 *     out of the index. This complements robots.txt `Clean-param`, which
 *     already collapses these URLs for Yandex.
 * Invalid param values are ignored (not echoed into the canonical).
 */
export async function generateMetadata({
  searchParams,
}: CatalogPageProps): Promise<Metadata> {
  const sp = await searchParams;
  const brand = sp.brand;
  const fuelType = asFuelType(sp.fuelType);
  const ageWindow = asAgeWindow(sp.ageWindow);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const facetCount = [brand, fuelType, ageWindow].filter(Boolean).length;
  const noindex = facetCount >= 2;

  const qs = new URLSearchParams();
  if (brand) qs.set("brand", brand);
  if (fuelType) qs.set("fuelType", fuelType);
  if (ageWindow) qs.set("ageWindow", ageWindow);
  if (page > 1) qs.set("page", String(page));
  const canonical = qs.size > 0 ? `/catalog?${qs.toString()}` : "/catalog";

  const pageSuffix = page > 1 ? ` — страница ${page}` : "";
  return {
    title: `Каталог JDM-лотов — аукционы Японии, Кореи, Китая${pageSuffix}`,
    description:
      "Аукционные лоты под ключ: фильтрация по бренду, топливу и окну возраста. Цены в рублях рассчитываются автоматически по курсу ЦБ.",
    alternates: { canonical },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const sp = await searchParams;

  const brands = await listBrands();
  const fuelType = asFuelType(sp.fuelType);
  const ageWindow = asAgeWindow(sp.ageWindow);
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const result = await searchLots({
    brand: sp.brand,
    fuelType,
    ageWindow,
    page,
    pageSize: 12,
    sort: "newest",
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Главная", url: "/" },
          { name: "Каталог", url: "/catalog" },
        ])}
      />
      <div className="mb-10 space-y-4">
        <span className="label">Catalog</span>
        <h1 className="font-display text-[32px] leading-tight font-semibold md:text-[40px] lg:text-[48px]">
          Аукционные лоты
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Лоты с японских и корейских аукционов. Цены «под ключ в РФ» считаются
          автоматически через наш калькулятор по курсу ЦБ.
        </p>
      </div>

      <FilterBar
        brands={brands}
        selected={{ brand: sp.brand, fuelType, ageWindow: sp.ageWindow }}
        basePath="/catalog"
      />

      {result.items.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          По текущим фильтрам лотов нет. Сбросьте фильтры или попробуйте другой бренд.
        </div>
      ) : (
        <>
          <BentoGrid>
            {result.items.map((lot) => (
              <LotCard key={lot.id} lot={lot} colSpan={4} />
            ))}
          </BentoGrid>

          <Pagination
            page={result.page}
            pageSize={result.pageSize}
            total={result.total}
            searchParams={sp}
          />
        </>
      )}

      <Separator className="my-16" />

      <div>
        <span className="label">Популярные бренды</span>
        <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {brands.slice(0, 8).map((b) => (
            <li key={b.slug}>
              <Link
                href={`/catalog/${b.slug}`}
                className="block rounded-lg border border-border bg-card p-4 text-sm transition-colors hover:bg-muted"
              >
                {b.name}
                <span className="ml-2 text-xs text-muted-foreground">
                  · {b.modelCount} моделей
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Pagination({
  page,
  pageSize,
  total,
  searchParams,
}: {
  page: number;
  pageSize: number;
  total: number;
  searchParams: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;

  const build = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (v && k !== "page") qs.set(k, v);
    }
    if (p > 1) qs.set("page", String(p));
    const s = qs.toString();
    return s ? `/catalog?${s}` : "/catalog";
  };

  return (
    <nav
      aria-label="Pagination"
      className="mt-10 flex items-center justify-center gap-2"
    >
      {page > 1 && (
        <Link
          href={build(page - 1)}
          className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
        >
          ← Назад
        </Link>
      )}
      <span className="text-sm text-muted-foreground">
        Страница {page} из {pages}
      </span>
      {page < pages && (
        <Link
          href={build(page + 1)}
          className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
        >
          Вперёд →
        </Link>
      )}
    </nav>
  );
}
