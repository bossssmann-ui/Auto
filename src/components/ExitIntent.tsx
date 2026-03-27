import { useState, useEffect } from 'react'
import { submitLead } from '../api'

export default function ExitIntent() {
  const [show, setShow] = useState(false)
  const [phone, setPhone] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    const alreadyShown = localStorage.getItem('exitIntentShown')
    if (alreadyShown) return

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) {
        setShow(true)
        localStorage.setItem('exitIntentShown', 'true')
      }
    }

    document.addEventListener('mouseleave', handleMouseLeave)
    return () => document.removeEventListener('mouseleave', handleMouseLeave)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (phone.trim()) {
      try {
        await submitLead({ name: 'Не указано', phone, source: 'exit-intent' })
      } catch {
        // Silently continue
      }
      setSubmitted(true)
    }
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        {/* Close button */}
        <button
          onClick={() => setShow(false)}
          className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
          aria-label="Закрыть"
        >
          ✕
        </button>

        {!submitted ? (
          <>
            <div className="text-center">
              <span className="text-4xl">📋</span>
              <h2 className="mt-4 text-xl font-extrabold text-primary sm:text-2xl">
                Получите расчёт стоимости техники за 30 минут
              </h2>
              <p className="mt-3 text-text-secondary">
                Оставьте контакт — менеджер подготовит персональный расчёт
                с учётом ПСМ, утильсбора и НДС 22% для вашей единицы техники
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7 (___) ___-__-__"
                required
                className="w-full rounded-xl border border-surface-dark px-5 py-4 text-text-primary placeholder:text-text-secondary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-accent px-8 py-4 text-lg font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-accent-light hover:shadow-lg"
              >
                Получить расчёт
              </button>
              <p className="text-center text-xs text-text-secondary">
                Нажимая кнопку, вы соглашаетесь с политикой обработки
                персональных данных
              </p>
            </form>
          </>
        ) : (
          <div className="py-4 text-center">
            <span className="text-4xl">✅</span>
            <p className="mt-4 text-xl font-bold text-primary">
              Спасибо! Мы свяжемся с вами в ближайшее время.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
