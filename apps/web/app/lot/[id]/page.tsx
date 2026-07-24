import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BentoGrid } from "@/components/BentoGrid";
import { BentoTile } from "@/components/BentoTile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { JsonLd } from "@/components/JsonLd";
import { LeadDialog } from "@/components/Lead/LeadDialog";
import {
  breadcrumbJsonLd,
  ogImageUrl,
  productJsonLd,
  TELEGRAM_BOT_USERNAME,
} from "@/lib/seo";
import { getLot, listAllLotIds } from "@/lib/auction";
import {
  formatJpy,
  formatKm,
  formatPriceRangeRub,
  fuelLabel,
  volumeLabel,
} from "@/lib/format";

export const revalidate = 300;

interface Params {
  id: string;
}

export async function generateStaticParams(): Promise<Params[]> {
  const ids: Params[] = [];
  for await (const id of listAllLotIds()) ids.push({ id });
  return ids;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await params;
  const lot = await getLot(id);
  if (!lot) return {};
  const priceBit = lot.priceRangeRub
    ? ` — под ключ ${formatPriceRangeRub(lot.priceRangeRub)}`
    : " — цена по запросу";
  const title = `${lot.title} (${lot.year})${priceBit}`;
  const kmBit = lot.mileageKm != null ? `, ${formatKm(lot.mileageKm)}` : "";
  const gradeBit = lot.auctionGrade != null ? `, grade ${lot.auctionGrade}` : "";
  const description = `${lot.title}, ${lot.year}${kmBit}${gradeBit}. Аукцион ${lot.auction}, расчёт под ключ в рублях по курсу ЦБ.`;
  const canonical = `/lot/${lot.id}`;
  const ogImage = lot.thumbnail && lot.thumbnail.startsWith("http")
    ? lot.thumbnail
    : ogImageUrl({ title: lot.title, subtitle: `${lot.year} · ${lot.auction}`, kind: "lot" });
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      title,
      description,
      url: canonical,
      images: [{ url: ogImage, width: 1200, height: 630, alt: lot.title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
  };
}

export default async function LotPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;

  const lot = await getLot(id);
  if (!lot) notFound();

  const tgHref = `https://t.me/${TELEGRAM_BOT_USERNAME}?start=lot_${encodeURIComponent(lot.id)}`;
  const cover = lot.photos[0] ?? "/lot-placeholder.svg";

  const leadMeta: Record<string, string> = {
    "Лот": `#${lot.id}`,
    "Техника": `${lot.title} (${lot.year})`,
    "Цена под ключ": lot.requiresOperator
      ? "по запросу (нужен оператор)"
      : (formatPriceRangeRub(lot.priceRangeRub) ?? "по запросу"),
    "Цена на аукционе": formatJpy(lot.auctionPriceJpy),
    "Страница": `/lot/${lot.id}`,
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Главная", url: "/" },
          { name: "Каталог", url: "/catalog" },
          { name: lot.brandSlug, url: `/catalog/${lot.brandSlug}` },
          { name: lot.modelSlug, url: `/catalog/${lot.brandSlug}/${lot.modelSlug}` },
          { name: lot.title, url: `/lot/${lot.id}` },
        ])}
      />
      <JsonLd data={productJsonLd(lot, `/lot/${lot.id}`)} />
      <nav aria-label="Хлебные крошки" className="label mb-6">
        <Link href="/catalog" className="hover:text-foreground">
          Каталог
        </Link>
        <span className="mx-2 text-muted-foreground">/</span>
        <Link
          href={`/catalog/${lot.brandSlug}`}
          className="hover:text-foreground capitalize"
        >
          {lot.brandSlug}
        </Link>
        <span className="mx-2 text-muted-foreground">/</span>
        <Link
          href={`/catalog/${lot.brandSlug}/${lot.modelSlug}`}
          className="hover:text-foreground capitalize"
        >
          {lot.modelSlug}
        </Link>
        <span className="mx-2 text-muted-foreground">/</span>
        <span className="text-foreground">Lot #{lot.id}</span>
      </nav>

      <BentoGrid>
        <BentoTile colSpan={8} rowSpan={2} className="bg-muted p-0">
          <div className="relative h-full min-h-[360px] w-full overflow-hidden rounded-xl">
            <Image
              src={cover}
              alt={lot.title}
              fill
              sizes="(min-width: 1024px) 66vw, 100vw"
              className="object-cover"
              priority
            />
          </div>
        </BentoTile>

        <BentoTile colSpan={4}>
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">JDM</Badge>
              {lot.auctionGrade !== null && (
                <Badge variant="outline">grade {lot.auctionGrade}</Badge>
              )}
              {lot.requiresOperator && (
                <Badge variant="default">Индивидуальная смета</Badge>
              )}
            </div>
            <h1 className="font-display text-[32px] leading-tight font-semibold md:text-[36px]">
              {lot.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              Lot #{lot.id} · {lot.year}
              {lot.mileageKm !== null ? ` · ${formatKm(lot.mileageKm)}` : ""}
              {" · "}
              {lot.drive.toUpperCase()}
              {lot.color ? ` · ${lot.color}` : ""}
            </p>
          </div>

          <div className="mt-10 space-y-2">
            <p className="label">Под ключ в РФ</p>
            {lot.requiresOperator ? (
              <OperatorCard reason={lot.operatorReason} />
            ) : (
              <>
                <p className="font-display text-3xl font-semibold tabular-nums">
                  {formatPriceRangeRub(lot.priceRangeRub)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Оценка по текущему курсу ЦБ и диапазону цены на аукционе ±10 %.
                </p>
              </>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <LeadDialog
              label="Уточнить наличие / цену"
              source="lot"
              defaultInterest={`${lot.title} (${lot.year}), лот #${lot.id}`}
              meta={leadMeta}
              title="Уточнить наличие и цену"
              description="Менеджер проверит лот и пришлёт точную смету. Данные лота прикрепим к заявке."
              size="lg"
            />
            <Button asChild size="lg" variant="outline">
              <a href={tgHref} target="_blank" rel="noopener noreferrer">
                Открыть в Telegram
              </a>
            </Button>
          </div>
        </BentoTile>

        <BentoTile colSpan={6}>
          <span className="label">Характеристики</span>
          <dl className="mt-6 grid grid-cols-2 gap-y-3 text-sm">
            <dt className="text-muted-foreground">Кузов</dt>
            <dd className="capitalize">{lot.bodyType}</dd>
            <dt className="text-muted-foreground">Объём</dt>
            <dd>
              {volumeLabel(lot.volumeCm3)} · {fuelLabel(lot.fuelType)}
            </dd>
            <dt className="text-muted-foreground">Привод</dt>
            <dd className="uppercase">{lot.drive}</dd>
            <dt className="text-muted-foreground">Коробка</dt>
            <dd className="uppercase">{lot.transmission}</dd>
            <dt className="text-muted-foreground">Пробег</dt>
            <dd>{formatKm(lot.mileageKm) ?? "—"}</dd>
            <dt className="text-muted-foreground">Год</dt>
            <dd>{lot.year}</dd>
            <dt className="text-muted-foreground">Аукцион</dt>
            <dd>{lot.auction}</dd>
            <dt className="text-muted-foreground">Цена на аукционе</dt>
            <dd className="tabular-nums">{formatJpy(lot.auctionPriceJpy)}</dd>
          </dl>
        </BentoTile>

        <BentoTile colSpan={6}>
          <span className="label">Аукционный лист</span>
          <p className="mt-6 text-sm text-muted-foreground">
            Заглушка под скан auction sheet. Появится, когда подключим реальный
            фид лотов.
          </p>
          {lot.auctionDate && (
            <p className="mt-4 text-sm">
              Торги: <span className="tabular-nums">{lot.auctionDate}</span>
            </p>
          )}
          {lot.trim && (
            <p className="mt-2 text-sm">
              Комплектация: <span className="font-medium">{lot.trim}</span>
            </p>
          )}
        </BentoTile>
      </BentoGrid>

      <Separator className="my-16" />

      <div>
        <span className="label">Что входит в расчёт</span>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          FOB-цена на аукционе · фрахт до Владивостока · таможенная пошлина и
          утильсбор · СБКТС и ЭПТС · фиксированные сборы. Санкционные
          транспортные маршруты считаются по повышенной ставке фрахта.
        </p>
        <Button asChild variant="ghost" className="mt-4 px-0 text-foreground">
          <Link href="/calculator">Открыть калькулятор →</Link>
        </Button>
      </div>
    </div>
  );
}

function OperatorCard({ reason }: { reason: string | null }) {
  return (
    <div className="rounded-xl border border-border bg-muted/60 p-4">
      <p className="font-display text-xl font-semibold">Цена по запросу</p>
      <p className="mt-2 text-sm text-muted-foreground">
        {reason ??
          "Лот считается индивидуально. Оператор пришлёт смету под ключ в течение 15 минут."}
      </p>
    </div>
  );
}
