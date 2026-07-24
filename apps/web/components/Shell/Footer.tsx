import Link from "next/link";

/**
 * Minimal 3-column footer per spec §4.6 rule 2.
 * Copy is intentionally specific and technical — no marketing fluff.
 */
export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-10 px-6 py-12 text-sm md:grid-cols-4 lg:px-8">
        <div className="space-y-3">
          <p className="font-display text-base font-semibold tracking-tight">СпецТехМаш</p>
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
            <li>Telegram-бот для расчёта</li>
            <li>Юридическое лицо · работаем с физлицами</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <p className="mx-auto max-w-7xl px-6 py-6 text-xs text-muted-foreground lg:px-8">
          © {new Date().getFullYear()} СпецТехМаш · Тихоокеанская Звезда. Все права защищены.
        </p>
      </div>
    </footer>
  );
}
