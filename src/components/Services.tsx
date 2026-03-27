export default function Services() {
  const services = [
    {
      emoji: '🚜',
      title: 'Спецтехника',
      items: [
        'Экскаваторы, погрузчики, краны, бульдозеры',
        'Япония, Корея, Китай',
        'Таможня с ПСМ, утильсбор, НДС 22%',
        'Техосмотр до покупки: гидравлика, моточасы',
      ],
      cta: 'Подобрать технику',
      href: '#heavy-machinery',
      highlight: true,
    },
    {
      emoji: '🚗',
      title: 'Автомобили',
      items: [
        'Японские аукционы (USS, TAA, CAA)',
        'Корейские дилеры',
        'Китайские заводы-производители',
        'Полное оформление: СБКТС + ЭПТС',
      ],
      cta: 'Рассчитать стоимость',
      href: '#calculator',
      highlight: false,
    },
    {
      emoji: '🏍',
      title: 'Мототехника',
      items: [
        'Спортбайки, круизёры, эндуро',
        'Из Японии и Китая',
        'С аукционов и от дилеров напрямую',
        'Доставка и растаможка «под ключ»',
      ],
      cta: 'Рассчитать стоимость',
      href: '#calculator',
      highlight: false,
    },
  ]

  return (
    <section id="services" className="bg-white py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-extrabold text-primary sm:text-3xl md:text-4xl">
          Направления импорта
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-text-secondary">
          Спецтехника, коммерческий и легковой транспорт — полный цикл от аукциона до площадки
        </p>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {services.map((svc) => (
            <div
              key={svc.title}
              className={`group rounded-2xl border bg-white p-6 transition-all hover:-translate-y-1 hover:shadow-xl md:p-8 ${svc.highlight ? 'border-accent ring-2 ring-accent/20' : 'border-surface-dark'}`}
            >
              {svc.highlight && (
                <span className="mb-3 inline-block rounded-full bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent">
                  Основное направление
                </span>
              )}
              <div className="text-5xl">{svc.emoji}</div>
              <h3 className="mt-4 text-xl font-bold text-text-primary">
                {svc.title}
              </h3>
              <ul className="mt-4 space-y-2">
                {svc.items.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-text-secondary"
                  >
                    <span className="mt-1 text-gold">▸</span>
                    {item}
                  </li>
                ))}
              </ul>
              <a
                href={svc.href}
                className={`mt-6 inline-block rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-colors ${svc.highlight ? 'bg-accent hover:bg-accent-light' : 'bg-primary hover:bg-primary-light'}`}
              >
                {svc.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
