export default function Hero() {
  const stats = [
    { value: '2500+', label: 'единиц техники доставлено' },
    { value: '8 лет', label: 'на рынке импорта' },
    { value: '0', label: 'скрытых платежей' },
    { value: 'от 25', label: 'дней — полный цикл' },
  ]

  return (
    <section
      id="hero"
      className="relative overflow-hidden bg-gradient-to-br from-primary-dark via-primary to-primary-light"
    >
      {/* Decorative elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-gold" />
        <div className="absolute -bottom-32 -left-32 h-[500px] w-[500px] rounded-full bg-accent" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28 lg:px-8 lg:py-36">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl md:text-5xl lg:text-6xl">
            Инженерный подбор и доставка авто, мото- и спецтехники{' '}
            <span className="text-gold-light">из Японии, Кореи и Китая под ключ.</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-blue-100 md:text-xl">
            Собственная ТЛК. Работаем с НДС 22%. Жесткая фильтрация аукционных листов.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="#calculator"
              className="w-full rounded-xl bg-accent px-8 py-4 text-lg font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-accent-light hover:shadow-xl sm:w-auto"
            >
              Рассчитать стоимость «под ключ»
            </a>
            <a
              href="#heavy-machinery"
              className="w-full rounded-xl border-2 border-white/30 px-8 py-4 text-lg font-bold text-white transition-all hover:border-white hover:bg-white/10 sm:w-auto"
            >
              Спецтехника и тяжёлая техника
            </a>
          </div>
        </div>

        {/* Stats bar */}
        <div className="mt-16 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-8">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl bg-white/10 px-4 py-5 text-center backdrop-blur-sm"
            >
              <div className="text-2xl font-extrabold text-gold-light md:text-3xl">
                {stat.value}
              </div>
              <div className="mt-1 text-sm text-blue-200">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
