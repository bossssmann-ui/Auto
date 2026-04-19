import type { Metadata } from "next";
import { BentoGrid } from "@/components/BentoGrid";
import { BentoTile } from "@/components/BentoTile";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Калькулятор стоимости под ключ",
  description:
    "Тот же расчёт, что в Telegram-боте: пошлина, утильсбор, фрахт, фикс. Санкционные коэффициенты применяются автоматически.",
  alternates: { canonical: "/calculator" },
};

export default function CalculatorPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
      <div className="mb-10 space-y-3">
        <span className="label">Calculator</span>
        <h1 className="font-display text-[32px] leading-tight font-semibold md:text-[40px] lg:text-[48px]">
          Калькулятор под ключ
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Тот же расчёт, что в нашем Telegram-боте: пошлина, утильсбор, фрахт, фикс. Сан­кционные
          коэффициенты для гибридов, электро и ICE &gt; 1900 см³ применяются автоматически.
        </p>
      </div>

      <BentoGrid>
        <BentoTile colSpan={8} rowSpan={2}>
          <span className="label">Ввод данных</span>
          <h2 className="mt-4 font-display text-2xl font-semibold">Форма расчёта</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Реальная форма появится в Phase 6. Она повторит набор полей бота: модель, год / окно
            возраста, объём, топливо, цена JPY, владение (физ/юр, для перепродажи или в семью).
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Badge variant="outline">@auto/shared</Badge>
            <Badge variant="outline">ЦБ РФ + spread</Badge>
            <Badge variant="outline">Санкционный фрахт</Badge>
          </div>
        </BentoTile>

        <BentoTile colSpan={4}>
          <span className="label">Курс · синхронно с ботом</span>
          <p className="mt-4 text-sm text-muted-foreground">
            JPY, USD, EUR от ЦБ РФ, плюс банковский спред 4 %. Один и тот же расчёт везде.
          </p>
        </BentoTile>

        <BentoTile colSpan={4}>
          <span className="label">Санкции</span>
          <p className="mt-4 text-sm text-muted-foreground">
            Hybrid / EV / ICE &gt;1900 см³ / VAN — автоматически по повышенному фрахту (3500–4000
            USD). Мотоциклы дороже 600 000 ¥ считаются вручную.
          </p>
        </BentoTile>
      </BentoGrid>
    </div>
  );
}
