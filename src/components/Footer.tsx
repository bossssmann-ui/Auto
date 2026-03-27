export default function Footer() {
  const navLinks = [
    { href: '#hero', label: 'Главная' },
    { href: '#services', label: 'Услуги' },
    { href: '#calculator', label: 'Калькулятор' },
    { href: '#trust', label: 'О компании' },
    { href: '#delivery', label: 'Доставка' },
    { href: '#lead', label: 'Каталог' },
  ]

  return (
    <footer id="footer" className="bg-primary-dark pt-16 pb-8 text-blue-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-3 lg:grid-cols-4">
          {/* Company info */}
          <div className="lg:col-span-2">
            <span className="text-2xl font-extrabold text-white">
              СПЕЦТЕХМАШ
            </span>
            <p className="mt-4 max-w-md text-sm leading-relaxed">
              Импорт автомобилей, мототехники и спецтехники из Японии, Кореи и
              Китая. Работаем с 2016 года. Полный цикл под ключ.
            </p>
            <div className="mt-6 space-y-2 text-sm">
              <p>ООО &laquo;Спецтехмаш&raquo;</p>
              <p>ИНН: 2536123456</p>
              <p>ОГРН: 1022502123456</p>
              <p>690001, г. Владивосток, ул. Алеутская, д. 45, офис 301</p>
            </div>
          </div>

          {/* Nav links */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
              Навигация
            </h3>
            <ul className="mt-4 space-y-2">
              {navLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm transition-colors hover:text-white"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contacts */}
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">
              Контакты
            </h3>
            <div className="mt-4 space-y-3 text-sm">
              <a
                href="tel:+79991234567"
                className="block transition-colors hover:text-white"
              >
                +7 (999) 123-45-67
              </a>
              <a
                href="mailto:info@spectekhmash.ru"
                className="block transition-colors hover:text-white"
              >
                info@spectekhmash.ru
              </a>
            </div>

            {/* Social */}
            <div className="mt-6 flex gap-4">
              <a
                href="#"
                aria-label="Telegram"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-lg transition-colors hover:bg-white/20"
              >
                ✈️
              </a>
              <a
                href="#"
                aria-label="WhatsApp"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-lg transition-colors hover:bg-white/20"
              >
                📱
              </a>
              <a
                href="#"
                aria-label="ВКонтакте"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-lg transition-colors hover:bg-white/20"
              >
                💬
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-8 text-center text-xs text-blue-300">
          © {new Date().getFullYear()} ООО &laquo;Спецтехмаш&raquo;. Все права
          защищены.
        </div>
      </div>
    </footer>
  )
}
