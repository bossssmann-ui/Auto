import Link from "next/link";
import { BentoGrid } from "@/components/BentoGrid";
import { BentoTile } from "@/components/BentoTile";

interface Params {
  brand: string;
  model: string;
}

export default async function ModelPage({ params }: { params: Promise<Params> }) {
  const { brand, model } = await params;
  const title = `${brand} ${model}`.replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
      <nav aria-label="Хлебные крошки" className="label mb-6">
        <Link href="/catalog" className="hover:text-foreground">
          Каталог
        </Link>
        <span className="mx-2 text-muted-foreground">/</span>
        <Link href={`/catalog/${brand}`} className="hover:text-foreground capitalize">
          {brand}
        </Link>
        <span className="mx-2 text-muted-foreground">/</span>
        <span className="text-foreground capitalize">{model}</span>
      </nav>

      <div className="mb-10 space-y-3">
        <span className="label">Model</span>
        <h1 className="font-display text-[32px] leading-tight font-semibold md:text-[40px] lg:text-[48px]">
          {title}
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Поколения, комплектации и актуальные лоты модели. Реальные данные появятся в Phase 4.
        </p>
      </div>

      <BentoGrid>
        {[
          { slug: "xu60", label: "XU60 (2013–2020)" },
          { slug: "xu80", label: "XU80 (2020–)" },
          { slug: "all", label: "Все поколения" },
        ].map((gen) => (
          <BentoTile key={gen.slug} colSpan={4} interactive>
            <Link
              href={`/catalog/${brand}/${model}/${gen.slug}`}
              className="flex h-full flex-col justify-between"
            >
              <div>
                <span className="label">Generation</span>
                <h3 className="mt-4 font-display text-xl font-semibold">{gen.label}</h3>
              </div>
              <p className="mt-6 text-sm text-muted-foreground">Открыть поколение →</p>
            </Link>
          </BentoTile>
        ))}
      </BentoGrid>
    </div>
  );
}
