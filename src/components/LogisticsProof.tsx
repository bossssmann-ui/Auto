/**
 * Logistics Trust Section — "Логистика без посредников".
 *
 * Psychological reasoning:
 * — Addresses the #1 fear of high-value cargo buyers: handing expensive equipment
 *   to unreliable third-party drivers. Emphasizes own fleet and full control.
 * — "Тихоокеанская Звезда" branding reinforces the unfair advantage of in-house logistics.
 */
export default function LogisticsProof() {
  const advantages = [
    {
      icon: '🚛',
      title: 'Собственный автопарк тралов и автовозов',
      text: 'Ни одна единица техники не передаётся случайным перевозчикам. Доставка по всей России — только силами нашей ТЛК «Тихоокеанская Звезда». Полный контроль сроков и сохранности груза.',
    },
    {
      icon: '📡',
      title: 'GPS-отслеживание в реальном времени',
      text: 'Каждый трал и автовоз оснащён GPS-трекером. Вы видите, где находится ваша техника 24/7. Никаких «потерянных» грузов и неизвестных сроков.',
    },
    {
      icon: '📋',
      title: 'Страхование на полную стоимость',
      text: 'Каждая единица техники застрахована на 100% стоимости на всём пути — от порта до вашей площадки. Единый договор, единая ответственность.',
    },
    {
      icon: '👷',
      title: 'Профессиональные водители',
      text: 'Штатные водители с опытом перевозки тяжёлой и спецтехники. Мы не ищем водителей на Авито и не доверяем дорогостоящий груз случайным людям.',
    },
  ]

  return (
    <section id="logistics-proof" className="bg-white py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-extrabold text-primary sm:text-3xl md:text-4xl">
          Логистика без посредников
        </h2>
        <p className="mx-auto mt-4 max-w-3xl text-center text-text-secondary">
          СпецТехМаш гарантирует безопасность доставки, потому что мы владеем
          собственной транспортно-логистической компанией &laquo;Тихоокеанская
          Звезда&raquo; (Pacific&nbsp;Star). Мы не передаём дорогостоящий груз
          третьим лицам — каждый этап под нашим контролем.
        </p>

        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {advantages.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-surface-dark bg-surface p-6 text-center transition-shadow hover:shadow-lg"
            >
              <span className="text-4xl">{item.icon}</span>
              <h3 className="mt-4 text-lg font-bold text-text-primary">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                {item.text}
              </p>
            </div>
          ))}
        </div>

        {/* Strong closing statement — addresses the "Avito drivers" fear directly */}
        <div className="mx-auto mt-12 max-w-3xl rounded-2xl bg-primary/5 p-6 md:p-8">
          <p className="text-center text-sm font-semibold leading-relaxed text-text-primary md:text-base">
            Вся техника, приобретённая через СпецТехМаш, доставляется
            исключительно силами нашей ТЛК &laquo;Тихоокеанская Звезда&raquo;.
            Мы не нанимаем случайных водителей с Авито и не доверяем
            перевозку экскаваторов и автомобилей стоимостью в миллионы рублей
            неизвестным субподрядчикам. Единый договор — единая ответственность.
          </p>
        </div>
      </div>
    </section>
  )
}
