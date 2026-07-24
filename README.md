# Спецтехмаш — импорт авто, мототехники и спецтехники

Монорепозиторий сайта и сервисов Спецтехмаша: импорт техники с аукционов Японии,
Кореи и Китая с расчётом стоимости под ключ и собственной логистикой через ТЛК.

**Источник правды по плану работ:** [`PROJECT_PLAN.md`](./PROJECT_PLAN.md).
Перед деплоем: [`docs/PRODUCTION_CHECKLIST.md`](./docs/PRODUCTION_CHECKLIST.md).

## Структура

```
apps/
├── bot/                    # @auto/bot — Telegram-бот (tsx runtime)
└── web/                    # @auto/web — Next.js 16 + Tailwind v4 + shadcn/ui
packages/
└── shared/                 # @auto/shared — общий калькулятор под ключ
server/                     # HTTP-стек для старой лид-формы (index, lead, amocrm)
src/                        # ⚠️ Legacy Vite SPA — НЕ деплоить (см. src/README.md)
```

**Production-сайт — только `apps/web`.** Legacy SPA в `src/` содержит
демо-контакты и dev-mode лид-форму; его деплой как production недопустим без
отдельного решения. Корневые `npm run dev` / `npm run build` собирают
`apps/web`; legacy доступен через `dev:legacy` / `build:legacy`.

Ключевой инвариант: **один калькулятор на два канала**. Бот и сайт вызывают
`calculateTurnkeyPrice` из `@auto/shared` — пошлина, утильсбор, фрахт и
санкционные коэффициенты считаются одинаково везде.

## Команды

Все воркспейсы запускаются через npm workspaces с корня.

### Web (`@auto/web`)

| Команда                                | Что делает                                     |
| -------------------------------------- | ---------------------------------------------- |
| `npm run dev -w @auto/web`             | dev-сервер Next.js                             |
| `npm run build -w @auto/web`           | продакшн-сборка (SSG + ISR, ~70 роутов)        |
| `npm run lint -w @auto/web`            | ESLint                                         |
| `npm run test -w @auto/web`            | Vitest (auction-слой, SEO, калькулятор)        |
| `npm run test:e2e -w @auto/web`        | Playwright smoke (см. `apps/web/README.md`)    |

### Shared (`@auto/shared`)

| Команда                                | Что делает                                     |
| -------------------------------------- | ---------------------------------------------- |
| `npm run test -w @auto/shared`         | Vitest golden-sample на калькуляторе           |

### Bot (`@auto/bot`)

```bash
npm run test:bot   # оба bot-теста (bot.test.ts + calculator-link.test.ts)
```

## Архитектурные правила

- `@auto/shared` — публичный API: `calculateTurnkeyPrice`, `isSanctionedVehicle`,
  `fetchCbrRates` и связанные типы. Ничего внутреннего наружу не утекает.
- В `apps/web` страницы и компоненты не читают `process.env`. Единственные
  модули с доступом к env — `lib/auction/client.ts` (провайдер данных) и
  `lib/seo.ts` (SEO + OG).
- Калькулятор в `apps/web` зовётся из одного места — `lib/auction/mappers.ts`
  и `app/api/calculator/route.ts` (POST /api/calculator). Страница
  `/calculator` — client-form, считающая через этот API.
- Дизайн-система: class-based dark mode, без градиентов (допустим один
  радиальный glow), `rounded-xl` на карточках, `rounded-lg` на кнопках,
  без эмоджи в интерфейсе.

## Переменные окружения

Web (`.env.local`):

| Переменная                             | Назначение                                     |
| -------------------------------------- | ---------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                 | Канонический origin для canonical / OG / sitemap |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`    | Хэндл бота для deep-link `t.me/…`              |
| `NEXT_PUBLIC_AUCTION_CDN_ORIGIN`       | (опц.) хост CDN — для preconnect               |
| `AUCTION_PROVIDER`                     | `mock` или `http` — выбор провайдера аукциона  |

Bot и legacy `server/` используют свои `.env` (см. `.env.example`).

## Лицензия

Проприетарный код Спецтехмаша. Все права защищены.
