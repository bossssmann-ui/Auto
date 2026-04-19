import type { Metadata } from "next";
import { Suspense } from "react";
import { TurnkeyCalculator } from "@/components/Calculator/TurnkeyCalculator";

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
          Тот же расчёт, что в нашем Telegram-боте: пошлина, утильсбор, фрахт, фикс. Санкционные
          коэффициенты для гибридов, электро и ICE &gt; 1900 см³ применяются автоматически.
        </p>
      </div>

      {/* Suspense boundary required by Next when a Client Component reads useSearchParams
          inside a statically rendered route. */}
      <Suspense fallback={null}>
        <TurnkeyCalculator />
      </Suspense>
    </div>
  );
}
