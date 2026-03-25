export default function DeliveryMap() {
  const steps = [
    {
      num: 1,
      title: 'Покупка на аукционе',
      location: 'Япония / Корея / Китай',
      time: '1-3 дня',
    },
    {
      num: 2,
      title: 'Доставка в порт отправки',
      location: 'Порт страны-экспортёра',
      time: '3-5 дней',
    },
    {
      num: 3,
      title: 'Морская перевозка',
      location: 'До Владивостока',
      time: '7-14 дней',
    },
    {
      num: 4,
      title: 'Таможенное оформление',
      location: 'Владивосток',
      time: '3-5 дней',
    },
    {
      num: 5,
      title: 'Доставка до вашего города',
      location: 'По всей России',
      time: '5-10 дней',
    },
  ]

  return (
    <section id="delivery" className="bg-surface py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-extrabold text-primary sm:text-3xl md:text-4xl">
          Как ваш автомобиль едет к вам
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-text-secondary">
          Полный цикл от покупки до доставки — от 25 дней
        </p>

        {/* Desktop timeline */}
        <div className="mt-16 hidden md:block">
          <div className="relative flex items-start justify-between">
            {/* Connecting line */}
            <div className="absolute top-6 right-8 left-8 h-0.5 bg-primary/20" />

            {steps.map((step) => (
              <div key={step.num} className="relative z-10 flex w-1/5 flex-col items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-white shadow-lg">
                  {step.num}
                </div>
                <h3 className="mt-4 text-sm font-bold text-text-primary">
                  {step.title}
                </h3>
                <p className="mt-1 text-xs text-text-secondary">
                  {step.location}
                </p>
                <span className="mt-2 inline-block rounded-full bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">
                  {step.time}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile vertical timeline */}
        <div className="mt-12 md:hidden">
          <div className="relative space-y-8 pl-10">
            {/* Vertical line */}
            <div className="absolute top-0 bottom-0 left-[18px] w-0.5 bg-primary/20" />

            {steps.map((step) => (
              <div key={step.num} className="relative">
                <div className="absolute -left-10 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-white shadow">
                  {step.num}
                </div>
                <div className="rounded-xl bg-white p-4 shadow-sm">
                  <h3 className="font-bold text-text-primary">{step.title}</h3>
                  <p className="mt-1 text-sm text-text-secondary">
                    {step.location}
                  </p>
                  <span className="mt-2 inline-block rounded-full bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">
                    {step.time}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
