import { useState } from 'react'
import { submitLead } from '../api'

export default function LeadMagnet() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim() && phone.trim()) {
      setSubmitError(false)
      try {
        const res = await submitLead({ name, phone, source: 'lead-magnet' })
        if (res.success) {
          setSubmitted(true)
        } else {
          setSubmitError(true)
        }
      } catch {
        setSubmitError(true)
      }
    }
  }

  return (
    <section id="lead" className="bg-primary py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-block rounded-full bg-gold/20 px-4 py-1 text-sm font-semibold text-gold-light">
            Бесплатно для бизнеса
          </span>
          <h2 className="mt-4 text-2xl font-extrabold text-white sm:text-3xl md:text-4xl">
            Получите каталог спецтехники с ценами «под ключ»
          </h2>
          <p className="mt-4 text-lg text-blue-200">
            Актуальные лоты экскаваторов, погрузчиков и тракторов с аукционов Японии, Кореи и Китая.
            С расчётом полной стоимости включая ПСМ, утильсбор и НДС 22%.
          </p>

          {!submitted ? (
            <form onSubmit={handleSubmit} className="mt-10 space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ваше имя"
                  required
                  className="flex-1 rounded-xl border-0 bg-white/10 px-5 py-4 text-white placeholder:text-blue-300 focus:ring-2 focus:ring-gold focus:outline-none"
                />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+7 (___) ___-__-__"
                  required
                  className="flex-1 rounded-xl border-0 bg-white/10 px-5 py-4 text-white placeholder:text-blue-300 focus:ring-2 focus:ring-gold focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-gold px-8 py-4 text-lg font-bold text-primary-dark shadow-lg transition-all hover:-translate-y-0.5 hover:bg-gold-light hover:shadow-xl sm:w-auto"
              >
                Получить каталог техники
              </button>
              <p className="text-xs text-blue-300">
                Нажимая кнопку, вы соглашаетесь с политикой обработки
                персональных данных
              </p>
              {submitError && (
                <p className="text-sm font-medium text-red-300">
                  Не удалось отправить заявку. Попробуйте ещё раз.
                </p>
              )}
            </form>
          ) : (
            <div className="mt-10 rounded-xl bg-white/10 p-8">
              <span className="text-4xl">✅</span>
              <p className="mt-4 text-xl font-bold text-white">
                Спасибо! Каталог отправлен. Менеджер свяжется для уточнения деталей.
              </p>
              <p className="mt-2 text-blue-200">
                Наш менеджер свяжется с вами в ближайшее время.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
