import LazyYouTube from './LazyYouTube'

export default function HeavyMachinery() {
  const inspectionPoints = [
    {
      icon: '🔧',
      title: 'Гидравлическая система',
      description:
        'Проверка давления в контурах, состояния цилиндров, шлангов и распределителей. Тест на утечки под рабочей нагрузкой.',
    },
    {
      icon: '⏱️',
      title: 'Моточасы и двигатель',
      description:
        'Верификация реальных моточасов по бортовому компьютеру и сервисной истории. Анализ компрессии, расхода масла и состояния турбины.',
    },
    {
      icon: '🏗️',
      title: 'Несущая конструкция',
      description:
        'Осмотр рамы, стрелы, ковша и поворотной платформы на трещины, деформации и следы сварочного ремонта. Проверка пальцев и втулок.',
    },
    {
      icon: '⚙️',
      title: 'Ходовая часть',
      description:
        'Оценка износа гусениц/шин, катков, звёздочек и натяжителей. Проверка редукторов хода и тормозной системы.',
    },
  ]

  const machineryTypes = [
    {
      name: 'Экскаваторы',
      examples: 'Komatsu PC200, Hitachi ZX200, CAT 320, Volvo EC210',
      weight: 'от 5 до 45 тонн',
    },
    {
      name: 'Фронтальные погрузчики',
      examples: 'Komatsu WA320, CAT 950, Hyundai HL760, SDLG LG956',
      weight: 'от 3 до 25 тонн',
    },
    {
      name: 'Бульдозеры',
      examples: 'Komatsu D65, CAT D6, Shantui SD22',
      weight: 'от 10 до 40 тонн',
    },
    {
      name: 'Мини-экскаваторы',
      examples: 'Kubota U-30, Yanmar ViO50, Bobcat E50',
      weight: 'от 1 до 8 тонн',
    },
  ]

  return (
    <section id="heavy-machinery" className="bg-white py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <span className="inline-block rounded-full bg-accent/10 px-4 py-1 text-sm font-bold uppercase tracking-wider text-accent">
            Основное направление
          </span>
          <h2 className="mt-4 text-2xl font-extrabold text-primary sm:text-3xl md:text-4xl">
            Тяжёлая и специальная техника
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-text-secondary">
            Импорт экскаваторов, погрузчиков, бульдозеров и тракторов из Японии, Кореи и Китая.
            Каждая единица проходит техническую инспекцию до покупки на аукционе.
            Полное таможенное оформление с получением ПСМ, оплатой утильсбора и НДС 22%.
          </p>
        </div>

        {/* Technical inspection block */}
        <div className="mt-16">
          <h3 className="text-center text-xl font-bold text-text-primary md:text-2xl">
            Техническая инспекция до покупки
          </h3>
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-text-secondary">
            Каждый лот проверяется нашим инженером или аккредитованным инспектором на месте
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {inspectionPoints.map((point) => (
              <div
                key={point.title}
                className="rounded-2xl border border-surface-dark bg-surface p-6 transition-shadow hover:shadow-md"
              >
                <div className="text-3xl">{point.icon}</div>
                <h4 className="mt-3 text-base font-bold text-text-primary">
                  {point.title}
                </h4>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                  {point.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Machinery types */}
        <div className="mt-16">
          <h3 className="text-center text-xl font-bold text-text-primary md:text-2xl">
            Типы техники, которую мы импортируем
          </h3>

          <div className="mt-8 overflow-hidden rounded-2xl border border-surface-dark">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-primary text-sm text-white">
                  <th className="px-4 py-3 font-semibold sm:px-6">Тип техники</th>
                  <th className="hidden px-4 py-3 font-semibold sm:table-cell sm:px-6">Популярные модели</th>
                  <th className="px-4 py-3 font-semibold sm:px-6">Масса</th>
                </tr>
              </thead>
              <tbody>
                {machineryTypes.map((type, i) => (
                  <tr
                    key={type.name}
                    className={i % 2 === 0 ? 'bg-white' : 'bg-surface'}
                  >
                    <td className="px-4 py-3 font-medium text-text-primary sm:px-6">
                      {type.name}
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-text-secondary sm:table-cell sm:px-6">
                      {type.examples}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary sm:px-6">
                      {type.weight}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Customs clearance details */}
        <div className="mt-16 rounded-2xl bg-primary/5 p-6 md:p-10">
          <h3 className="text-center text-xl font-bold text-text-primary md:text-2xl">
            Таможенное оформление спецтехники
          </h3>
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-text-secondary">
            Полный цикл оформления — от декларации до получения ПСМ
          </p>

          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <div className="text-2xl font-extrabold text-accent">ПСМ</div>
              <p className="mt-2 text-sm text-text-secondary">
                Паспорт самоходной машины — обязательный документ для регистрации
                спецтехники в Гостехнадзоре. Оформляем в составе услуги.
              </p>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm">
              <div className="text-2xl font-extrabold text-accent">Утильсбор</div>
              <p className="mt-2 text-sm text-text-secondary">
                Утилизационный сбор на самоходные машины. Размер зависит от типа,
                мощности и возраста техники. Рассчитываем и оплачиваем за вас.
              </p>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm sm:col-span-2 lg:col-span-1">
              <div className="text-2xl font-extrabold text-accent">НДС 22%</div>
              <p className="mt-2 text-sm text-text-secondary">
                Налог на добавленную стоимость при ввозе коммерческой техники.
                Включён в расчёт «под ключ». Для юрлиц — возможность возврата НДС.
              </p>
            </div>
          </div>
        </div>

        {/* Technical Inspection Video */}
        <div className="mt-16">
          <h3 className="text-center text-xl font-bold text-text-primary md:text-2xl">
            Видеообзор технической инспекции
          </h3>
          <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-text-secondary">
            Посмотрите, как наши инженеры проверяют технику перед покупкой на аукционе
          </p>

          <div className="mx-auto mt-8 max-w-3xl">
            <LazyYouTube
              videoId={import.meta.env.VITE_INSPECTION_VIDEO_ID || 'dQw4w9WgXcQ'}
              title="Техническая инспекция экскаватора перед покупкой — проверка гидравлики, моточасов и конструкции"
            />
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <a
            href="#calculator"
            className="inline-block rounded-xl bg-accent px-10 py-4 text-lg font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-accent-light hover:shadow-xl"
          >
            Рассчитать стоимость техники «под ключ»
          </a>
        </div>
      </div>
    </section>
  )
}
