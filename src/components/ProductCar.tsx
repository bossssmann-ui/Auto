/**
 * Template B — B2C Product Detail: Toyota Harrier.
 *
 * Design: Apple-style — clean white, generous whitespace, soft shadows.
 * Trust Blue (#2563EB) accents. Large glossy feel with translated auction sheet CTA.
 * Targets individual car buyers who value savings and transparency.
 */
export default function ProductCar() {
  const highlights = [
    {
      icon: '💰',
      title: 'Экономия от рынка РФ',
      value: '~420 000 ₽',
      description: 'Разница между ценой из Японии «под ключ» и средней ценой на российском рынке',
    },
    {
      icon: '📋',
      title: 'Аукционный лист',
      value: 'Оценка 4.5',
      description: 'Переведённый лист с фото — вы видите каждый дефект до покупки',
    },
    {
      icon: '🛡️',
      title: 'Прозрачный утильсбор',
      value: 'Включён',
      description: 'Утилизационный сбор рассчитан и включён в стоимость — без сюрпризов',
    },
  ]

  const specs = [
    { label: 'Модель', value: 'Toyota Harrier (XU80)' },
    { label: 'Год выпуска', value: '2023' },
    { label: 'Пробег', value: '18 500 км' },
    { label: 'Двигатель', value: '2.0L Dynamic Force, бензин' },
    { label: 'Мощность', value: '171 л.с.' },
    { label: 'Привод', value: 'Полный (E-Four)' },
    { label: 'Коробка', value: 'CVT' },
    { label: 'Цвет', value: 'Precious Black Pearl' },
  ]

  return (
    <section id="product-car" className="bg-white py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header — clean, premium feel */}
        <div className="text-center">
          <span className="inline-block rounded-full bg-hub-b2c-accent/10 px-4 py-1 text-xs font-bold uppercase tracking-widest text-hub-b2c-accent">
            Автомобили — образец карточки
          </span>
          <h2 className="mt-4 text-2xl font-extrabold text-gray-900 sm:text-3xl md:text-4xl">
            Toyota Harrier
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-gray-500">
            Премиальный кроссовер напрямую с аукциона Японии. До 30% дешевле российского рынка.
          </p>
        </div>

        {/* Savings highlights — Apple-style cards */}
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {highlights.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl bg-gray-50 p-6 text-center shadow-sm transition-shadow hover:shadow-md"
            >
              <span className="text-3xl">{item.icon}</span>
              <div className="mt-3 text-2xl font-extrabold text-hub-b2c-accent">
                {item.value}
              </div>
              <h3 className="mt-1 text-sm font-bold text-gray-900">{item.title}</h3>
              <p className="mt-2 text-xs leading-relaxed text-gray-500">
                {item.description}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          {/* Left: image placeholder + auction sheet */}
          <div>
            {/* Glossy image placeholder */}
            <div className="flex aspect-video items-center justify-center rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 shadow-lg">
              <div className="text-center">
                <span className="text-6xl">🚗</span>
                <p className="mt-3 text-sm font-medium text-gray-400">
                  Фото с аукциона USS Tokyo
                </p>
              </div>
            </div>

            {/* Translated Auction Sheet CTA */}
            <div className="mt-6 rounded-2xl border border-hub-b2c-accent/20 bg-hub-b2c-accent/5 p-6 text-center">
              <h4 className="text-base font-bold text-gray-900">
                Аукционный лист с переводом
              </h4>
              <p className="mt-2 text-sm text-gray-500">
                Полный перевод японского аукционного листа на русский язык.
                Все повреждения, замены и ремонтные работы — в одном документе.
              </p>
              <button
                type="button"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-hub-b2c-accent px-6 py-3 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-lg"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Посмотреть аукционный лист
              </button>
            </div>
          </div>

          {/* Right: specs + pricing */}
          <div>
            {/* Specs — clean table with soft styling */}
            <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
              <div className="bg-gray-50 px-6 py-4">
                <h3 className="text-base font-bold text-gray-900">Характеристики</h3>
              </div>
              <table className="w-full">
                <tbody>
                  {specs.map((row, i) => (
                    <tr key={row.label} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-3 text-sm text-gray-500">{row.label}</td>
                      <td className="px-6 py-3 text-sm font-semibold text-gray-900">
                        {row.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Price card — emphasize savings */}
            <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Стоимость «под ключ»</span>
                <span className="text-2xl font-extrabold text-gray-900">3 150 000 ₽</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm text-gray-500">Средняя цена в РФ</span>
                <span className="text-lg font-semibold text-gray-400 line-through">
                  3 570 000 ₽
                </span>
              </div>
              <div className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-center">
                <span className="text-lg font-extrabold text-green-600">
                  Экономия: ~420 000 ₽
                </span>
              </div>

              <div className="mt-4 space-y-2 text-xs text-gray-500">
                <div className="flex justify-between">
                  <span>Пошлина + утильсбор</span>
                  <span>включено</span>
                </div>
                <div className="flex justify-between">
                  <span>СБКТС + ЭПТС + ГЛОНАСС</span>
                  <span>включено</span>
                </div>
                <div className="flex justify-between">
                  <span>Доставка автовозом по РФ</span>
                  <span>по запросу</span>
                </div>
              </div>
            </div>

            {/* CTA */}
            <a
              href="#calculator"
              className="mt-6 block rounded-xl bg-hub-b2c-accent px-8 py-4 text-center text-base font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-xl"
            >
              Рассчитать мой автомобиль
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
