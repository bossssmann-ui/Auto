import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { JsonLd } from "@/components/JsonLd";
import { Faq } from "@/components/Faq";
import { GEO_CITIES } from "@/lib/geo/cities";
import { breadcrumbJsonLd, type FaqItem } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Доставка авто и техники из Японии — маршрут через Владивосток",
  description:
    "Маршрут доставки: аукцион → порт Японии → морской фрахт → Владивосток → терминал ТЛК → автовоз по России. Каждый этап зафиксирован в договоре.",
  alternates: { canonical: "/delivery" },
};

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Каким маршрутом едет автомобиль?",
    answer:
      "Аукцион → порт Японии → морской фрахт → Владивосток → терминал ТЛК → растаможка → автовоз в ваш город. Каждый этап зафиксирован в договоре на логистику.",
  },
  {
    question: "Можно ли забрать авто во Владивостоке самостоятельно?",
    answer:
      "Да. Терминал ТЛК во Владивостоке — точка выдачи и осмотра: можно принять автомобиль лично до отправки автовозом или забрать его там после оформления документов.",
  },
  {
    question: "В какие города вы доставляете?",
    answer:
      "По всей России. После растаможки и оформления автомобиль отправляется автовозом (для отдельных направлений — ж/д) до вашего города.",
  },
  {
    question: "От чего зависят сроки доставки?",
    answer:
      "От даты торгов, расписания судов из портов Японии и загрузки терминала. Ориентир по конкретному лоту и направлению менеджер подтверждает до сделки.",
  },
  {
    question: "Почему санкционные авто едут дольше и дороже?",
    answer:
      "Гибриды, электромобили, авто с двигателем больше 1900 см³ и микроавтобусы запрещены к прямому экспорту из Японии в РФ с августа 2023 года. Они доставляются через третьи страны — это отдельный маршрут с повышенной ставкой фрахта.",
  },
];

export default function DeliveryPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Главная", url: "/" },
          { name: "Доставка", url: "/delivery" },
        ])}
      />

      <div className="mb-10 space-y-3">
        <span className="label">Доставка</span>
        <h1 className="font-display text-[32px] leading-tight font-semibold md:text-[40px] lg:text-[48px]">
          Доставка авто и техники по России
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Точка входа — Владивосток: морской фрахт из портов Японии, терминал ТЛК,
          растаможка и автовоз до вашего города. Все этапы — в договоре.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button asChild>
            <Link href="/calculator">Посчитать с фрахтом</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/contacts">Уточнить сроки</Link>
          </Button>
        </div>
      </div>

      <Separator className="my-12" />

      <section>
        <h2 className="font-display text-2xl font-semibold">Этапы маршрута</h2>
        <ol className="mt-6 max-w-3xl list-decimal space-y-4 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Аукцион → порт Японии.</span>{" "}
            После выигрыша лота автомобиль перегоняется с площадки аукциона в порт
            отправки — это внутренняя логистика Японии, она входит в смету.
          </li>
          <li>
            <span className="font-medium text-foreground">Морской фрахт.</span>{" "}
            Судно до Владивостока. Для санкционных машин — маршрут через третьи
            страны с повышенной ставкой (считается в калькуляторе автоматически).
          </li>
          <li>
            <span className="font-medium text-foreground">Терминал ТЛК, Владивосток.</span>{" "}
            Выгрузка, СВХ, осмотр. Здесь можно принять авто лично.
          </li>
          <li>
            <span className="font-medium text-foreground">Растаможка и документы.</span>{" "}
            Пошлина, утильсбор, брокер, СБКТС, ЭПТС.
          </li>
          <li>
            <span className="font-medium text-foreground">Автовоз по РФ.</span>{" "}
            Доставка до вашего города; для отдельных направлений используется ж/д.
          </li>
        </ol>
      </section>

      <Separator className="my-12" />

      <section>
        <h2 className="font-display text-xl font-semibold">Доставка по городам</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Ориентировочные сроки и тарифы автовоза из Владивостока — на страницах
          городов:
        </p>
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {GEO_CITIES.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/avto-iz-yaponii/${c.slug}`}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Faq items={FAQ_ITEMS} />

      <div className="mt-16 rounded-xl border border-border bg-muted/40 p-6">
        <p className="font-display text-lg font-semibold">Сколько будет стоить с доставкой?</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Фрахт до Владивостока уже входит в расчёт калькулятора. Стоимость автовоза
          до вашего города уточнит менеджер.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/calculator">Открыть калькулятор</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/contacts">Оставить заявку</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
