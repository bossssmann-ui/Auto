# ⚠️ Legacy Vite SPA — НЕ production-сайт

Это старый одностраничник. **Актуальный production-сайт — `apps/web`
(Next.js)**; источник правды по плану — `PROJECT_PLAN.md` (задача P2-07).

## Почему этот код нельзя деплоить как production

- Демо-контакты (`+7 (999) 123-45-67`) и ссылки-заглушки `href="#"`.
- Лид-форма в dev-режиме показывает success **без** реального backend
  (`VITE_API_URL` по умолчанию указывает на localhost).
- Контент и бренд не синхронизированы с актуальным сайтом.

## Статус

- Код сохранён для справки и переноса контента (услуги/лендинги —
  PROJECT_PLAN P2-06), **не развивается**.
- Скрипты переименованы: `npm run dev:legacy` / `npm run build:legacy` /
  `npm run preview:legacy`. Корневые `npm run dev` / `npm run build`
  теперь собирают актуальный сайт `apps/web`.
- Удаление legacy — только отдельным решением владельца.

## Production deploy

```bash
npm run build -w @auto/web   # то же, что npm run build из корня
npm run start -w @auto/web
```

Перед деплоем — `docs/PRODUCTION_CHECKLIST.md`.
