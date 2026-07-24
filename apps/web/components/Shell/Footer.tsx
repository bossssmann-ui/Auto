import Link from "next/link";
import { BrandMark } from "@/components/Shell/BrandMark";
import { SOCIAL_LINKS, TELEGRAM_BOT_USERNAME } from "@/lib/seo";

/**
 * Minimal footer per spec §4.6 rule 2.
 * Copy is intentionally specific and technical — no marketing fluff.
 * Social links: only channels that actually exist (no href="#" stubs);
 * VK / Telegram-channel appear here once created (PROJECT_PLAN P5-02).
 */
export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 px-6 py-12 text-sm md:grid-cols-4 lg:px-8">
        <div className="space-y-3">
          <p>
            <BrandMark />
          </p>
          <p className="text-muted-foreground">
            Импорт автомобилей, мототехники и спецтехники из Японии, Кореи и Китая.
            Логистика через терминал ТЛК.
          </p>
        </div>

        <div className="space-y-3">
          <p className="label">Услуги</p>
          <ul className="space-y-2">
            <li>
              <Link
                href="/import-auto-japan"
                className="text-foreground transition-colors hover:text-muted-foreground"
              >
                Импорт авто из Японии
              </Link>
            </li>
            <li>
              <Link
                href="/import-special-machinery"
                className="text-foreground transition-colors hover:text-muted-foreground"
              >
                Импорт спецтехники
              </Link>
            </li>
            <li>
              <Link
                href="/delivery"
                className="text-foreground transition-colors hover:text-muted-foreground"
              >
                Доставка по России
              </Link>
            </li>
            <li>
              <Link
                href="/customs"
                className="text-foreground transition-colors hover:text-muted-foreground"
              >
                Растаможка
              </Link>
            </li>
          </ul>
        </div>

        <div className="space-y-3">
          <p className="label">Каталог</p>
          <ul className="space-y-2">
            <li>
              <Link
                href="/catalog"
                className="text-foreground transition-colors hover:text-muted-foreground"
              >
                Все аукционные лоты
              </Link>
            </li>
            <li>
              <Link
                href="/calculator"
                className="text-foreground transition-colors hover:text-muted-foreground"
              >
                Калькулятор под ключ
              </Link>
            </li>
            <li>
              <Link
                href="/about"
                className="text-foreground transition-colors hover:text-muted-foreground"
              >
                О компании и логистике
              </Link>
            </li>
          </ul>
        </div>

        <div className="space-y-3">
          <p className="label">Контакты</p>
          <ul className="space-y-2 text-muted-foreground">
            <li>
              <Link
                href="/contacts"
                className="text-foreground transition-colors hover:text-muted-foreground"
              >
                Написать менеджеру
              </Link>
            </li>
            <li>
              <a
                href="tel:+79147285880"
                className="text-foreground transition-colors hover:text-muted-foreground"
              >
                +7 914 728-58-80
              </a>
            </li>
            <li>
              <a
                href="mailto:bossmann@inbox.ru"
                className="text-foreground transition-colors hover:text-muted-foreground"
              >
                bossmann@inbox.ru
              </a>
            </li>
            <li>
              <a
                href={`https://t.me/${TELEGRAM_BOT_USERNAME}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground transition-colors hover:text-muted-foreground"
              >
                Telegram-бот для расчёта
              </a>
            </li>
            <li>
              <a
                href={SOCIAL_LINKS.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground transition-colors hover:text-muted-foreground"
              >
                YouTube
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-6 lg:px-8">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} SpecTechMash / Спецтехмаш. Все права защищены.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            ИП Хмелев Р.&nbsp;А. · ИНН&nbsp;250816461839 · ОГРНИП&nbsp;322253600061684
          </p>
        </div>
      </div>
    </footer>
  );
}
