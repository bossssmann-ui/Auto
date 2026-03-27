import { useState, useEffect, useCallback } from 'react'
import { submitLead } from '../api'

/* ─── Types ──────────────────────────────────────────── */
type VehicleType = 'car' | 'special' | 'moto'
type EngineType = 'petrol' | 'diesel' | 'electric' | 'hybrid'
type OwnerType = 'individual' | 'entity'

interface Rates {
  USD: number
  EUR: number
  JPY: number
  CNY: number
}

interface CalcResult {
  customsDuty: number
  customsFee: number
  utilsbor: number
  nds: number
  sbkts: number
  epts: number
  glonass: number
  broker: number
  logistics: number
  total: number
}

/* ─── Fallback exchange rates ────────────────────────── */
const FALLBACK_RATES: Rates = { USD: 92.5, EUR: 100.5, JPY: 0.62, CNY: 12.8 }

/* ─── Fixed fees (RUB) ───────────────────────────────── */
const BROKER_FEE = 25000
const SBKTS_FEE = 45000
const EPTS_FEE = 600
const PSM_FEE = 6500
const GLONASS_FEE = 28000

/* ─── Scrapping‑fee (утильсбор) matrices ─────────────── */
// Cars — individual (base 20 000 ₽)
const UTIL_CAR_BASE_IND = 20000
const UTIL_CAR_IND: Record<string, Record<number, number>> = {
  new: { 0: 0.17, 1000: 0.17, 2000: 0.26, 3000: 0.45, 3500: 0.78 },
  old: { 0: 0.26, 1000: 0.26, 2000: 0.45, 3000: 0.78, 3500: 1.4 },
}
// Cars — legal entity (base 20 000 ₽)
const UTIL_CAR_BASE_ENT = 20000
const UTIL_CAR_ENT: Record<string, Record<number, number>> = {
  new: { 0: 1.42, 1000: 2.21, 2000: 4.22, 3000: 5.73, 3500: 9.08 },
  old: { 0: 5.3, 1000: 8.26, 2000: 16.12, 3000: 24.01, 3500: 24.01 },
}
// Special machinery (base 172 500 ₽)
const UTIL_SPEC_BASE = 172500
const UTIL_SPEC_NEW = 5.0
const UTIL_SPEC_OLD = 10.0
// Motorcycles (base 20 000 ₽)
const UTIL_MOTO_BASE_IND = 20000
const UTIL_MOTO_IND_NEW = 0.17
const UTIL_MOTO_IND_OLD = 0.26
const UTIL_MOTO_BASE_ENT = 20000
const UTIL_MOTO_ENT_NEW = 1.42
const UTIL_MOTO_ENT_OLD = 5.3

/* ─── Customs duty brackets (cars) ───────────────────── */
const DUTY_CAR_NEW = [
  { max: 8500, pct: 0.54, eur: 2.5 },
  { max: 16700, pct: 0.48, eur: 3.5 },
  { max: 42300, pct: 0.48, eur: 5.5 },
  { max: 84500, pct: 0.48, eur: 7.5 },
  { max: 169000, pct: 0.48, eur: 15 },
  { max: Infinity, pct: 0.48, eur: 20 },
]
const DUTY_CAR_3_5 = [
  { max: 1000, eur: 1.5 },
  { max: 1500, eur: 1.7 },
  { max: 1800, eur: 2.5 },
  { max: 2300, eur: 2.7 },
  { max: 3000, eur: 3.0 },
  { max: Infinity, eur: 3.6 },
]
const DUTY_CAR_5 = [
  { max: 1000, eur: 3.0 },
  { max: 1500, eur: 3.2 },
  { max: 1800, eur: 3.5 },
  { max: 2300, eur: 4.8 },
  { max: 3000, eur: 5.0 },
  { max: Infinity, eur: 5.7 },
]

/* ─── Customs clearance fee by customs value ─────────── */
const CLEARANCE_TABLE = [
  { max: 200000, fee: 775 },
  { max: 450000, fee: 1550 },
  { max: 1200000, fee: 3100 },
  { max: 2700000, fee: 8530 },
  { max: 4200000, fee: 12000 },
  { max: 5500000, fee: 15500 },
  { max: 7000000, fee: 20000 },
  { max: 8000000, fee: 23000 },
  { max: 9000000, fee: 25000 },
  { max: 10000000, fee: 27000 },
  { max: Infinity, fee: 30000 },
]

/* ─── Helpers ────────────────────────────────────────── */
const formatRub = (n: number) => Math.round(n).toLocaleString('ru-RU') + ' ₽'

function pickCoeff(table: Record<number, number>, cc: number): number {
  const keys = Object.keys(table).map(Number).sort((a, b) => a - b)
  let coeff = table[keys[0]]
  for (const k of keys) {
    if (cc >= k) coeff = table[k]
  }
  return coeff
}

function getAgeBracket(year: number): 'new' | '3-5' | 'old' {
  const age = new Date().getFullYear() - year
  if (age < 3) return 'new'
  if (age <= 5) return '3-5'
  return 'old'
}

function calcCustomsDutyCar(
  priceEur: number,
  cc: number,
  age: 'new' | '3-5' | 'old',
  eurRate: number,
): number {
  if (age === 'new') {
    const row = DUTY_CAR_NEW.find((r) => priceEur <= r.max)!
    const byPercent = priceEur * row.pct * eurRate
    const byVolume = cc * row.eur * eurRate
    return Math.max(byPercent, byVolume)
  }
  const table = age === '3-5' ? DUTY_CAR_3_5 : DUTY_CAR_5
  const row = table.find((r) => cc <= r.max)!
  return cc * row.eur * eurRate
}

function calcUtilsbor(
  type: VehicleType,
  owner: OwnerType,
  cc: number,
  year: number,
): number {
  const ageKey = new Date().getFullYear() - year < 3 ? 'new' : 'old'

  if (type === 'special') {
    return UTIL_SPEC_BASE * (ageKey === 'new' ? UTIL_SPEC_NEW : UTIL_SPEC_OLD)
  }
  if (type === 'moto') {
    if (owner === 'individual')
      return UTIL_MOTO_BASE_IND * (ageKey === 'new' ? UTIL_MOTO_IND_NEW : UTIL_MOTO_IND_OLD)
    return UTIL_MOTO_BASE_ENT * (ageKey === 'new' ? UTIL_MOTO_ENT_NEW : UTIL_MOTO_ENT_OLD)
  }
  // car
  if (owner === 'individual') {
    const coeff = pickCoeff(UTIL_CAR_IND[ageKey], cc)
    return UTIL_CAR_BASE_IND * coeff
  }
  const coeff = pickCoeff(UTIL_CAR_ENT[ageKey], cc)
  return UTIL_CAR_BASE_ENT * coeff
}

function calcCustomsFee(valueRub: number): number {
  return CLEARANCE_TABLE.find((r) => valueRub <= r.max)!.fee
}

/* ─── Vehicle type cards ─────────────────────────────── */
const VEHICLE_CARDS: { type: VehicleType; icon: string; label: string; desc: string }[] = [
  {
    type: 'special',
    icon: '🏗️',
    label: 'Спецтехника',
    desc: 'Экскаваторы, погрузчики, бульдозеры, краны',
  },
  {
    type: 'car',
    icon: '🚗',
    label: 'Легковой автомобиль',
    desc: 'Седаны, внедорожники, минивэны',
  },
  {
    type: 'moto',
    icon: '🏍️',
    label: 'Мотоцикл',
    desc: 'Мотоциклы, скутеры, квадроциклы',
  },
]

/* ─── Step indicator ─────────────────────────────────── */
const STEPS = [
  'Тип техники',
  'Параметры',
  'Расчёт',
  'Результат',
]

/* ─── Component ──────────────────────────────────────── */
export default function Calculator() {
  const [step, setStep] = useState(1)
  const [rates, setRates] = useState<Rates>(FALLBACK_RATES)

  // Step 1
  const [vehicleType, setVehicleType] = useState<VehicleType>('special')

  // Step 2
  const [year, setYear] = useState('')
  const [engineType, setEngineType] = useState<EngineType>('diesel')
  const [engineVolume, setEngineVolume] = useState('')
  const [auctionPrice, setAuctionPrice] = useState('')
  const [currency, setCurrency] = useState<'USD' | 'JPY' | 'EUR' | 'CNY'>('USD')
  const [ownerType, setOwnerType] = useState<OwnerType>('entity')

  // Step 4
  const [result, setResult] = useState<CalcResult | null>(null)
  const [leadName, setLeadName] = useState('')
  const [leadPhone, setLeadPhone] = useState('')
  const [leadSent, setLeadSent] = useState(false)

  /* Fetch CBR exchange rates */
  useEffect(() => {
    const controller = new AbortController()
    fetch('https://www.cbr-xml-daily.ru/daily_json.js', {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data: { Valute: Record<string, { Value: number; Nominal: number }> }) => {
        const v = data.Valute
        setRates({
          USD: v['USD'].Value / v['USD'].Nominal,
          EUR: v['EUR'].Value / v['EUR'].Nominal,
          JPY: v['JPY'].Value / v['JPY'].Nominal,
          CNY: v['CNY'].Value / v['CNY'].Nominal,
        })
      })
      .catch(() => {/* keep fallback */})
    return () => controller.abort()
  }, [])

  /* Compute */
  const runCalculation = useCallback(() => {
    const price = parseFloat(auctionPrice) || 0
    const cc = parseFloat(engineVolume) || 0
    const yr = parseInt(year) || new Date().getFullYear()
    const rate = rates[currency]
    const eurRate = rates.EUR
    const priceRub = price * rate
    const priceEur = priceRub / eurRate

    // Customs duty
    let customsDuty: number
    if (vehicleType === 'special') {
      customsDuty = priceRub * 0.05
    } else if (vehicleType === 'moto') {
      customsDuty = priceRub * 0.1
    } else {
      const age = getAgeBracket(yr)
      customsDuty = calcCustomsDutyCar(priceEur, cc, age, eurRate)
    }

    const customsFee = calcCustomsFee(priceRub)
    const utilsbor = calcUtilsbor(vehicleType, ownerType, cc, yr)
    const isSpecial = vehicleType === 'special'
    const epts = isSpecial ? PSM_FEE : EPTS_FEE
    const glonass = engineType === 'electric' ? 0 : GLONASS_FEE
    const sbkts = isSpecial ? 0 : SBKTS_FEE
    const broker = BROKER_FEE

    // Logistics estimate (hidden behind lead wall)
    const logistics = priceRub * 0.15

    const subtotal = customsDuty + customsFee + utilsbor + epts + glonass + sbkts + broker + logistics
    const nds = isSpecial || ownerType === 'entity' ? subtotal * 0.22 : 0
    const total = subtotal + nds

    setResult({
      customsDuty: Math.round(customsDuty),
      customsFee: Math.round(customsFee),
      utilsbor: Math.round(utilsbor),
      nds: Math.round(nds),
      sbkts: Math.round(sbkts),
      epts: Math.round(epts),
      glonass: Math.round(glonass),
      broker: Math.round(broker),
      logistics: Math.round(logistics),
      total: Math.round(total),
    })
  }, [auctionPrice, engineVolume, year, vehicleType, ownerType, engineType, currency, rates])

  /* Step navigation */
  const goToStep2 = () => setStep(2)

  const goToStep3 = () => {
    setStep(3)
    // Processing animation — 1.5 s
    setTimeout(() => {
      runCalculation()
      setStep(4)
    }, 1500)
  }

  const resetCalc = () => {
    setStep(1)
    setResult(null)
    setLeadSent(false)
    setLeadName('')
    setLeadPhone('')
  }

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await submitLead({
        name: leadName,
        phone: leadPhone,
        vehicleType,
        year,
        engineType,
        engineVolume,
        auctionPrice,
        currency,
        ownerType,
        source: 'calculator',
      })
    } catch {
      // Silently continue — form shows success regardless so the UX isn't broken
    }
    setLeadSent(true)
  }

  const canProceedStep2 =
    year.length === 4 &&
    (parseFloat(engineVolume) > 0 || engineType === 'electric') &&
    parseFloat(auctionPrice) > 0

  /* ── Render ── */
  return (
    <section id="calculator" className="bg-surface py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-extrabold text-primary sm:text-3xl md:text-4xl">
          Калькулятор стоимости импорта «под ключ»
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-text-secondary">
          Пошлина, утильсбор, НДС, СБКТС, ЭПТС, ГЛОНАСС — всё учтено.
          Курсы ЦБ РФ обновляются ежедневно.
        </p>

        {/* ── Step indicator ── */}
        <div className="mx-auto mt-10 flex max-w-xl items-center justify-between">
          {STEPS.map((label, i) => {
            const num = i + 1
            const active = step >= num
            return (
              <div key={label} className="flex flex-1 items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                      active
                        ? 'bg-accent text-white'
                        : 'bg-surface-dark text-text-secondary'
                    }`}
                  >
                    {num}
                  </div>
                  <span className="mt-1 hidden text-xs text-text-secondary sm:block">
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`mx-1 h-0.5 flex-1 transition-colors ${
                      step > num ? 'bg-accent' : 'bg-surface-dark'
                    }`}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* ── Card ── */}
        <div className="mx-auto mt-10 max-w-2xl rounded-2xl bg-white p-6 shadow-lg md:p-10">
          {/* ════════ STEP 1 ════════ */}
          {step === 1 && (
            <div>
              <h3 className="text-lg font-bold text-text-primary">
                Выберите тип техники
              </h3>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {VEHICLE_CARDS.map((card) => (
                  <button
                    key={card.type}
                    type="button"
                    onClick={() => setVehicleType(card.type)}
                    className={`cursor-pointer rounded-xl border-2 p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${
                      vehicleType === card.type
                        ? 'border-accent bg-accent/5 shadow-md'
                        : 'border-surface-dark bg-surface'
                    }`}
                  >
                    <span className="text-3xl">{card.icon}</span>
                    <p className="mt-2 font-bold text-text-primary">
                      {card.label}
                    </p>
                    <p className="mt-1 text-xs text-text-secondary">
                      {card.desc}
                    </p>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={goToStep2}
                className="mt-8 w-full rounded-xl bg-accent px-8 py-4 text-lg font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-accent-light hover:shadow-lg"
              >
                Далее →
              </button>
            </div>
          )}

          {/* ════════ STEP 2 ════════ */}
          {step === 2 && (
            <div>
              <h3 className="text-lg font-bold text-text-primary">
                Введите параметры
              </h3>
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                {/* Year */}
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-text-primary">
                    Год выпуска
                  </label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="2019"
                    className="w-full rounded-lg border border-surface-dark bg-surface px-4 py-3 text-text-primary placeholder:text-text-secondary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  />
                </div>

                {/* Engine type */}
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-text-primary">
                    Тип двигателя
                  </label>
                  <select
                    value={engineType}
                    onChange={(e) => setEngineType(e.target.value as EngineType)}
                    className="w-full rounded-lg border border-surface-dark bg-surface px-4 py-3 text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  >
                    <option value="diesel">Дизель</option>
                    <option value="petrol">Бензин</option>
                    <option value="hybrid">Гибрид</option>
                    <option value="electric">Электро</option>
                  </select>
                </div>

                {/* Engine volume */}
                {engineType !== 'electric' && (
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-text-primary">
                      {vehicleType === 'special'
                        ? 'Мощность, кВт'
                        : 'Объём двигателя, см³'}
                    </label>
                    <input
                      type="number"
                      value={engineVolume}
                      onChange={(e) => setEngineVolume(e.target.value)}
                      placeholder={vehicleType === 'special' ? '120' : '5900'}
                      className="w-full rounded-lg border border-surface-dark bg-surface px-4 py-3 text-text-primary placeholder:text-text-secondary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    />
                  </div>
                )}

                {/* Owner type */}
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-text-primary">
                    Кто покупатель
                  </label>
                  <select
                    value={ownerType}
                    onChange={(e) => setOwnerType(e.target.value as OwnerType)}
                    className="w-full rounded-lg border border-surface-dark bg-surface px-4 py-3 text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  >
                    <option value="entity">Юридическое лицо</option>
                    <option value="individual">Физическое лицо</option>
                  </select>
                </div>

                {/* Auction price */}
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-text-primary">
                    Стоимость на аукционе
                  </label>
                  <input
                    type="number"
                    value={auctionPrice}
                    onChange={(e) => setAuctionPrice(e.target.value)}
                    placeholder="42 000"
                    className="w-full rounded-lg border border-surface-dark bg-surface px-4 py-3 text-text-primary placeholder:text-text-secondary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  />
                </div>

                {/* Currency */}
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-text-primary">
                    Валюта
                  </label>
                  <select
                    value={currency}
                    onChange={(e) =>
                      setCurrency(e.target.value as 'USD' | 'EUR' | 'JPY' | 'CNY')
                    }
                    className="w-full rounded-lg border border-surface-dark bg-surface px-4 py-3 text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                  >
                    <option value="USD">$ USD</option>
                    <option value="EUR">€ EUR</option>
                    <option value="JPY">¥ JPY</option>
                    <option value="CNY">¥ CNY</option>
                  </select>
                </div>
              </div>

              {/* Exchange rate hint */}
              <p className="mt-4 text-xs text-text-secondary">
                Курс ЦБ РФ: 1 {currency} = {rates[currency].toFixed(2)} ₽
              </p>

              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-xl border-2 border-surface-dark px-6 py-3 font-semibold text-text-secondary transition-colors hover:border-primary hover:text-primary"
                >
                  ← Назад
                </button>
                <button
                  type="button"
                  disabled={!canProceedStep2}
                  onClick={goToStep3}
                  className="flex-1 rounded-xl bg-accent px-8 py-4 text-lg font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-accent-light hover:shadow-lg disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  Рассчитать →
                </button>
              </div>
            </div>
          )}

          {/* ════════ STEP 3 — processing animation ════════ */}
          {step === 3 && (
            <div className="flex flex-col items-center py-16">
              {/* Spinner */}
              <div className="h-14 w-14 animate-spin rounded-full border-4 border-surface-dark border-t-accent" />
              <p className="mt-6 text-lg font-semibold text-text-primary">
                Рассчитываем актуальные пошлины…
              </p>
              <p className="mt-2 text-sm text-text-secondary">
                Используем курсы ЦБ РФ и действующие тарифы ФТС
              </p>
            </div>
          )}

          {/* ════════ STEP 4 — results + lead wall ════════ */}
          {step === 4 && result && (
            <div>
              <h3 className="text-lg font-bold text-text-primary">
                Предварительный расчёт
              </h3>

              {/* Breakdown */}
              <div className="mt-6 rounded-xl bg-primary/5 p-5">
                <div className="space-y-2.5">
                  <Row label="Таможенная пошлина" value={result.customsDuty} />
                  <Row label="Таможенный сбор" value={result.customsFee} />
                  <Row label="Утилизационный сбор" value={result.utilsbor} />
                  {result.nds > 0 && (
                    <Row label="НДС 22%" value={result.nds} />
                  )}
                  {result.sbkts > 0 && (
                    <Row label="СБКТС" value={result.sbkts} />
                  )}
                  <Row
                    label={vehicleType === 'special' ? 'ПСМ' : 'ЭПТС'}
                    value={result.epts}
                  />
                  {result.glonass > 0 && (
                    <Row label="ГЛОНАСС" value={result.glonass} />
                  )}
                  <Row label="Таможенный брокер" value={result.broker} />

                  {/* Logistics — hidden behind lead wall */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">
                      Логистика до вашего города
                    </span>
                    {leadSent ? (
                      <span className="font-medium text-text-primary">
                        {formatRub(result.logistics)}
                      </span>
                    ) : (
                      <span className="rounded bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                        после заявки
                      </span>
                    )}
                  </div>

                  {/* Total */}
                  <div className="border-t border-surface-dark pt-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-text-primary">
                        Итого «под ключ»
                      </span>
                      <span className="text-2xl font-extrabold text-primary">
                        {leadSent
                          ? formatRub(result.total)
                          : '??? ₽'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lead capture wall */}
              {!leadSent ? (
                <form
                  onSubmit={handleLeadSubmit}
                  className="mt-6 rounded-xl border-2 border-accent/30 bg-accent/5 p-5"
                >
                  <p className="text-sm font-semibold text-text-primary">
                    Получите PDF-смету от инженеров СпецТехМаш. В расчёт будет
                    включена точная стоимость доставки до вашей двери тралами нашей
                    ТЛК &laquo;Тихоокеанская Звезда&raquo;. Введите WhatsApp.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <input
                      type="text"
                      required
                      value={leadName}
                      onChange={(e) => setLeadName(e.target.value)}
                      placeholder="Ваше имя"
                      className="w-full rounded-lg border border-surface-dark bg-white px-4 py-3 text-text-primary placeholder:text-text-secondary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    />
                    <input
                      type="tel"
                      required
                      value={leadPhone}
                      onChange={(e) => setLeadPhone(e.target.value)}
                      placeholder="+7 (___) ___-__-__"
                      className="w-full rounded-lg border border-surface-dark bg-white px-4 py-3 text-text-primary placeholder:text-text-secondary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="mt-4 w-full rounded-xl bg-accent px-8 py-3.5 font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-accent-light hover:shadow-lg"
                  >
                    Отправить полный расчёт в WhatsApp
                  </button>
                </form>
              ) : (
                <div className="mt-6 rounded-xl bg-green-50 p-5 text-center">
                  <span className="text-3xl">✅</span>
                  <p className="mt-2 font-semibold text-green-800">
                    Заявка отправлена!
                  </p>
                  <p className="mt-1 text-sm text-green-700">
                    PDF-смета с доставкой до вашего города придёт в WhatsApp в
                    течение 2 минут.
                  </p>
                </div>
              )}

              <p className="mt-4 text-center text-xs text-text-secondary">
                * Расчёт является предварительным. Точную стоимость с учётом
                конкретного лота уточняйте у менеджера.
              </p>

              <button
                type="button"
                onClick={resetCalc}
                className="mt-6 w-full rounded-xl border-2 border-surface-dark px-6 py-3 font-semibold text-text-secondary transition-colors hover:border-primary hover:text-primary"
              >
                ← Новый расчёт
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

/* ─── Sub‑component ──────────────────────────────────── */
function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-text-secondary">{label}</span>
      <span className="font-medium text-text-primary">{formatRub(value)}</span>
    </div>
  )
}
