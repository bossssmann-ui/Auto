# @auto/web — сайт SpecTechMash (stm-import.ru)

Production-сайт на **Next.js (App Router, SSG/ISR)**: каталог аукционных
лотов, калькулятор стоимости «под ключ», лид-формы, SEO-страницы услуг.

Не путать с **legacy Vite SPA** в корне репозитория (`src/`, `server/`) — это
старый одностраничник, он не развивается и не деплоится (см. `PROJECT_PLAN.md`,
задача P2-07). Рабочий сайт — только `apps/web`.

Источник правды по плану работ: [`PROJECT_PLAN.md`](../../PROJECT_PLAN.md)
(issue #81). Перед доработками — читать его.

## Команды

Все команды запускаются из корня репозитория:

```bash
npm install                      # один раз: зависимости всего монорепо

npm run dev   -w @auto/web       # dev-сервер на :3000
npm run build -w @auto/web       # production build
npm run start -w @auto/web       # запуск production-сборки
npm run lint  -w @auto/web       # eslint
npm run test  -w @auto/web       # unit-тесты (vitest)
npm run test:e2e -w @auto/web    # e2e smoke (playwright), см. ниже
npm run test  -w @auto/shared    # golden-тесты калькулятора
```

## Переменные окружения

Шаблон: [`apps/web/.env.example`](./.env.example) (копировать в `.env.local`).

| Переменная | Обязательна | Что делает |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | **да (prod)** | Домен сайта (`https://stm-import.ru`) для canonical/OG/JSON-LD/robots/sitemap/llms.txt. Без неё — «шумный» фолбэк `set-site-url.invalid`, чтобы неправильный деплой был виден сразу |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | нет | Username бота (без `@`) для t.me-ссылок; по умолчанию `spectechmash_bot` |
| `AUCTION_PROVIDER` | нет | `mock` (fixtures, по умолчанию) или `http` (production-фид) |
| `AUCTION_API_BASE_URL` | при `http` | Базовый URL JSON-фида каталога — формат в [`lib/auction/README.md`](./lib/auction/README.md) |
| `NEXT_PUBLIC_AUCTION_CDN_ORIGIN` | нет | Origin фотографий лотов: попадает в `next/image remotePatterns` и preconnect |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | **да (prod)** | Доставка заявок `/api/lead` в Telegram. Без них лид принимается, но не доставляется (dev-режим). Только server-side, в клиент не попадают |

Секреты в git не коммитятся; amoCRM живёт в legacy `server/` до отдельного
решения (см. PROJECT_PLAN, P1-01).

## Архитектура — краткая карта

- `app/` — маршруты: каталог (`catalog`, `lot/[id]`), `calculator`, `contacts`,
  SEO-страницы (`import-auto-japan`, `import-special-machinery`, `delivery`,
  `customs`), API (`api/lead`, `api/calculator`), `robots.ts`, `sitemap.ts`,
  `llms.txt`.
- `lib/seo.ts` — единственный источник `SITE_URL`, `ORG`, JSON-LD билдеров.
- `lib/auction/` — данные каталога через абстракцию `AuctionProvider`
  (mock fixtures / HTTP JSON-фид) — см. локальный README.
- `lib/lead-schema.ts` + `app/api/lead` — контракт и доставка заявок.
- Калькулятор: формулы только в `@auto/shared` (общие с Telegram-ботом);
  **не менять** пошлины/утильсбор/фрахт/НДС без явного бизнес-решения.

## E2E smoke tests (Playwright)

Ключевые пользовательские пути: desktop-переход главная → каталог → лот,
мобильное меню (hamburger), валидация формы контактов и Telegram CTA,
валидация и расчёт калькулятора, robots/sitemap/llms.txt без dev-фолбэков,
отсутствие console errors на основных страницах.

```bash
# Полный прогон: Playwright сам соберёт прод-билд и поднимет сервер (порт 3105)
npm run test:e2e -w @auto/web

# Против уже запущенного сервера (dev или prod)
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e -w @auto/web

# Разовая установка браузера
npx playwright install chromium
```

Секреты не требуются: lead API без Telegram env деградирует безопасно, а
тесты никогда не отправляют реальную заявку.

## Деплой

Хостинг: РФ VPS + Node.js (SSR/ISR, важно для индексации Яндексом).
Перед каждым деплоем проходить
[`docs/PRODUCTION_CHECKLIST.md`](../../docs/PRODUCTION_CHECKLIST.md).
