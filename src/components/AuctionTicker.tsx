export default function AuctionTicker() {
  const lots = [
    'Komatsu PC200-8 — $42,000 — Экономия: 1,500,000₽',
    'CAT 320D — $38,000 — Экономия: 1,100,000₽',
    'Hitachi ZX200 — $45,000 — Экономия: 1,800,000₽',
    'Volvo EC210 — $40,000 — Экономия: 1,350,000₽',
    'Toyota Land Cruiser 300 — ¥4,200,000 — Экономия: 850,000₽',
    'Hyundai HL760 погрузчик — $35,000 — Экономия: 950,000₽',
    'Kubota U-30 мини-экскаватор — ¥2,800,000 — Экономия: 620,000₽',
    'Toyota Alphard — ¥3,800,000 — Экономия: 780,000₽',
  ]

  return (
    <section className="overflow-hidden bg-primary-dark py-3">
      <div className="relative flex">
        <div className="flex shrink-0 animate-[scroll_30s_linear_infinite] gap-8">
          {lots.map((lot, i) => (
            <span
              key={i}
              className="whitespace-nowrap text-sm font-medium text-gold-light"
            >
              🔥 {lot}
            </span>
          ))}
        </div>
        <div className="flex shrink-0 animate-[scroll_30s_linear_infinite] gap-8 pl-8">
          {lots.map((lot, i) => (
            <span
              key={`dup-${i}`}
              className="whitespace-nowrap text-sm font-medium text-gold-light"
            >
              🔥 {lot}
            </span>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-100%); }
        }
      `}</style>
    </section>
  )
}
