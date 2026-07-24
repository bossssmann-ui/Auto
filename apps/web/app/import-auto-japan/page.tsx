import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { JsonLd } from "@/components/JsonLd";
import { Faq } from "@/components/Faq";
import { breadcrumbJsonLd, type FaqItem } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Импорт авто из Японии под ключ — аукционы, расчёт в рублях",
  description:
    "Покупка автомобилей на японских аукционах (USS, TAA, HAA) с расчётом под ключ в рублях: пошлина, утильсбор, фрахт, СБКТС и ЭПТС. Доставка через Владивосток по всей России.",
  alternates: { canonical: "/import-auto-japan" },
};

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Что входит в цену «под ключ»?",
    answer:
      "Цена лота на аукционе (FOB), внутренняя логистика по Японии, морской фрахт до Владивостока, таможенная пошлина, утилизационный сбор и фиксированные сборы: СВХ, услуги брокера, СБКТС. Именно эти составляющие показывает наш калькулятор.",
  },
  {
    question: "По какому курсу считается стоимость?",
    answer:
      "По официальному курсу ЦБ РФ с банковской надбавкой 1.04 на иену и доллар. Курс фиксируется на момент оплаты аукциона.",
  },
  {
    question: "Какие автомобили считаются санкционными?",
    answer:
      "С августа 2023 года Япония запретила прямой экспорт в РФ гибридов, электромобилей, автомобилей с двигателем больше 1900 см³ и микроавтобусов. Такие машины везутся через третьи страны с повышенной ставкой фрахта — калькулятор учитывает это автоматически, финальную смету подтверждает оператор.",
  },
  {
    question: "Какие документы я получу?",
    answer:
      "Договор на подбор и договор на логистику, аукционный лист, инвойс, таможенную декларацию, СБКТС и ЭПТС. С этим пакетом автомобиль ставится на учёт в ГИБДД.",
  },
  {
    question: "Сколько занимает доставка?",
    answer:
      "Срок зависит от даты торгов, расписания судов и загрузки терминала во Владивостоке. Точный ориентир по конкретному лоту и вашему городу подтверждает менеджер до сделки.",
  },
  {
    question: "Что такое аукционный лист и зачем он нужен?",
    answer:
      "Аукционный лист — официальная оценка состояния автомобиля инспектором аукциона: кузов, салон, пробег, дефекты. Мы покупаем только по аукционному листу; при расхождении заявленной оценки с фактическим состоянием возвращаем часть комиссии.",
  },
];

export default function ImportAutoJapanPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Главная", url: "/" },
          { name: "Импорт авто из Японии", url: "/import-auto-japan" },
        ])}
      />

      <div className="mb-10 space-y-3">
        <span className="label">Импорт из Японии</span>
        <h1 className="font-display text-[32px] leading-tight font-semibold md:text-[40px] lg:text-[48px]">
          Импорт авто из Японии под ключ
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Покупаем автомобили напрямую на японских аукционах USS, TAA и HAA,
          привозим через Владивосток и отдаём с полным пакетом документов.
          Стоимость считается в рублях до сделки — без скрытых доплат на этапах.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button asChild>
            <Link href="/calculator">Посчитать стоимость</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/catalog">Смотреть лоты</Link>
          </Button>
        </div>
      </div>

      <Separator className="my-12" />

      <section>
        <h2 className="font-display text-2xl font-semibold">Как проходит сделка</h2>
        <ol className="mt-6 max-w-3xl list-decimal space-y-4 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Подбор.</span>{" "}
            Вы описываете модель, бюджет и требования — менеджер или Telegram-бот
            подбирает лоты с актуальных торгов и показывает аукционные листы.
          </li>
          <li>
            <span className="font-medium text-foreground">Расчёт под ключ.</span>{" "}
            До ставки вы видите полную смету в рублях: цена лота, фрахт, пошлина,
            утильсбор, СБКТС и фиксированные сборы.
          </li>
          <li>
            <span className="font-medium text-foreground">Торги и оплата.</span>{" "}
            Ставим на аукционе от вашего имени. После выигрыша фиксируется курс,
            оплата — безнал для юрлиц, карта или перевод для физлиц.
          </li>
          <li>
            <span className="font-medium text-foreground">Логистика.</span>{" "}
            Аукцион → порт Японии → морской фрахт → Владивосток → терминал ТЛК.
            Каждый этап зафиксирован в договоре.
          </li>
          <li>
            <span className="font-medium text-foreground">Таможня и документы.</span>{" "}
            Растаможка, СВХ, брокер, СБКТС и ЭПТС — оформляем полностью.
          </li>
          <li>
            <span className="font-medium text-foreground">Выдача.</span>{" "}
            Забираете авто на терминале во Владивостоке или заказываете автовоз
            в свой город — работаем по всей России.
          </li>
        </ol>
      </section>

      <Separator className="my-12" />

      <section className="grid gap-8 md:grid-cols-3">
        <div>
          <span className="label">Аукционы</span>
          <p className="mt-3 text-sm text-muted-foreground">
            USS, TAA, HAA — крупнейшие площадки Японии. Покупка только по
            аукционному листу с оценкой инспектора.
          </p>
        </div>
        <div>
          <span className="label">Оформление</span>
          <p className="mt-3 text-sm text-muted-foreground">
            СБКТС, ЭПТС, таможенная декларация — полный пакет для постановки
            на учёт. Работаем с физлицами и юрлицами, ЭДО.
          </p>
        </div>
        <div>
          <span className="label">Гарантии</span>
          <p className="mt-3 text-sm text-muted-foreground">
            Основа сделки — аукционный лист. При расхождении оценки с фактическим
            состоянием возвращаем часть комиссии.
          </p>
        </div>
      </section>

      <Faq items={FAQ_ITEMS} />

      <div className="mt-16 rounded-xl border border-border bg-muted/40 p-6">
        <p className="font-display text-lg font-semibold">Нужна точная смета?</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Посчитайте вилку в калькуляторе или оставьте заявку — менеджер подтвердит
          стоимость под конкретный лот.
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
