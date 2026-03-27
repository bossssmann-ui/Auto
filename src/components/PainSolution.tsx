export default function PainSolution() {
  const items = [
    {
      icon: '⚠️',
      pain: 'Простой техники из-за срыва сроков поставки',
      solution:
        'Фиксированные сроки в договоре. Прогнозируемая логистика с отслеживанием на каждом этапе. Среднее время поставки — 25 дней от покупки до площадки.',
    },
    {
      icon: '⚠️',
      pain: 'Непрозрачная растаможка и непредвиденные расходы',
      solution:
        'Стоимость «под ключ» зафиксирована в договоре. Включено: аукцион + логистика + таможня + ПСМ + утильсбор + НДС 20% + СБКТС + ЭПТС. Никаких доплат.',
    },
    {
      icon: '⚠️',
      pain: 'Техника не соответствует заявленному состоянию',
      solution:
        'Техническая инспекция до покупки: проверка гидравлики, моточасов, целостности конструкции. Аукционный лист переведён. Гарантия возврата при несоответствии.',
    },
  ]

  return (
    <section id="pain" className="bg-surface py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-extrabold text-primary sm:text-3xl md:text-4xl">
          Ключевые риски импорта техники — и как мы их устраняем
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-text-secondary">
          Каждый риск закрыт договором, регламентом и проверенной логистикой
        </p>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.pain}
              className="rounded-2xl bg-white p-6 shadow-md transition-shadow hover:shadow-lg md:p-8"
            >
              <div className="text-3xl">{item.icon}</div>
              <h3 className="mt-4 text-lg font-bold text-text-primary">
                {item.pain}
              </h3>
              <div className="my-4 h-px bg-surface-dark" />
              <div className="flex items-start gap-2">
                <span className="mt-0.5 text-lg text-green-500">✅</span>
                <p className="text-text-secondary">{item.solution}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
