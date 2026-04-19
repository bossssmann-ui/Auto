import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BentoGrid } from "@/components/BentoGrid";
import { BentoTile } from "@/components/BentoTile";
import { LotCard } from "@/components/auction/LotCard";
import { Separator } from "@/components/ui/separator";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbJsonLd, itemListJsonLd, ogImageUrl } from "@/lib/seo";
import {
  AuctionProviderError,
  listAllCategoryPaths,
  listBrands,
  listGenerations,
  listModels,
  searchLots,
} from "@/lib/auction";

export const revalidate = 3600;

interface Params {
  brand: string;
  model: string;
}

export async function generateStaticParams(): Promise<Params[]> {
  const out: Params[] = [];
  for await (const path of listAllCategoryPaths()) {
    if (path.model && !path.generation) {
      out.push({ brand: path.brand, model: path.model });
    }
  }
  return out;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { brand, model } = await params;
  const [brands, models] = await Promise.all([listBrands(), listModels(brand).catch(() => [])]);
  const brandEntry = brands.find((b) => b.slug === brand);
  const modelEntry = models.find((m) => m.slug === model);
  if (!brandEntry || !modelEntry) return {};
  const full = `${brandEntry.name} ${modelEntry.name}`;
  const title = `${full} — аукционные лоты из Японии под ключ`;
  const description = `Поколения и свежие лоты ${full} с японских аукционов. Цены в рублях под ключ рассчитываются автоматически.`;
  const canonical = `/catalog/${brand}/${model}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      images: [{ url: ogImageUrl({ title: full, subtitle: "Аукционные лоты", kind: "category" }) }],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ModelPage({ params }: { params: Promise<Params> }) {
  const { brand, model } = await params;

  let generations;
  try {
    generations = await listGenerations(brand, model);
  } catch (err) {
    if (err instanceof AuctionProviderError && err.code === "not_found") {
      notFound();
    }
    throw err;
  }

  const [brands, models] = await Promise.all([listBrands(), listModels(brand)]);
  const brandEntry = brands.find((b) => b.slug === brand);
  const modelEntry = models.find((m) => m.slug === model);
  if (!brandEntry || !modelEntry) notFound();

  const recent = await searchLots({
    brand,
    model,
    page: 1,
    pageSize: 6,
    sort: "newest",
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Главная", url: "/" },
          { name: "Каталог", url: "/catalog" },
          { name: brandEntry.name, url: `/catalog/${brand}` },
          { name: modelEntry.name, url: `/catalog/${brand}/${model}` },
        ])}
      />
      {generations.length > 0 && (
        <JsonLd
          data={itemListJsonLd(
            `Поколения ${brandEntry.name} ${modelEntry.name}`,
            generations.map((g) => ({
              name: g.name,
              url: `/catalog/${brand}/${model}/${g.slug}`,
            })),
          )}
        />
      )}
      <nav aria-label="Хлебные крошки" className="label mb-6">
        <Link href="/catalog" className="hover:text-foreground">
          Каталог
        </Link>
        <span className="mx-2 text-muted-foreground">/</span>
        <Link href={`/catalog/${brand}`} className="hover:text-foreground">
          {brandEntry.name}
        </Link>
        <span className="mx-2 text-muted-foreground">/</span>
        <span className="text-foreground">{modelEntry.name}</span>
      </nav>

      <div className="mb-10 space-y-3">
        <span className="label">Model</span>
        <h1 className="font-display text-[32px] leading-tight font-semibold md:text-[40px] lg:text-[48px]">
          {brandEntry.name} {modelEntry.name}
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Поколения {modelEntry.name}, свежие лоты и оценка под ключ в РФ.
        </p>
      </div>

      {generations.length > 0 && (
        <BentoGrid>
          {generations.map((g) => (
            <BentoTile key={g.slug} colSpan={4} interactive>
              <Link
                href={`/catalog/${brand}/${model}/${g.slug}`}
                className="flex h-full flex-col justify-between"
              >
                <div>
                  <span className="label">Generation</span>
                  <h3 className="mt-4 font-display text-xl font-semibold">
                    {g.name}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {g.yearsFrom}
                    {g.yearsTo ? `–${g.yearsTo}` : "—"}
                  </p>
                </div>
                <p className="mt-6 text-sm text-muted-foreground">Открыть →</p>
              </Link>
            </BentoTile>
          ))}
        </BentoGrid>
      )}

      {recent.items.length > 0 && (
        <>
          <Separator className="my-16" />
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="font-display text-2xl font-semibold">
              Свежие лоты
            </h2>
            <Link
              href={`/catalog?brand=${brand}`}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Все лоты {brandEntry.name} →
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
