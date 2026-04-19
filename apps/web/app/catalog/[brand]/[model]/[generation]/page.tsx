import Link from "next/link";
import { notFound } from "next/navigation";
import { BentoGrid } from "@/components/BentoGrid";
import { LotCard } from "@/components/auction/LotCard";
import {
  AuctionProviderError,
  listAllCategoryPaths,
  listBrands,
  listGenerations,
  listModels,
  searchLots,
} from "@/lib/auction";

interface Params {
  brand: string;
  model: string;
  generation: string;
}

export async function generateStaticParams(): Promise<Params[]> {
  const out: Params[] = [];
  for await (const path of listAllCategoryPaths()) {
    if (path.brand && path.model && path.generation) {
      out.push({
        brand: path.brand,
        model: path.model,
        generation: path.generation,
      });
    }
  }
  return out;
}

export default async function GenerationPage({ params }: { params: Promise<Params> }) {
  const { brand, model, generation } = await params;

  let generations;
  try {
    generations = await listGenerations(brand, model);
  } catch (err) {
    if (err instanceof AuctionProviderError && err.code === "not_found") {
      notFound();
    }
    throw err;
  }

  const genEntry = generations.find((g) => g.slug === generation);
  if (!genEntry) notFound();

  const [brands, models] = await Promise.all([listBrands(), listModels(brand)]);
  const brandEntry = brands.find((b) => b.slug === brand);
  const modelEntry = models.find((m) => m.slug === model);
  if (!brandEntry || !modelEntry) notFound();

  const lots = await searchLots({
    brand,
    model,
    generation,
    page: 1,
    pageSize: 24,
    sort: "newest",
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
      <nav aria-label="Хлебные крошки" className="label mb-6">
        <Link href="/catalog" className="hover:text-foreground">
          Каталог
        </Link>
        <span className="mx-2 text-muted-foreground">/</span>
        <Link href={`/catalog/${brand}`} className="hover:text-foreground">
          {brandEntry.name}
        </Link>
        <span className="mx-2 text-muted-foreground">/</span>
        <Link
          href={`/catalog/${brand}/${model}`}
          className="hover:text-foreground"
        >
          {modelEntry.name}
        </Link>
        <span className="mx-2 text-muted-foreground">/</span>
        <span className="text-foreground">{genEntry.name}</span>
      </nav>

      <div className="mb-10 space-y-3">
        <span className="label">Generation</span>
        <h1 className="font-display text-[32px] leading-tight font-semibold md:text-[40px] lg:text-[48px]">
          {brandEntry.name} {modelEntry.name} {genEntry.name}
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          {genEntry.yearsFrom}
          {genEntry.yearsTo ? `–${genEntry.yearsTo}` : "—"} · {lots.total} лотов в каталоге.
        </p>
      </div>

      {lots.items.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          В этом поколении сейчас нет активных лотов. Загляните позже или
          откройте{" "}
          <Link
            href={`/catalog?brand=${brand}`}
            className="text-foreground underline underline-offset-4"
          >
            все лоты {brandEntry.name}
          </Link>
          .
        </div>
      ) : (
        <BentoGrid>
          {lots.items.map((lot) => (
            <LotCard key={lot.id} lot={lot} colSpan={4} />
          ))}
        </BentoGrid>
      )}
    </div>
  );
}
