import { useState, useEffect } from 'react'
import LazyYouTube from './LazyYouTube'

interface YouTubeVideo {
  id: string
  title: string
}

const CHANNEL_ID = import.meta.env.VITE_YOUTUBE_CHANNEL_ID || 'UC_SpecTehMash'
const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY || ''

const FALLBACK_VIDEOS: YouTubeVideo[] = [
  {
    id: 'dQw4w9WgXcQ',
    title: 'Поставка экскаватора Komatsu PC200 из Японии — полный цикл',
  },
  {
    id: 'dQw4w9WgXcQ',
    title: 'Инспекция фронтального погрузчика CAT 950 перед покупкой',
  },
  {
    id: 'dQw4w9WgXcQ',
    title: 'Таможенное оформление спецтехники: ПСМ, утильсбор, НДС',
  },
  {
    id: 'dQw4w9WgXcQ',
    title: 'Доставка бульдозера Komatsu D65 — от аукциона до площадки',
  },
  {
    id: 'dQw4w9WgXcQ',
    title: 'Проверка гидравлики экскаватора Hitachi ZX200 — репортаж',
  },
  {
    id: 'dQw4w9WgXcQ',
    title: 'Импорт мини-экскаватора Kubota U-30 из Японии для клиента',
  },
]

async function fetchChannelVideos(): Promise<YouTubeVideo[]> {
  if (!API_KEY) return FALLBACK_VIDEOS

  try {
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${encodeURIComponent(CHANNEL_ID)}&maxResults=6&order=date&type=video&key=${encodeURIComponent(API_KEY)}`

    const res = await fetch(searchUrl)
    if (!res.ok) return FALLBACK_VIDEOS

    const data = await res.json()

    if (!data.items || data.items.length === 0) return FALLBACK_VIDEOS

    return data.items.map(
      (item: { id: { videoId: string }; snippet: { title: string } }) => ({
        id: item.id.videoId,
        title: item.snippet.title,
      }),
    )
  } catch {
    return FALLBACK_VIDEOS
  }
}

export default function YouTubeGrid() {
  const [videos, setVideos] = useState<YouTubeVideo[]>(FALLBACK_VIDEOS)

  useEffect(() => {
    fetchChannelVideos().then(setVideos)
  }, [])

  return (
    <section id="case-studies" className="bg-surface py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <span className="inline-block rounded-full bg-accent/10 px-4 py-1 text-sm font-bold uppercase tracking-wider text-accent">
            Видео
          </span>
          <h2 className="mt-4 text-2xl font-extrabold text-primary sm:text-3xl md:text-4xl">
            Кейсы и реальные поставки
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-text-secondary">
            Видеоотчёты с аукционов, технических инспекций и доставок техники нашим
            клиентам. Канал{' '}
            <a
              href="https://youtube.com/@SpecTehMash"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-accent underline-offset-2 hover:underline"
            >
              @SpecTehMash
            </a>{' '}
            на YouTube.
          </p>
        </div>

        {/* Video grid */}
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((video, i) => (
            <LazyYouTube
              key={`${video.id}-${i}`}
              videoId={video.id}
              title={video.title}
            />
          ))}
        </div>

        {/* CTA to channel */}
        <div className="mt-10 text-center">
          <a
            href="https://youtube.com/@SpecTehMash"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border-2 border-accent px-8 py-3 text-base font-bold text-accent transition-all hover:-translate-y-0.5 hover:bg-accent hover:text-white hover:shadow-lg"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
            Смотреть все видео на канале
          </a>
        </div>
      </div>
    </section>
  )
}
