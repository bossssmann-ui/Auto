import LazyYouTube from './LazyYouTube'

/**
 * Template A — B2B Product Detail: Komatsu PC30-7 Mini Excavator.
 *
 * Design: Industrial B2B palette (dark graphite + signal yellow).
 * Data-heavy layout with specs table, НДС pricing, and YouTube inspection video.
 * Targets construction business owners who value documentation and transparency.
 */
export default function ProductExcavator() {
  const specs = [
    { label: 'Модель', value: 'Komatsu PC30-7' },
    { label: 'Год выпуска', value: '2019' },
    { label: 'Моточасы', value: '3 250 м/ч (подтверждено)' },
    { label: 'Масса', value: '3 200 кг' },
    { label: 'Двигатель', value: 'Komatsu 3D84E, дизель' },
    { label: 'Мощность', value: '24.4 л.с. / 18 кВт' },
    { label: 'Глубина копания', value: '2 870 мм' },
    { label: 'Ширина ковша', value: '450 мм' },
    { label: 'Ходовая', value: 'Резиновые гусеницы' },
  ]

  const documents = [
    'ПСМ (Паспорт самоходной машины)',
    'ЭПТС (Электронный паспорт ТС)',
    'Агентский договор',
    'Акт технической инспекции',
    'Аукционный лист с переводом',
  ]

  return (
    <section id="product-excavator" className="bg-hub-b2b py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center">
          <span className="inline-block rounded-full bg-hub-b2b-accent/20 px-4 py-1 text-xs font-bold uppercase tracking-widest text-hub-b2b-accent">
            Спецтехника — образец карточки
          </span>
          <h2 className="mt-4 text-2xl font-extrabold text-white sm:text-3xl md:text-4xl">
            Komatsu PC30-7
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-gray-400">
            Мини-экскаватор из Японии. Инспекция, растаможка и доставка &mdash; всё включено.
          </p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          {/* Left: Video + image placeholder */}
          <div>
            <div className="overflow-hidden rounded-2xl border border-gray-700">
              <LazyYouTube
                videoId={import.meta.env.VITE_INSPECTION_VIDEO_ID || 'dQw4w9WgXcQ'}
                title="Техническая инспекция Komatsu PC30-7 — проверка гидравлики, моточасов"
              />
            </div>
            <p className="mt-3 text-center text-xs text-gray-500">
              Видеоотчёт инспекции в Японии — гидравлика, моточасы, ходовая часть
            </p>

            {/* Documents list */}
            <div className="mt-8 rounded-2xl border border-gray-700 bg-hub-b2b-light p-6">
              <h4 className="text-sm font-bold uppercase tracking-wider text-hub-b2b-accent">
                Документы в комплекте
              </h4>
              <ul className="mt-4 space-y-2">
                {documents.map((doc) => (
                  <li key={doc} className="flex items-center gap-2 text-sm text-gray-300">
                    <span className="text-hub-b2b-accent">✓</span>
                    {doc}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right: Specs table + pricing */}
          <div>
            {/* Specs table — data-heavy B2B layout */}
            <div className="overflow-hidden rounded-2xl border border-gray-700">
              <div className="bg-hub-b2b-light px-6 py-4">
                <h3 className="text-lg font-bold text-white">Технические характеристики</h3>
              </div>
              <table className="w-full">
                <tbody>
                  {specs.map((row, i) => (
                    <tr
                      key={row.label}
                      className={i % 2 === 0 ? 'bg-hub-b2b' : 'bg-hub-b2b-light/50'}
                    >
                      <td className="px-6 py-3 text-sm font-medium text-gray-400">
                        {row.label}
                      </td>
                      <td className="px-6 py-3 text-sm font-semibold text-white">
                        {row.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Price block — heavy focus on НДС and утильсбор */}
            <div className="mt-6 rounded-2xl border-2 border-hub-b2b-accent bg-hub-b2b-light p-6">
              <h4 className="text-sm font-bold uppercase tracking-wider text-hub-b2b-accent">
                Стоимость «под ключ»
              </h4>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-sm text-gray-300">
                  <span>Аукционная цена (FOB Япония)</span>
                  <span className="font-semibold text-white">¥1 250 000</span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-300">
                  <span>Фрахт и порт</span>
                  <span className="font-semibold text-white">95 000 ₽</span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-300">
                  <span>Таможенная пошлина (5%)</span>
                  <span className="font-semibold text-white">38 750 ₽</span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-300">
                  <span>Утилизационный сбор</span>
                  <span className="font-semibold text-white">862 500 ₽</span>
                </div>
                <div className="flex items-center justify-between text-sm text-gray-300">
                  <span>ПСМ + ГЛОНАСС + брокер</span>
                  <span className="font-semibold text-white">59 500 ₽</span>
                </div>

                <div className="border-t border-gray-600 pt-3">
                  <div className="flex items-center justify-between text-sm text-gray-300">
                    <span className="font-bold text-hub-b2b-accent">НДС 22%</span>
                    <span className="font-bold text-hub-b2b-accent">254 705 ₽</span>
                  </div>
                </div>

                <div className="border-t border-gray-600 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-extrabold text-white">
                      Итого с НДС и утильсбором
                    </span>
                    <span className="text-xl font-extrabold text-hub-b2b-accent">
                      2 085 455 ₽
                    </span>
                  </div>
                </div>
              </div>

              <p className="mt-4 text-xs text-gray-500">
                * Цена ориентировочная. Точный расчёт — по запросу. Доставка тралом
                ТЛК «Тихоокеанская Звезда» по РФ рассчитывается отдельно.
              </p>
            </div>

            {/* CTA */}
            <a
              href="#calculator"
              className="mt-6 block rounded-xl bg-hub-b2b-accent px-8 py-4 text-center text-base font-bold text-hub-b2b shadow-lg transition-all hover:-translate-y-0.5 hover:bg-yellow-300 hover:shadow-xl"
            >
              Получить точный расчёт с доставкой
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
