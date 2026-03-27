export default function Trust() {
  const stats = [
    { value: '2500+', label: 'единиц техники доставлено' },
    { value: '8 лет', label: 'на рынке импорта' },
    { value: '350+', label: 'корпоративных клиентов' },
  ]

  const advantages = [
    {
      icon: '🔍',
      title: 'Физическая инспекция в Японии',
      description:
        'Наши эксперты находятся непосредственно на площадках и аукционах в Японии. Каждая единица техники проходит детальный осмотр перед покупкой — гидравлика, моточасы, кузов, ходовая.',
    },
    {
      icon: '🚛',
      title: 'Собственный автопарк для доставки по России',
      description:
        'Собственная ТЛК с тралами и автовозами для внутрироссийской доставки. Не зависим от сторонних перевозчиков — контролируем сроки и сохранность техники до вашего города.',
    },
    {
      icon: '💰',
      title: 'Фиксация курса валюты в день оплаты',
      description:
        'Курс валюты фиксируется в момент вашего платежа и закрепляется в договоре. Никаких доплат при колебаниях курса — вы платите ровно столько, сколько указано в смете.',
    },
  ]

  const testimonials = [
    {
      name: 'Дмитрий Волков',
      city: 'ООО «СтройРесурс», Краснодар',
      text: 'Закупили партию из 3 экскаваторов Komatsu через Тихоокеанскую Звезду. Полный цикл — от проверки моточасов до оформления ПСМ. Итоговая стоимость совпала с расчётом в договоре. Экономия по сравнению с российским рынком — 35%.',
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
          Почему выбирают нас
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-text-secondary">
          Собственная транспортно-логистическая компания, работа с НДС 22%, легальная растаможка с ПСМ/ЭПТС
        </p>

        {/* Key advantages */}
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {advantages.map((adv) => (
            <div
              key={adv.title}
              className="rounded-2xl border border-surface-dark bg-surface p-6 transition-shadow hover:shadow-lg md:p-8"
            >
              <span className="text-4xl">{adv.icon}</span>
              <h3 className="mt-4 text-lg font-bold text-text-primary">
                {adv.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                {adv.description}
              </p>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-3 gap-4 md:gap-8">
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
