import { useState } from 'react'

export default function FloatingWidget() {
  const [showTooltip, setShowTooltip] = useState<'wa' | 'tg' | null>(null)

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-3 sm:right-6 sm:bottom-6">
      {/* Telegram */}
      <div className="relative">
        {showTooltip === 'tg' && (
          <span className="absolute right-full top-1/2 mr-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-white shadow-lg">
            Написать в Telegram
          </span>
        )}
        <a
          href="#"
          onMouseEnter={() => setShowTooltip('tg')}
          onMouseLeave={() => setShowTooltip(null)}
          aria-label="Telegram"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0088cc] text-2xl text-white shadow-lg transition-transform hover:scale-110"
        >
          ✈️
        </a>
      </div>

      {/* WhatsApp */}
      <div className="relative">
        {showTooltip === 'wa' && (
          <span className="absolute right-full top-1/2 mr-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-white shadow-lg">
            Написать в WhatsApp
          </span>
        )}
        <a
          href="#"
          onMouseEnter={() => setShowTooltip('wa')}
          onMouseLeave={() => setShowTooltip(null)}
          aria-label="WhatsApp"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[#25d366] text-2xl text-white shadow-lg transition-transform hover:scale-110"
        >
          📞
        </a>
      </div>
    </div>
  )
}
