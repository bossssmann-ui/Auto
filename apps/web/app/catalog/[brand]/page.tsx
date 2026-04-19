import Link from "next/link";
import { notFound } from "next/navigation";
import { BentoGrid } from "@/components/BentoGrid";
import { BentoTile } from "@/components/BentoTile";
import { LotCard } from "@/components/auction/LotCard";
import { Separator } from "@/components/ui/separator";
import {
  AuctionProviderError,
  listBrands,
  listModels,
  searchLots,
} from "@/lib/auction";

interface Params {
  brand: string;
}

export async function generateStaticParams(): Promise<Params[]> {
  // Top-level brand routes are few and stable — materialize all of them.
  const brands = await listBrands();
  return brands.map((b) => ({ brand: b.slug }));
}

export default async function BrandPage({ params }: { params: Promise<Params> }) {
  const { brand } = await params;

  let models;
  try {
    models = await listModels(brand);
  } catch (err) {
    if (err instanceof AuctionProviderError && err.code === "not_found") {
      notFound();
    }
    throw err;
  }

  const brandEntry = (await listBrands()).find((b) => b.slug === brand);
  if (!brandEntry) notFound();

  const recent = await searchLots({
    brand,
    page: 1,
    pageSize: 6,
    sort: "newest",
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
      <nav aria-label="Хлебные крошки" className="label mb-6">
        <Link href="/catalog" className="hover:text-foreground">
          Каталог
        </Link>
        <span className="mx-2 text-muted-foreground">/</span>
        <span className="text-foreground">{brandEntry.name}</span>
      </nav>

      <div className="mb-10 space-y-3">
        <span className="label">Brand</span>
        <h1 className="font-display text-[32px] leading-tight font-semibold md:text-[40px] lg:text-[48px]">
          {brandEntry.name}
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          {brandEntry.modelCount} моделей в каталоге. Выбирайте модель —
          смотрите поколения, комплектации и свежие лоты с аукционов.
        </p>
      </div>

      <BentoGrid>
        {models.map((m) => (
          <BentoTile key={m.slug} colSpan={4} interactive>
            <Link
              href={`/catalog/${brand}/${m.slug}`}
              className="flex h-full flex-col justify-between"
            >
              <div>
                <span className="label">Model</span>
                <h3 className="mt-4 font-display text-xl font-semibold">
                  {brandEntry.name} {m.name}
                </h3>
              </div>
              <p className="mt-6 text-sm text-muted-foreground">
                {m.generationCount} поколений · Открыть →
              </p>
            </Link>
          </BentoTile>
        ))}
      </BentoGrid>

      {recent.items.length > 0 && (
        <>
          <Separator className="my-16" />
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="font-display text-2xl font-semibold">
              Свежие лоты {brandEntry.name}
            </h2>
            <Link
              href={`/catalog?brand=${brand}`}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Все лоты →
            </Link>
          </div>
          <BentoGrid>
            {recent.items.map((lot) => (
              <LotCard key={lot.id} lot={lot} colSpan={4} />
            ))}
          </BentoGrid>
        </>
      )}
    </div>
  );
}
