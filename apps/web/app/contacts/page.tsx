import type { Metadata } from "next";
import { BentoGrid } from "@/components/BentoGrid";
import { BentoTile } from "@/components/BentoTile";
import { Button } from "@/components/ui/button";
import { ContactLeadForm } from "@/components/Lead/ContactLeadForm";
import { CONTACTS, ORG, TELEGRAM_BOT_USERNAME } from "@/lib/seo";

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
          <span className="label">Связь напрямую</span>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <a href={`tel:${CONTACTS.phoneE164}`} className="font-medium hover:underline">
                {CONTACTS.phoneDisplay}
              </a>{" "}
              <span className="text-muted-foreground">— звонок, Telegram и WhatsApp</span>
            </li>
            <li>
              <a
                href={CONTACTS.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                Написать в WhatsApp
              </a>
            </li>
            <li>
              <a href={`mailto:${CONTACTS.email}`} className="hover:underline">
                {CONTACTS.email}
              </a>
            </li>
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">
            {CONTACTS.pickupPoint} — точка выдачи и осмотра до отправки автовозом.
          </p>
        </BentoTile>

        <BentoTile colSpan={4}>
          <span className="label">Реквизиты</span>
          <dl className="mt-4 space-y-1.5 text-sm">
            <div>
              <dt className="inline text-muted-foreground">Юр. лицо: </dt>
              <dd className="inline">{ORG.legalName}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">ИНН: </dt>
              <dd className="inline tabular-nums">{CONTACTS.inn}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">ОГРНИП: </dt>
              <dd className="inline tabular-nums">{CONTACTS.ogrnip}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">Адрес: </dt>
              <dd className="inline">{CONTACTS.legalAddress}</dd>
            </div>
          </dl>
        </BentoTile>
      </BentoGrid>
    </div>
  );
}
