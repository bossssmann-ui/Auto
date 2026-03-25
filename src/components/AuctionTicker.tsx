export default function AuctionTicker() {
  const lots = [
    'Toyota Land Cruiser 300 — ¥4,200,000 — Экономия: 850,000₽',
    'Nissan GT-R R35 — ¥6,500,000 — Экономия: 1,200,000₽',
    'Honda CBR1000RR — ¥1,100,000 — Экономия: 320,000₽',
    'Komatsu PC200 — $42,000 — Экономия: 1,500,000₽',
    'Hyundai Santa Fe — ₩28,000,000 — Экономия: 600,000₽',
    'Toyota Alphard — ¥3,800,000 — Экономия: 780,000₽',
    'Kawasaki ZX-10R — ¥950,000 — Экономия: 290,000₽',
    'CAT 320D — $38,000 — Экономия: 1,100,000₽',
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
