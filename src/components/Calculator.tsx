import { useState } from 'react'

export default function Calculator() {
  const [vehicleType, setVehicleType] = useState('special')
  const [country, setCountry] = useState('japan')
  const [auctionPrice, setAuctionPrice] = useState('')
  const [engineVolume, setEngineVolume] = useState('')
  const [year, setYear] = useState('')
  const [result, setResult] = useState<{
    total: number
    logistics: number
    customs: number
    utilsbor: number
    nds: number
    sbkts: number
  } | null>(null)

  const calculate = () => {
    const price = parseFloat(auctionPrice) || 0
    const volume = parseFloat(engineVolume) || 0
    const isSpecial = vehicleType === 'special'

    const logisticsRub = price * 92 * 1.15
    const customsRub = volume * 3.5 * 92
    const sbkts = 80000
    const utilsbor = isSpecial ? 862500 : 178500
    const subtotal = logisticsRub + customsRub + sbkts + utilsbor
    const nds = isSpecial ? subtotal * 0.20 : 0
    const totalRub = subtotal + nds

    setResult({
      total: Math.round(totalRub),
      logistics: Math.round(logisticsRub),
      customs: Math.round(customsRub),
      utilsbor: Math.round(utilsbor),
      nds: Math.round(nds),
      sbkts,
    })
  }

  const formatRub = (n: number) =>
    n.toLocaleString('ru-RU') + ' ₽'

  return (
    <section id="calculator" className="bg-surface py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-extrabold text-primary sm:text-3xl md:text-4xl">
          Калькулятор стоимости импорта «под ключ»
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-text-secondary">
          Включает логистику, таможню, ПСМ, утильсбор, НДС 20% (для спецтехники), СБКТС и ЭПТС
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
                <option value="special">Спецтехника</option>
                <option value="car">Легковой автомобиль</option>
                <option value="moto">Мотоцикл</option>
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
                placeholder="Например: 42000"
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
                placeholder="Например: 5900"
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
                placeholder="Например: 2019"
                className="w-full rounded-lg border border-surface-dark bg-surface px-4 py-3 text-text-primary placeholder:text-text-secondary/50 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
              />
            </div>
          </div>

          <button
            onClick={calculate}
            className="mt-8 w-full rounded-xl bg-accent px-8 py-4 text-lg font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-accent-light hover:shadow-lg"
          >
            Рассчитать стоимость «под ключ»
          </button>

          {result !== null && (
            <div className="mt-8 rounded-xl bg-primary/5 p-6">
              <p className="text-center text-sm text-text-secondary">
                Примерная стоимость «под ключ»:
              </p>
              <p className="mt-2 text-center text-3xl font-extrabold text-primary md:text-4xl">
                {formatRub(result.total)}
              </p>

              {/* Breakdown */}
              <div className="mt-6 space-y-2 border-t border-surface-dark pt-4">
                <div className="flex justify-between text-sm text-text-secondary">
                  <span>Логистика (аукцион + доставка)</span>
                  <span className="font-medium text-text-primary">{formatRub(result.logistics)}</span>
                </div>
                <div className="flex justify-between text-sm text-text-secondary">
                  <span>Таможенная пошлина</span>
                  <span className="font-medium text-text-primary">{formatRub(result.customs)}</span>
                </div>
                <div className="flex justify-between text-sm text-text-secondary">
                  <span>Утильсбор</span>
                  <span className="font-medium text-text-primary">{formatRub(result.utilsbor)}</span>
                </div>
                {result.nds > 0 && (
                  <div className="flex justify-between text-sm text-text-secondary">
                    <span>НДС 20%</span>
                    <span className="font-medium text-text-primary">{formatRub(result.nds)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-text-secondary">
                  <span>СБКТС + ЭПТС / ПСМ</span>
                  <span className="font-medium text-text-primary">{formatRub(result.sbkts)}</span>
                </div>
              </div>

              <p className="mt-4 text-center text-xs text-text-secondary">
                * Расчёт является предварительным. Точную стоимость с учётом конкретного лота уточняйте у менеджера.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
