import { useState } from 'react'

export default function Calculator() {
  const [vehicleType, setVehicleType] = useState('car')
  const [country, setCountry] = useState('japan')
  const [auctionPrice, setAuctionPrice] = useState('')
  const [engineVolume, setEngineVolume] = useState('')
  const [year, setYear] = useState('')
  const [result, setResult] = useState<number | null>(null)

  const calculate = () => {
    const price = parseFloat(auctionPrice) || 0
    const volume = parseFloat(engineVolume) || 0

    const logistics = price * 1.15
    const customs = volume * 3.5
    const sbkts = 80000
    const totalUsd = logistics + customs
    const totalRub = totalUsd * 92 + sbkts

    setResult(Math.round(totalRub))
  }

  const formatRub = (n: number) =>
    n.toLocaleString('ru-RU') + ' ₽'

  return (
    <section id="calculator" className="bg-surface py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-extrabold text-primary sm:text-3xl md:text-4xl">
          Калькулятор стоимости импорта
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-text-secondary">
          Рассчитайте примерную стоимость доставки «под ключ»
        </p>

        <div className="mx-auto mt-12 max-w-2xl rounded-2xl bg-white p-6 shadow-lg md:p-10">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Vehicle type */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-text-primary">
                Тип ТС
              </label>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className="w-full rounded-lg border border-surface-dark bg-surface px-4 py-3 text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              >
                <option value="car">Легковой автомобиль</option>
                <option value="moto">Мотоцикл</option>
                <option value="special">Спецтехника</option>
              </select>
            </div>

            {/* Country */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-text-primary">
                Страна отправки
              </label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full rounded-lg border border-surface-dark bg-surface px-4 py-3 text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              >
                <option value="japan">Япония</option>
                <option value="korea">Корея</option>
                <option value="china">Китай</option>
              </select>
            </div>

            {/* Auction price */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-text-primary">
                Стоимость на аукционе, $
              </label>
              <input
                type="number"
                value={auctionPrice}
                onChange={(e) => setAuctionPrice(e.target.value)}
                placeholder="Например: 15000"
                className="w-full rounded-lg border border-surface-dark bg-surface px-4 py-3 text-text-primary placeholder:text-text-secondary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              />
            </div>

            {/* Engine volume */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-text-primary">
                Объём двигателя, см³
              </label>
              <input
                type="number"
                value={engineVolume}
                onChange={(e) => setEngineVolume(e.target.value)}
                placeholder="Например: 2000"
                className="w-full rounded-lg border border-surface-dark bg-surface px-4 py-3 text-text-primary placeholder:text-text-secondary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              />
            </div>

            {/* Year */}
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-text-primary">
                Год выпуска
              </label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="Например: 2021"
                className="w-full rounded-lg border border-surface-dark bg-surface px-4 py-3 text-text-primary placeholder:text-text-secondary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              />
            </div>
          </div>

          <button
            onClick={calculate}
            className="mt-8 w-full rounded-xl bg-accent px-8 py-4 text-lg font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-accent-light hover:shadow-lg"
          >
            Рассчитать стоимость
          </button>

          {result !== null && (
            <div className="mt-8 rounded-xl bg-primary/5 p-6 text-center">
              <p className="text-sm text-text-secondary">
                Примерная стоимость «под ключ»:
              </p>
              <p className="mt-2 text-3xl font-extrabold text-primary md:text-4xl">
                {formatRub(result)}
              </p>
              <p className="mt-2 text-xs text-text-secondary">
                * Расчёт является предварительным. Точную стоимость уточняйте у менеджера.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
