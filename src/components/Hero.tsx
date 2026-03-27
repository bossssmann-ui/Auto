import { useState } from 'react'

/**
 * Split-Hero: Interactive 3-panel hero that routes users to their hub.
 *
 * Psychological reasoning:
 * - B2B panel uses dark graphite + signal yellow to convey industrial reliability
 * - B2C panel uses clean white + trust blue for a premium, Apple-style feel
 * - Moto panel uses matte black + speed red for adrenaline and dynamism
 *
 * On desktop, panels sit side-by-side; hovered panel expands.
 * On mobile, panels stack vertically with equal weight.
 */
export default function Hero() {
  const [hovered, setHovered] = useState<number | null>(null)

  const stats = [
    { value: '2500+', label: 'единиц техники доставлено' },
    { value: '8 лет', label: 'на рынке импорта' },
    { value: '0', label: 'скрытых платежей' },
    { value: 'от 25', label: 'дней — полный цикл' },
  ]

  const panels = [
    {
      id: 'b2b',
      /* B2B: Dark Graphite + Signal Yellow — industrial authority */
      bg: 'bg-hub-b2b',
      overlayFrom: 'from-hub-b2b/90',
      overlayTo: 'to-hub-b2b-light/70',
      label: 'Спецтехника',
      heading: 'Для Бизнеса.',
      subheading: 'Спецтехника с ПСМ и НДС 22%.',
      description:
        'Экскаваторы, погрузчики, бульдозеры из Японии, Кореи и Китая. Агентские договоры, реальные моточасы, ЭПТС.',
      cta: 'Каталог техники',
      href: '#heavy-machinery',
      btnClass: 'bg-hub-b2b-accent text-hub-b2b hover:bg-yellow-300',
      textColor: 'text-white',
      subColor: 'text-gray-300',
      accentText: 'text-hub-b2b-accent',
      icon: '🏗️',
    },
    {
      id: 'b2c',
      /* B2C: Clean White + Trust Blue — premium consumer feel */
      bg: 'bg-hub-b2c',
      overlayFrom: 'from-white/90',
      overlayTo: 'to-gray-50/80',
      label: 'Автомобили',
      heading: 'Для Себя.',
      subheading: 'Авто из Азии без переплат.',
      description:
        'Экономия до 30%. Санкционные авто. Прозрачный утильсбор. Честный аукционный лист с переводом.',
      cta: 'Рассчитать авто',
      href: '#calculator',
      btnClass: 'bg-hub-b2c-accent text-white hover:bg-blue-700',
      textColor: 'text-gray-900',
      subColor: 'text-gray-600',
      accentText: 'text-hub-b2c-accent',
      icon: '🚗',
    },
    {
      id: 'moto',
      /* Moto: Matte Black + Speed Red — adrenaline and exclusivity */
      bg: 'bg-hub-moto',
      overlayFrom: 'from-hub-moto/90',
      overlayTo: 'to-hub-moto-light/70',
      label: 'Мотоциклы',
      heading: 'Для Свободы.',
      subheading: 'Мотоциклы с аукционов Японии.',
      description:
        'Без пробега по РФ. Безопасная доставка в деревянной обрешётке. Аукционы BDS и JBA.',
      cta: 'Выбрать байк',
      href: '#calculator',
      btnClass: 'bg-hub-moto-accent text-white hover:bg-red-700',
      textColor: 'text-white',
      subColor: 'text-gray-400',
      accentText: 'text-hub-moto-accent',
      icon: '🏍️',
    },
  ]

  return (
    <section id="hero" className="relative">
      {/* Split panels */}
      <div className="flex min-h-[520px] flex-col lg:flex-row lg:min-h-[600px]">
        {panels.map((panel, i) => {
          const isHovered = hovered === i
          const isOther = hovered !== null && hovered !== i

          return (
            <div
              key={panel.id}
              className={`
                relative flex flex-1 cursor-pointer flex-col justify-center overflow-hidden
                px-6 py-12 transition-all duration-500 ease-in-out
                sm:px-10 md:py-16 lg:px-8 xl:px-12
                ${panel.bg}
                ${isHovered ? 'lg:flex-[2]' : ''}
                ${isOther ? 'lg:flex-[0.7]' : ''}
              `}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Gradient overlay */}
              <div
                className={`absolute inset-0 bg-gradient-to-b ${panel.overlayFrom} ${panel.overlayTo}`}
              />

              {/* Content */}
              <div className="relative z-10 mx-auto max-w-md">
                <div className="text-4xl">{panel.icon}</div>
                <span
                  className={`mt-3 inline-block text-xs font-bold uppercase tracking-widest ${panel.accentText}`}
                >
                  {panel.label}
                </span>
                <h2
                  className={`mt-2 font-heading text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl lg:text-2xl xl:text-3xl ${panel.textColor}`}
                >
                  {panel.heading}
                  <br />
                  <span className={panel.accentText}>
                    {panel.subheading}
                  </span>
                </h2>
                <p className={`mt-3 text-sm leading-relaxed sm:text-base ${panel.subColor}`}>
                  {panel.description}
                </p>
                <a
                  href={panel.href}
                  className={`mt-6 inline-block rounded-lg px-6 py-3 text-sm font-bold shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl sm:px-8 sm:py-3.5 sm:text-base ${panel.btnClass}`}
                >
                  {panel.cta}
                </a>
              </div>
            </div>
          )
        })}
      </div>

      {/* Stats bar below panels */}
      <div className="bg-gradient-to-r from-primary-dark via-primary to-primary-light">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-8">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl bg-white/10 px-4 py-4 text-center backdrop-blur-sm"
              >
                <div className="text-xl font-extrabold text-gold-light md:text-2xl">
                  {stat.value}
                </div>
                <div className="mt-1 text-xs text-blue-200 sm:text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
