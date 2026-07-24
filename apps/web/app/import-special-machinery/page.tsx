import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { JsonLd } from "@/components/JsonLd";
import { Faq } from "@/components/Faq";
import { breadcrumbJsonLd, type FaqItem } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Импорт спецтехники из Японии, Кореи и Китая — расчёт по запросу",
  description:
    "Экскаваторы, погрузчики, манипуляторы и другая спецтехника с аукционов Азии. Индивидуальная логистика и смета под ключ от оператора, доставка через Владивосток по всей России.",
  alternates: { canonical: "/import-special-machinery" },
};

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Почему спецтехника не считается в онлайн-калькуляторе?",
    answer:
      "У спецтехники нестандартная логистика: габариты, вес и способ погрузки отличаются от легковых авто, поэтому фрахт и оформление считаются индивидуально. Смету под ключ готовит оператор по конкретной единице техники.",
  },
  {
    question: "Какую технику вы привозите?",
    answer:
      "Мини-экскаваторы и экскаваторы, фронтальные погрузчики, бульдозеры, манипуляторы, грузовики и тягачи, а также мототехнику. Источники — аукционы и площадки Японии, Кореи и Китая.",
  },
  {
    question: "Как формируется стоимость?",
    answer:
      "Цена лота, внутренняя логистика страны покупки, морской фрахт до Владивостока, таможенные платежи и утилизационный сбор по действующим ставкам для данного типа техники, плюс фиксированные сборы за оформление. Всё фиксируется в смете до сделки.",
  },
  {
    question: "Работаете ли вы с юрлицами и лизингом?",
    answer:
      "Да, работаем с юридическими лицами: безналичная оплата, закрывающие документы, ЭДО. Условия под конкретную сделку (включая работу с лизинговыми компаниями) согласуются с менеджером.",
  },
  {
    question: "Как проверяется состояние техники перед покупкой?",
    answer:
      "По аукционному листу и фотоотчёту с площадки. По запросу менеджер предоставляет дополнительные фото и данные по конкретному лоту до ставки.",
  },
];

export default function ImportSpecialMachineryPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Главная", url: "/" },
          { name: "Импорт спецтехники", url: "/import-special-machinery" },
        ])}
      />

      <div className="mb-10 space-y-3">
        <span className="label">Спецтехника</span>
        <h1 className="font-display text-[32px] leading-tight font-semibold md:text-[40px] lg:text-[48px]">
          Импорт спецтехники из Азии
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Экскаваторы, погрузчики, манипуляторы, грузовики и тягачи с аукционов
          Японии, Кореи и Китая. Логистика и смета считаются индивидуально —
          оператор готовит расчёт под ключ по конкретной единице техники.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button asChild>
            <Link href="/contacts">Запросить смету</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/catalog">Смотреть каталог</Link>
          </Button>
        </div>
      </div>

      <Separator className="my-12" />

      <section>
        <h2 className="font-display text-2xl font-semibold">Как проходит сделка</h2>
        <ol className="mt-6 max-w-3xl list-decimal space-y-4 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Заявка.</span>{" "}
            Вы описываете тип техники, задачи и бюджет — менеджер подбирает
            варианты с аукционов и площадок Японии, Кореи и Китая.
          </li>
          <li>
            <span className="font-medium text-foreground">Проверка лота.</span>{" "}
            Аукционный лист, фотоотчёт, при необходимости — дополнительные данные
            по запросу до ставки.
          </li>
          <li>
            <span className="font-medium text-foreground">Индивидуальная смета.</span>{" "}
            Оператор считает фрахт под габариты и вес, таможенные платежи и
            оформление. Смета фиксируется до сделки.
          </li>
          <li>
            <span className="font-medium text-foreground">Покупка и логистика.</span>{" "}
            Торги, оплата (безнал для юрлиц), морская доставка до Владивостока,
            терминал ТЛК.
          </li>
          <li>
            <span className="font-medium text-foreground">Таможня и документы.</span>{" "}
            Растаможка и полный пакет документов для эксплуатации и учёта.
          </li>
          <li>
            <span className="font-medium text-foreground">Доставка по РФ.</span>{" "}
            Автовоз или ж/д до вашего города — работаем по всей России.
          </li>
        </ol>
      </section>

      <Faq items={FAQ_ITEMS} />

      <div className="mt-16 rounded-xl border border-border bg-muted/40 p-6">
        <p className="font-display text-lg font-semibold">
          Расчёт по спецтехнике — только через оператора
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Оставьте заявку с типом техники и задачами — менеджер вернётся со сметой
          под ключ.
        </p>
        <div className="mt-4">
          <Button asChild>
            <Link href="/contacts">Оставить заявку</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
