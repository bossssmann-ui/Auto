import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { JsonLd } from "@/components/JsonLd";
import { Faq } from "@/components/Faq";
import { breadcrumbJsonLd, type FaqItem } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Растаможка авто из Японии — пошлина, утильсбор, СБКТС, ЭПТС",
  description:
    "Таможенное оформление автомобилей из Японии во Владивостоке: пошлина, утилизационный сбор, СВХ, брокер, СБКТС и ЭПТС. Все платежи видны в калькуляторе до сделки.",
  alternates: { canonical: "/customs" },
};

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Из чего состоят таможенные платежи?",
    answer:
      "Таможенная пошлина (зависит от таможенной стоимости, объёма двигателя и возраста автомобиля), утилизационный сбор (зависит от типа техники, объёма, возраста и статуса покупателя — физлицо, юрлицо, перепродажа) и фиксированные сборы за оформление: СВХ, брокер, СБКТС.",
  },
  {
    question: "Что такое «проходной» и «непроходной» возраст?",
    answer:
      "Проходными обычно называют автомобили возрастом от 3 до 5 лет — для них ставки наиболее выгодны. Машины младше 3 и старше 5 лет («непроходные») облагаются по другим ставкам. Калькулятор учитывает возрастные окна автоматически.",
  },
  {
    question: "Чем отличаются платежи для физлица и юрлица?",
    answer:
      "Ставки утилизационного сбора и порядок расчёта различаются для физлиц (для личного пользования), покупок под перепродажу и юридических лиц. В калькуляторе это отдельные переключатели — выберите свой вариант и увидите разницу.",
  },
  {
    question: "Что такое СБКТС и ЭПТС?",
    answer:
      "СБКТС — свидетельство о безопасности конструкции транспортного средства, обязательное для ввозимых авто. ЭПТС — электронный паспорт транспортного средства, без которого нельзя поставить машину на учёт. Оба документа оформляем мы.",
  },
  {
    question: "Где проходит оформление?",
    answer:
      "Во Владивостоке: автомобиль выгружается на терминал ТЛК, проходит СВХ и таможенное оформление через брокера, затем получает СБКТС и ЭПТС.",
  },
  {
    question: "Могут ли итоговые платежи отличаться от расчёта?",
    answer:
      "Калькулятор показывает вилку по текущему курсу ЦБ и действующим ставкам — это предварительная оценка. Точную смету под конкретный лот фиксирует менеджер до сделки; курс фиксируется на момент оплаты аукциона.",
  },
];

export default function CustomsPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Главная", url: "/" },
          { name: "Растаможка", url: "/customs" },
        ])}
      />

      <div className="mb-10 space-y-3">
        <span className="label">Таможня</span>
        <h1 className="font-display text-[32px] leading-tight font-semibold md:text-[40px] lg:text-[48px]">
          Растаможка авто из Японии
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Пошлина, утильсбор, СВХ, брокер, СБКТС и ЭПТС — все платежи видны в
          калькуляторе до сделки. Оформление проходит во Владивостоке, вы получаете
          полный пакет документов для постановки на учёт.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button asChild>
            <Link href="/calculator">Посчитать платежи</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/contacts">Задать вопрос</Link>
          </Button>
        </div>
      </div>

      <Separator className="my-12" />

      <section className="grid gap-8 md:grid-cols-3">
        <div>
          <span className="label">Пошлина</span>
          <p className="mt-3 text-sm text-muted-foreground">
            Зависит от таможенной стоимости, объёма двигателя и возраста.
            Калькулятор применяет действующие ставки автоматически.
          </p>
        </div>
        <div>
          <span className="label">Утильсбор</span>
          <p className="mt-3 text-sm text-muted-foreground">
            Зависит от типа техники, объёма, возраста и статуса покупателя:
            физлицо, юрлицо или перепродажа.
          </p>
        </div>
        <div>
          <span className="label">Фиксированные сборы</span>
          <p className="mt-3 text-sm text-muted-foreground">
            СВХ, услуги брокера, СБКТС — оформление под ключ, суммы видны
            в расшифровке расчёта.
          </p>
        </div>
      </section>

      <Faq items={FAQ_ITEMS} />

      <div className="mt-16 rounded-xl border border-border bg-muted/40 p-6">
        <p className="font-display text-lg font-semibold">
          Посчитайте таможенные платежи заранее
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Калькулятор покажет пошлину, утильсбор и сборы по вашим параметрам —
          до ставки на аукционе.
        </p>
        <div className="mt-4">
          <Button asChild>
            <Link href="/calculator">Открыть калькулятор</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
