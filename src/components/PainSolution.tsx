export default function PainSolution() {
  const items = [
    {
      icon: '🔴',
      pain: 'Боюсь нарваться на мошенников',
      solution:
        'Работаем по договору с полной юридической защитой. Реквизиты компании открыты. Каждый этап — отчёт с фото и видео.',
    },
    {
      icon: '🔴',
      pain: 'Скрытые расходы и непонятная растаможка',
      solution:
        'Фиксированная стоимость «под ключ» в договоре. Никаких доплат. Включено: аукцион + доставка + таможня + СБКТС + ЭПТС.',
    },
    {
      icon: '🔴',
      pain: 'Авто придёт сломанным',
      solution:
        'Проверка каждого лота перед покупкой. Аукционный лист переведён. Гарантия возврата при несоответствии.',
    },
  ]

  return (
    <section id="pain" className="bg-surface py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-extrabold text-primary sm:text-3xl md:text-4xl">
          Почему покупка авто из-за рубежа пугает?
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-text-secondary">
          Мы знаем все страхи и решили каждый из них
        </p>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.pain}
              className="rounded-2xl bg-white p-6 shadow-md transition-shadow hover:shadow-lg md:p-8"
            >
              <div className="text-3xl">{item.icon}</div>
              <h3 className="mt-4 text-lg font-bold text-text-primary">
                «{item.pain}»
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
