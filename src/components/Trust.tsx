export default function Trust() {
  const stats = [
    { value: '2500+', label: 'единиц техники доставлено' },
    { value: '8 лет', label: 'на рынке импорта' },
    { value: '350+', label: 'корпоративных клиентов' },
  ]

  const testimonials = [
    {
      name: 'Дмитрий Волков',
      city: 'ООО «СтройРесурс», Краснодар',
      text: 'Закупили партию из 3 экскаваторов Komatsu через Спецтехмаш. Полный цикл — от проверки моточасов до оформления ПСМ. Итоговая стоимость совпала с расчётом в договоре. Экономия по сравнению с российским рынком — 35%.',
    },
    {
      name: 'Алексей Петров',
      city: 'ИП Петров А.С., Москва',
      text: 'Заказывал Toyota Land Cruiser Prado из Японии для автопарка компании. Фиксированная цена, прозрачная растаможка, ЭПТС получен в срок. Сэкономили более 800 тысяч на единицу.',
    },
    {
      name: 'Сергей Козлов',
      city: 'ООО «АгроТехПром», Ростов-на-Дону',
      text: 'Импортировали фронтальный погрузчик из Китая. До покупки провели инспекцию гидравлики и ходовой. Таможенное оформление с утильсбором и НДС — без сюрпризов. Техника уже работает на объекте.',
    },
  ]

  const auctions = ['USS', 'TAA', 'CAA', 'IAA', 'Copart']

  return (
    <section id="trust" className="bg-white py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-extrabold text-primary sm:text-3xl md:text-4xl">
          Нам доверяют
        </h2>

        {/* Stats */}
        <div className="mt-12 grid grid-cols-3 gap-4 md:gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-extrabold text-accent md:text-5xl">
                {stat.value}
              </div>
              <div className="mt-2 text-sm text-text-secondary md:text-base">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="rounded-2xl bg-surface p-6 md:p-8"
            >
              <div className="flex items-center gap-1 text-gold">
                {Array(5)
                  .fill(0)
                  .map((_, i) => (
                    <span key={i}>★</span>
                  ))}
              </div>
              <p className="mt-4 text-text-secondary">«{t.text}»</p>
              <div className="mt-4 border-t border-surface-dark pt-4">
                <p className="font-semibold text-text-primary">{t.name}</p>
                <p className="text-sm text-text-secondary">{t.city}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Auction partners */}
        <div className="mt-16 rounded-2xl bg-primary/5 p-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
            Работаем с аукционами
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-6 md:gap-10">
            {auctions.map((name) => (
              <span
                key={name}
                className="text-xl font-extrabold text-primary md:text-2xl"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
