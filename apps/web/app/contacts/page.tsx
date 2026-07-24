import type { Metadata } from "next";
import { BentoGrid } from "@/components/BentoGrid";
import { BentoTile } from "@/components/BentoTile";
import { Button } from "@/components/ui/button";
import { ContactLeadForm } from "@/components/Lead/ContactLeadForm";
import { TELEGRAM_BOT_USERNAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Контакты — SpecTechMash (Спецтехмаш)",
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
            Заполните форму — менеджер перезвонит и ответит на вопросы по подбору,
            расчёту и доставке.
          </p>
          <ContactLeadForm source="contacts" className="relative mt-6" />
        </BentoTile>

        <BentoTile colSpan={4}>
          <span className="label">Телефон / мессенджеры</span>
          <h3 className="mt-4 font-display text-xl font-semibold">Написать или позвонить</h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li>
              <a
                href="tel:+79147285880"
                className="font-medium transition-colors hover:text-muted-foreground"
              >
                +7 914 728-58-80
              </a>
            </li>
            <li>
              <a
                href="https://wa.me/79147285880"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-muted-foreground"
              >
                WhatsApp
              </a>
            </li>
            <li>
              <a
                href="https://t.me/+79147285880"
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-muted-foreground"
              >
                Telegram
              </a>
            </li>
            <li>
              <a
                href="mailto:bossmann@inbox.ru"
                className="transition-colors hover:text-muted-foreground"
              >
                bossmann@inbox.ru
              </a>
            </li>
          </ul>
        </BentoTile>

        <BentoTile colSpan={4}>
          <span className="label">Telegram-бот</span>
          <h3 className="mt-4 font-display text-xl font-semibold">Расчёт в чате</h3>
          <p className="mt-3 text-sm text-muted-foreground">
            Подбор, расчёт и согласование сделки — всё в Telegram. Бот видит курс ЦБ онлайн.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-6 w-fit">
            <a
              href={`https://t.me/${TELEGRAM_BOT_USERNAME}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Открыть бота
            </a>
          </Button>
        </BentoTile>

        <BentoTile colSpan={4}>
          <span className="label">Точка выдачи</span>
          <p className="mt-4 text-sm text-muted-foreground">
            Владивосток · Приморский край. Терминал ТЛК — точка выдачи и осмотра до отправки
            автовозом.
          </p>
        </BentoTile>

        <BentoTile colSpan={12}>
          <span className="label">Реквизиты</span>
          <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Юр. лицо</dt>
              <dd className="font-medium">ИП Хмелев Роман Александрович</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">ИНН</dt>
              <dd className="font-medium">250816461839</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">ОГРНИП</dt>
              <dd className="font-medium">322253600061684</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Адрес регистрации</dt>
              <dd className="font-medium">
                692906, Приморский край, г. Находка, ул. Шоссейная, д. 22, кв. 1
              </dd>
            </div>
          </dl>
        </BentoTile>
      </BentoGrid>
    </div>
  );
}
