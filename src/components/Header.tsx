import { useState } from 'react'

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)

  const navLinks = [
    { href: '#hero', label: 'Главная' },
    { href: '#services', label: 'Автомобили' },
    { href: '#services', label: 'Мототехника' },
    { href: '#services', label: 'Спецтехника' },
    { href: '#calculator', label: 'Калькулятор' },
    { href: '#trust', label: 'О компании' },
    { href: '#footer', label: 'Контакты' },
  ]

  return (
    <header className="sticky top-0 z-50 bg-white shadow-md transition-shadow duration-300">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between md:h-20">
          {/* Logo */}
          <a href="#hero" className="flex items-center gap-2">
            <span className="text-xl font-extrabold tracking-tight text-primary md:text-2xl">
              СПЕЦТЕХМАШ
            </span>
          </a>

          {/* Desktop Nav */}
          <nav className="hidden items-center gap-6 lg:flex">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-text-secondary transition-colors hover:text-primary"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Right side */}
          <div className="hidden items-center gap-4 lg:flex">
            <a
              href="tel:+79991234567"
              className="text-sm font-semibold text-primary"
            >
              +7 (999) 123-45-67
            </a>
            <a
              href="#lead"
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-light"
            >
              Получить консультацию
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            className="flex items-center lg:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Открыть меню"
          >
            <svg
              className="h-7 w-7 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-surface-dark bg-white lg:hidden">
          <nav className="mx-auto max-w-7xl space-y-1 px-4 py-4">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-3 py-2 text-base font-medium text-text-secondary transition-colors hover:bg-surface hover:text-primary"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-4 border-t border-surface-dark pt-4">
              <a href="tel:+79991234567" className="block px-3 py-2 text-base font-semibold text-primary">
                +7 (999) 123-45-67
              </a>
              <a
                href="#lead"
                onClick={() => setMenuOpen(false)}
                className="mt-2 block rounded-lg bg-accent px-5 py-2.5 text-center text-base font-semibold text-white transition-colors hover:bg-accent-light"
              >
                Получить консультацию
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
