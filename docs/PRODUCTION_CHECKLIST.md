# Production checklist — stm-import.ru (apps/web)

Проходится перед каждым деплоем. Порядок сверху вниз; пункт не пройден —
деплой не выкатываем.

## 1. Окружение

- [ ] `NEXT_PUBLIC_SITE_URL=https://stm-import.ru` задан в окружении сборки
      (переменная запекается в build!)
- [ ] `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` = реальный handle бота
- [ ] `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID` заданы на сервере
      (доставка заявок); значения нигде не закоммичены
- [ ] `AUCTION_PROVIDER`: `http` + рабочий `AUCTION_API_BASE_URL`
      (фид отвечает 200 на `/brands.json` и `/lots.json`), либо осознанно `mock`
- [ ] Если фото лотов на CDN — `NEXT_PUBLIC_AUCTION_CDN_ORIGIN` задан

## 2. Код и зависимости

- [ ] `npm ci` — чистая установка проходит
- [ ] `npm audit` — без high/critical
- [ ] `npm run lint -w @auto/web` — зелёный
- [ ] `npm run test -w @auto/web` — зелёный
- [ ] `npm run test -w @auto/shared` — зелёный (golden-тесты калькулятора)
- [ ] `npm run test:bot` — зелёный (если деплоится бот)
- [ ] `npm run build -w @auto/web` — зелёный

## 3. E2E smoke (перед выкаткой)

- [ ] `npx playwright install chromium` (разово на машине)
- [ ] `npm run test:e2e -w @auto/web` — все тесты зелёные

## 4. Ручная проверка на собранном сервере

- [ ] `curl https://stm-import.ru/robots.txt` — только stm-import.ru,
      нет `example.com` / `.invalid`
- [ ] `curl https://stm-import.ru/sitemap.xml` — реальные URL, каталог и услуги на месте
- [ ] `curl https://stm-import.ru/llms.txt` — 200, бренд корректный
- [ ] Мобильный вьюпорт (375–430px): меню открывается, все пункты кликабельны
- [ ] `/contacts`: тестовая заявка доходит в Telegram-чат менеджера
      (после проверки удалить/пометить как тест)
- [ ] `/calculator`: расчёт отрабатывает (первый запрос — курс ЦБ, далее кэш);
      «Получить точную смету» открывает форму
- [ ] Карточка лота: «Уточнить наличие / цену» открывает форму,
      «Открыть в Telegram» ведёт на бота
- [ ] Нигде в публичном контенте нет «Тихоокеанская Звезда» / Pacific Star

## 5. SEO / бренд

- [ ] JSON-LD главной: `name: SpecTechMash`, `legalName: ИП Хмелёв`
- [ ] Canonical/OG указывают на https://stm-import.ru
- [ ] Sitemap загружен в Яндекс.Вебмастер и Google Search Console
      (после первого деплоя)

## 6. Бот (если деплоится вместе с сайтом)

- [ ] `AI_BOT_TOKEN`, `OPENROUTER_KEY` заданы на сервере
- [ ] `BOT_TEST_MODE` НЕ задан в production
- [ ] Пробный диалог: /start, расчёт, ссылка на /calculator приходит

## Откат

Деплой ломается → откатываемся на предыдущий релиз (git tag / предыдущая
сборка), после чего разбор причин локально. Никогда не чиним «наживую» на
production.
