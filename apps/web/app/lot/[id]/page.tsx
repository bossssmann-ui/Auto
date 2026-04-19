import Link from "next/link";
import { BentoGrid } from "@/components/BentoGrid";
import { BentoTile } from "@/components/BentoTile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface Params {
  id: string;
}

export default async function LotPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
      <nav aria-label="Хлебные крошки" className="label mb-6">
        <Link href="/catalog" className="hover:text-foreground">
          Каталог
        </Link>
        <span className="mx-2 text-muted-foreground">/</span>
        <span className="text-foreground">Lot #{id}</span>
      </nav>

      <BentoGrid>
        {/* Gallery placeholder — real next/image gallery comes in Phase 4. */}
        <BentoTile colSpan={8} rowSpan={2} className="bg-muted p-0">
          <div className="flex h-full min-h-[360px] w-full items-center justify-center">
            <span className="label">Gallery placeholder</span>
          </div>
        </BentoTile>

        <BentoTile colSpan={4}>
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Badge variant="outline">JDM</Badge>
              <Badge variant="outline">4.5 grade</Badge>
            </div>
            <h1 className="font-display text-[32px] leading-tight font-semibold md:text-[40px]">
              Toyota Harrier 2.5
            </h1>
            <p className="text-sm text-muted-foreground">
              Lot #{id} · 2022 · 43 000 km · AWD · серый
            </p>
          </div>
          <div className="mt-10 space-y-2">
            <p className="label">Под ключ в РФ</p>
            <p className="font-display text-3xl font-semibold tabular-nums">
              3 850 000 – 4 050 000 ₽
            </p>
            <p className="text-xs text-muted-foreground">
              Оценка, зависит от курса ЦБ и аукционной цены.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg">Связаться с менеджером</Button>
            <Button size="lg" variant="outline">
              Открыть в Telegram
            </Button>
          </div>
        </BentoTile>

        <BentoTile colSpan={6}>
          <span className="label">Характеристики</span>
          <dl className="mt-6 grid grid-cols-2 gap-y-3 text-sm">
            <dt className="text-muted-foreground">Кузов</dt>
            <dd>SUV · XU80</dd>
            <dt className="text-muted-foreground">Объём</dt>
            <dd>2.5 L · hybrid</dd>
            <dt className="text-muted-foreground">Привод</dt>
            <dd>AWD E-Four</dd>
            <dt className="text-muted-foreground">Коробка</dt>
            <dd>e-CVT</dd>
            <dt className="text-muted-foreground">Пробег</dt>
            <dd>43 000 km</dd>
            <dt className="text-muted-foreground">Год</dt>
            <dd>2022</dd>
          </dl>
        </BentoTile>

        <BentoTile colSpan={6}>
          <span className="label">Аукционный лист</span>
          <p className="mt-6 text-sm text-muted-foreground">
            Заглушка под скан auction sheet. В Phase 4 подставим реальное изображение из данных
            лота.
          </p>
        </BentoTile>
      </BentoGrid>

      <Separator className="my-16" />

      <div>
        <span className="label">Что входит в расчёт</span>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          FOB-цена на аукционе · фрахт до Владивостока · таможенная пошлина и утильсбор · СБКТС и
          ЭПТС · фиксированные сборы. Все строки видны в калькуляторе.
        </p>
        <Button asChild variant="ghost" className="mt-4 px-0 text-foreground">
          <Link href="/calculator">Открыть калькулятор →</Link>
        </Button>
      </div>
    </div>
  );
}
