# Источник данных каталога

Каталог сайта получает лоты через абстракцию `AuctionProvider`
(`lib/auction/provider.ts`). Провайдер выбирается переменными окружения —
страницы и компоненты не знают, откуда пришли данные.

## Переменные окружения

| Переменная | Значения | Описание |
|---|---|---|
| `AUCTION_PROVIDER` | `mock` (по умолчанию) / `http` | Источник данных каталога |
| `AUCTION_API_BASE_URL` | URL, например `https://data.stm-import.ru/feed` | Обязательна при `AUCTION_PROVIDER=http` |

- `mock` — детерминированные fixtures из `lib/auction/fixtures/*.json`.
  Используется в тестах и локальной разработке.
- `http` — production-режим: JSON-фид, которым владелец управляет сам
  (файл на VPS/S3, экспорт из таблицы или CRM — что угодно, что отдаёт JSON
  по HTTP).

Если `AUCTION_PROVIDER=http`, а `AUCTION_API_BASE_URL` не задан, приложение
падает на старте с понятной ошибкой конфигурации (`AuctionProviderError:
validation`). Если фид недоступен или не проходит валидацию, провайдер бросает
`timeout` / `upstream` / `validation` с текстом, где указано, что проверить.

## Формат фида

Два JSON-документа по базовому URL:

```
GET {AUCTION_API_BASE_URL}/brands.json
GET {AUCTION_API_BASE_URL}/lots.json
```

Формат идентичен fixtures — их можно использовать как стартовый шаблон:

- `brands.json` — массив брендов с моделями и поколениями
  (схема `rawBrandListSchema` в `lib/auction/schemas.ts`);
- `lots.json` — массив лотов (схема `rawLotListSchema`).

Минимальный пример лота:

```json
{
  "lot_id": "uss-tokyo-442290",
  "auction": "USS Tokyo",
  "brand": "honda",
  "model": "vezel",
  "generation": "ru",
  "year": 2019,
  "mileage_km": 62000,
  "body_type": "suv",
  "fuel": "ice",
  "engine_cc": 1500,
  "transmission": "cvt",
  "drive": "fwd",
  "color": "white",
  "grade": 4.5,
  "auction_price_jpy": 1100000,
  "auction_date": "2026-04-10",
  "photos": ["https://cdn.example.ru/lots/442290/1.jpg"],
  "trim": "X"
}
```

Опциональные поля: `generation`, `mileage_km`, `color`, `grade`,
`auction_date`, `trim`, `photos`, `require_human`, `human_reason`.
`require_human: true` принудительно переводит лот в режим «цена по запросу»
(карточка оператора) — используйте для лотов с нестандартной логистикой.

Слаги (`brand`, `model`, `generation`) — kebab-case ASCII (`[a-z0-9-]`),
и должны совпадать между `brands.json` и `lots.json`.

## Контракт фото (`photos`)

- `photos` — массив URL: либо абсолютные `https://…` (рекомендуется, CDN в РФ),
  либо root-relative пути (`/…`) для файлов из `apps/web/public/`.
- **Первое фото** — обложка: оно же `thumbnail` в каталоге и OG/JSON-LD image.
- Рекомендуется 3–8 фото на лот, ширина от 1200px, JPEG/WebP; Next сам отдаст
  AVIF/WebP нужного размера через `next/image`.
- Alt-тексты генерируются автоматически: «название, год, тип техники — фото
  с аукциона» (`lotImageAlt` в `lib/format.ts`) — руками задавать не нужно.
- Если `photos` пуст — сайт показывает `/lot-placeholder.svg` (fallback);
  в Product JSON-LD изображение при этом не эмитится.
- Для абсолютных URL хост должен быть разрешён для `next/image`: задайте
  `NEXT_PUBLIC_AUCTION_CDN_ORIGIN=https://cdn.ваш-хост.ru` — он попадёт и в
  `images.remotePatterns`, и в preconnect в `<head>`.

## Кэширование и отказоустойчивость

- Снапшот фида кэшируется в памяти процесса на 5 минут; параллельные запросы
  не создают дублирующих HTTP-вызовов.
- Таймаут запроса фида — 10 секунд.
- Если обновление фида упало, а старый снапшот есть — каталог продолжает
  работать на нём (stale-if-error).
- Выше по стеку `client.ts` дополнительно кэширует через `unstable_cache`
  (taxonomy — 1 час, лоты — 5 минут, тег `auction:lots` для on-demand
  revalidation).

## Как проверить фид перед выкладкой

```bash
# отдать fixtures как фид и убедиться, что сайт их видит:
npx serve apps/web/lib/auction/fixtures   # http://localhost:3000 (пример)
AUCTION_PROVIDER=http AUCTION_API_BASE_URL=http://localhost:3000 npm run dev -w @auto/web
```

Валидацию схемы можно прогнать тестами: `npm run test -w @auto/web`
(`lib/auction/__tests__/http-provider.test.ts`).
