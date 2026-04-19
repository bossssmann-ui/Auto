import Link from "next/link";
import { BentoGrid } from "@/components/BentoGrid";
import { BentoTile } from "@/components/BentoTile";

interface Params {
  brand: string;
}

export default async function BrandPage({ params }: { params: Promise<Params> }) {
  const { brand } = await params;
  const title = brand.charAt(0).toUpperCase() + brand.slice(1);

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
      <nav aria-label="Хлебные крошки" className="label mb-6">
        <Link href="/catalog" className="hover:text-foreground">
          Каталог
        </Link>
        <span className="mx-2 text-muted-foreground">/</span>
        <span className="text-foreground">{title}</span>
      </nav>

      <div className="mb-10 space-y-3">
        <span className="label">Brand</span>
        <h1 className="font-display text-[32px] leading-tight font-semibold md:text-[40px] lg:text-[48px]">
          {title}
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Все модели {title} с японских аукционов. Фильтры и реальные лоты — в следующей фазе.
        </p>
      </div>

      <BentoGrid>
        {["harrier", "camry", "rav4", "land-cruiser", "alphard", "vellfire"].map((model) => (
          <BentoTile key={model} colSpan={4} interactive>
            <Link href={`/catalog/${brand}/${model}`} className="flex h-full flex-col justify-between">
              <div>
                <span className="label">Model</span>
                <h3 className="mt-4 font-display text-xl font-semibold capitalize">
                  {title} {model.replace("-", " ")}
                </h3>
              </div>
              <p className="mt-6 text-sm text-muted-foreground">Открыть модель →</p>
            </Link>
          </BentoTile>
        ))}
      </BentoGrid>
    </div>
  );
}
