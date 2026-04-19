import type { Metadata } from "next";
import { BentoGrid } from "@/components/BentoGrid";
import { BentoTile } from "@/components/BentoTile";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Контакты — СпецТехМаш",
  description:
    "Оставьте заявку менеджеру или напишите в Telegram-бот — круглосуточный расчёт стоимости под ключ.",
  alternates: { canonical: "/contacts" },
};

export default function ContactsPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
      <div className="mb-10 space-y-3">
        <span className="label">Contacts</span>
        <h1 className="font-display text-[32px] leading-tight font-semibold md:text-[40px] lg:text-[48px]">
          Связаться с нами
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Менеджер отвечает в рабочее время — в среднем за 15 минут. Круглосуточно — наш
          Telegram-бот: подберёт модель и рассчитает стоимость.
        </p>
      </div>

      <BentoGrid>
        <BentoTile colSpan={8} rowSpan={2}>
          <span className="label">Form</span>
          <h2 className="mt-4 font-display text-2xl font-semibold">Оставить заявку</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Форма подключится к существующему lead-endpoint в <code className="rounded bg-muted px-1 py-0.5 text-xs">server/</code> в следующей фазе: Telegram-уведомление + amoCRM-контакт/лид.
          </p>
        </BentoTile>

        <BentoTile colSpan={4}>
          <span className="label">Telegram-бот</span>
          <h3 className="mt-4 font-display text-xl font-semibold">Расчёт в чате</h3>
          <p className="mt-3 text-sm text-muted-foreground">
            Подбор, расчёт и согласование сделки — всё в Telegram. Бот видит курс ЦБ онлайн.
          </p>
          <Button variant="outline" size="sm" className="mt-6 w-fit">
            Открыть бота
          </Button>
        </BentoTile>

        <BentoTile colSpan={4}>
          <span className="label">Офис</span>
          <p className="mt-4 text-sm text-muted-foreground">
            Владивосток · Приморский край. Терминал ТЛК — точка выдачи и осмотра до отправки
            автовозом.
          </p>
        </BentoTile>
      </BentoGrid>
    </div>
  );
}
