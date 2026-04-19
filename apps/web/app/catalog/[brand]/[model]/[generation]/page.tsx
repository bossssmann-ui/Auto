import Link from "next/link";
import { BentoGrid } from "@/components/BentoGrid";
import { BentoTile } from "@/components/BentoTile";

interface Params {
  brand: string;
  model: string;
  generation: string;
}

export default async function GenerationPage({ params }: { params: Promise<Params> }) {
  const { brand, model, generation } = await params;
  const title = `${brand} ${model} ${generation}`.replace(/\b\w/g, (c) => c.toUpperCase());

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
        <Link
          href={`/catalog/${brand}/${model}`}
          className="hover:text-foreground capitalize"
        >
          {model}
        </Link>
        <span className="mx-2 text-muted-foreground">/</span>
        <span className="text-foreground uppercase">{generation}</span>
      </nav>

      <div className="mb-10 space-y-3">
        <span className="label">Generation</span>
        <h1 className="font-display text-[32px] leading-tight font-semibold md:text-[40px] lg:text-[48px]">
          {title}
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Лоты конкретного поколения с реальными характеристиками и расчётом под ключ.
          Заполнится фикстурами в Phase 4.
        </p>
      </div>

      <BentoGrid>
        {Array.from({ length: 6 }).map((_, i) => (
          <BentoTile key={i} colSpan={4} interactive>
            <Link href={`/lot/${2000 + i}`} className="flex h-full flex-col justify-between">
              <div>
                <span className="label">Lot · Japan</span>
                <h3 className="mt-4 font-display text-xl font-semibold">Lot #{2000 + i}</h3>
                <p className="mt-1 text-sm text-muted-foreground">4.5 grade · 45 000 km · 2021</p>
              </div>
              <div className="mt-6">
                <p className="label">Под ключ</p>
                <p className="font-display text-xl font-semibold tabular-nums">от 3 600 000 ₽</p>
              </div>
            </Link>
          </BentoTile>
        ))}
      </BentoGrid>
    </div>
  );
}
