export default function LogisticsProof() {
  const advantages = [
    {
      icon: '🚛',
      title: 'Собственный автопарк тралов',
      text: 'Доставка по всей России без субподрядчиков. Полный контроль сроков и сохранности груза.',
    },
    {
      icon: '📡',
      title: 'GPS-отслеживание',
      text: 'Каждый трал оснащён GPS-трекером. Вы видите, где находится ваша техника в режиме реального времени.',
    },
    {
      icon: '📋',
      title: 'Страхование груза',
      text: 'Каждая единица техники застрахована на полную стоимость на всём пути от порта до вашей площадки.',
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
          Звезда&raquo; (Pacific&nbsp;Star). Это исключает посредников, снижает
          стоимость и обеспечивает полный контроль на каждом этапе.
        </p>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
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

        <div className="mx-auto mt-12 max-w-2xl rounded-2xl bg-primary/5 p-6 text-center">
          <p className="text-sm leading-relaxed text-text-primary">
            Вся техника, приобретённая через СпецТехМаш, доставляется
            исключительно силами нашей ТЛК &laquo;Тихоокеанская Звезда&raquo;.
            Единый договор, единая ответственность, прозрачные сроки.
          </p>
        </div>
      </div>
    </section>
  )
}
