import { useState, useCallback } from 'react'

interface LazyYouTubeProps {
  videoId: string
  title: string
  className?: string
}

export default function LazyYouTube({ videoId, title, className = '' }: LazyYouTubeProps) {
  const [loaded, setLoaded] = useState(false)

  const handleLoad = useCallback(() => {
    setLoaded(true)
  }, [])

  const thumbnailUrl = `https://img.youtube.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl bg-primary-dark ${className}`}
      style={{ aspectRatio: '16/9' }}
    >
      {!loaded ? (
        <button
          type="button"
          onClick={handleLoad}
          className="relative block h-full w-full cursor-pointer"
          aria-label={`Воспроизвести: ${title}`}
        >
          {/* Thumbnail */}
          <img
            src={thumbnailUrl}
            alt={title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />

          {/* Dark overlay */}
          <div className="absolute inset-0 bg-black/30 transition-colors group-hover:bg-black/40" />

          {/* Play button */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent shadow-lg transition-transform group-hover:scale-110 md:h-20 md:w-20">
              <svg
                className="ml-1 h-7 w-7 text-white md:h-8 md:w-8"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>

          {/* Title overlay */}
          <div className="absolute right-0 bottom-0 left-0 bg-gradient-to-t from-black/70 to-transparent p-4">
            <p className="text-sm font-medium text-white md:text-base">{title}</p>
          </div>
        </button>
      ) : (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
          loading="lazy"
        />
      )}
    </div>
  )
}
