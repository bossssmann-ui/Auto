import type { Metadata } from "next";
import { Suspense } from "react";
import { TurnkeyCalculator } from "@/components/Calculator/TurnkeyCalculator";
import { Faq } from "@/components/Faq";
import type { FaqItem } from "@/lib/seo";

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

      <Faq items={FAQ_ITEMS} />
    </div>
  );
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Насколько точен расчёт калькулятора?",
    answer:
      "Калькулятор применяет действующие ставки пошлины и утильсбора и текущий курс ЦБ с банковской надбавкой 1.04 — тот же движок, что у нашего Telegram-бота. Результат — предварительная вилка; точную смету под конкретный лот фиксирует менеджер до сделки.",
  },
  {
    question: "Почему результат — вилка «от и до», а не одна цифра?",
    answer:
      "Вы задаёте диапазон аукционной цены (от и до), и калькулятор считает полную стоимость для обеих границ. Финальная цифра зависит от того, за сколько реально выиграем лот на торгах.",
  },
  {
    question: "Что значит «передаю оператору»?",
    answer:
      "Часть расчётов автоматизировать нельзя: спецтехника, мотоциклы дороже 600 000 иен и санкционные автомобили с индивидуальным фрахтом. В этих случаях смету вручную готовит оператор — оставьте заявку, и он свяжется с вами.",
  },
  {
    question: "Какие машины считаются санкционными?",
    answer:
      "С августа 2023 года из Японии в РФ напрямую нельзя экспортировать гибриды, электромобили, авто с двигателем больше 1900 см³ и микроавтобусы. Они едут через третьи страны с повышенным фрахтом — калькулятор учитывает это автоматически.",
  },
  {
    question: "Входит ли доставка до моего города?",
    answer:
      "В расчёт входит фрахт до Владивостока и оформление. Автовоз от Владивостока до вашего города считается отдельно — уточните стоимость у менеджера при заявке.",
  },
];
