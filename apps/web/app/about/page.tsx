import type { Metadata } from "next";
import { BentoGrid } from "@/components/BentoGrid";
import { BentoTile } from "@/components/BentoTile";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "О компании — SpecTechMash (Спецтехмаш)",
  description:
    "Импорт авто, мототехники и спецтехники из Японии, Кореи и Китая напрямую с аукционов. Логистика через терминал ТЛК во Владивостоке, доставка по всей России.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
      <div className="mb-10 space-y-3">
        <span className="label">About</span>
        <h1 className="font-display text-[32px] leading-tight font-semibold md:text-[40px] lg:text-[48px]">
          SpecTechMash · Спецтехмаш
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Мы возим авто, мототехнику и спецтехнику из Японии, Кореи и Китая напрямую с аукционов.
          Логистика через терминал ТЛК во Владивостоке.
        </p>
      </div>

      <BentoGrid>
        <BentoTile colSpan={6}>
          <span className="label">Logistics</span>
          <h2 className="mt-4 font-display text-2xl font-semibold">Маршрут</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Аукцион → порт → фрахт → Владивосток → терминал ТЛК → растаможка → автовоз. Каждый этап
            зафиксирован в договоре.
          </p>
        </BentoTile>

        <BentoTile colSpan={6}>
          <span className="label">Numbers</span>
          <h2 className="mt-4 font-display text-2xl font-semibold">Что мы делаем</h2>
          <dl className="mt-4 grid grid-cols-2 gap-y-3 text-sm">
            <dt className="text-muted-foreground">Аукционы</dt>
            <dd>USS · TAA · HAA · Korean</dd>
            <dt className="text-muted-foreground">Оформление</dt>
            <dd>СБКТС, ЭПТС, постановка на учёт</dd>
            <dt className="text-muted-foreground">Клиенты</dt>
            <dd>Физлица и юрлица</dd>
            <dt className="text-muted-foreground">География</dt>
            <dd>По всей России · автовоз</dd>
          </dl>
        </BentoTile>
      </BentoGrid>

      <Separator className="my-16" />

      <div className="grid gap-8 md:grid-cols-3">
        <div>
          <span className="label">Документы</span>
          <p className="mt-3 text-sm text-muted-foreground">
            Договор на подбор, договор на логистику, закрывающие. Работаем по ЭДО.
          </p>
        </div>
        <div>
          <span className="label">Оплата</span>
          <p className="mt-3 text-sm text-muted-foreground">
            Безнал для юрлиц, карта / перевод для физлиц. Валютный курс фиксируется на момент
            оплаты аукциона.
          </p>
        </div>
        <div>
          <span className="label">Гарантии</span>
          <p className="mt-3 text-sm text-muted-foreground">
            Аукционный лист — основа. В случае расхождения grade/состояния — возврат части
            комиссии.
          </p>
        </div>
      </div>
    </div>
  );
}
