export default function Services() {
  const services = [
    {
      emoji: '🚗',
      title: 'Автомобили',
      items: [
        'Японские аукционы',
        'Корейские дилеры',
        'Китайские заводы-производители',
      ],
    },
    {
      emoji: '🏍',
      title: 'Мототехника',
      items: [
        'Спортбайки, круизёры, эндуро',
        'Из Японии и Китая',
        'С аукционов и напрямую',
      ],
    },
    {
      emoji: '🚜',
      title: 'Спецтехника',
      items: [
        'Экскаваторы, погрузчики, краны',
        'Китай, Корея',
        'Прямые поставки с заводов',
      ],
    },
  ]

  return (
    <section id="services" className="bg-white py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-extrabold text-primary sm:text-3xl md:text-4xl">
          Что мы импортируем
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-text-secondary">
          Три направления — одна команда профессионалов
        </p>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {services.map((svc) => (
            <div
              key={svc.title}
              className="group rounded-2xl border border-surface-dark bg-white p-6 transition-all hover:-translate-y-1 hover:shadow-xl md:p-8"
            >
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
                href="#calculator"
                className="mt-6 inline-block rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-light"
              >
                Подробнее
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
