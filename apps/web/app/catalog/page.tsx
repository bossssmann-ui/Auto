import Link from "next/link";
import { BentoGrid } from "@/components/BentoGrid";
import { BentoTile } from "@/components/BentoTile";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const FILTER_GROUPS: Array<{ label: string; options: string[] }> = [
  { label: "Бренд", options: ["Toyota", "Honda", "Nissan", "Mazda", "Subaru", "Lexus", "Mitsubishi"] },
  { label: "Возраст", options: ["до 3 лет", "3–5 лет", "5–7 лет", "старше 7 лет"] },
  { label: "Объём", options: ["до 1.5 л", "1.5–2.0 л", "2.0–2.5 л", "свыше 2.5 л"] },
  { label: "Топливо", options: ["Бензин", "Гибрид", "Дизель", "Электро"] },
];

export default function CatalogPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
      <div className="mb-10 space-y-4">
        <span className="label">Catalog</span>
        <h1 className="font-display text-[32px] leading-tight font-semibold md:text-[40px] lg:text-[48px]">
          Аукционные лоты
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Данные лотов подтягиваются с японских и корейских аукционов. Этот экран —
          скелет макета: реальный фид появится в следующей фазе.
        </p>
      </div>

      {/* Filter bar placeholder — real URL-state sync comes in Phase 4. */}
      <div className="mb-8 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4">
        {FILTER_GROUPS.map((group) => (
          <div key={group.label} className="flex items-center gap-2">
            <span className="label text-foreground">{group.label}</span>
            <div className="flex flex-wrap gap-1.5">
              {group.options.slice(0, 3).map((opt) => (
                <Badge key={opt} variant="outline" className="font-normal">
                  {opt}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>

      <BentoGrid>
        {Array.from({ length: 8 }).map((_, i) => (
          <BentoTile key={i} colSpan={i === 0 ? 8 : 4} rowSpan={i === 0 ? 2 : 1} interactive>
            <Link href={`/lot/${1000 + i}`} className="flex h-full flex-col justify-between">
              <div>
                <span className="label">JDM · Japan auction</span>
                <h3 className="mt-4 font-display text-2xl font-semibold">Toyota Harrier 2.5</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  2022 · 4.5 grade · 43 000 km
                </p>
              </div>
              <div className="mt-6">
                <p className="label">Под ключ в РФ</p>
                <p className="font-display text-2xl font-semibold tabular-nums">
                  от 3 850 000 ₽
                </p>
              </div>
            </Link>
          </BentoTile>
        ))}
      </BentoGrid>

      <Separator className="my-16" />

      <div>
        <span className="label">Популярные направления</span>
        <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {["toyota", "honda", "nissan", "lexus"].map((slug) => (
            <li key={slug}>
              <Link
                href={`/catalog/${slug}`}
                className="block rounded-lg border border-border bg-card p-4 text-sm capitalize transition-colors hover:bg-muted"
              >
                {slug}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
