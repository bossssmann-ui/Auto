# Спецтехмаш — Импорт авто, мототехники и спецтехники

Высококонверсионный сайт для компании по импорту автомобилей, мототехники и спецтехники из Японии, Кореи и Китая в Россию.

## Стек технологий

- **React 19** + **TypeScript**
- **Vite 8** — сборка и dev-сервер
- **Tailwind CSS 4** — стилизация

## Запуск

```bash
npm install
npm run dev
```

## Сборка

```bash
npm run build
```

## Структура проекта

```
src/
├── components/
│   ├── Header.tsx          — Sticky навигация
│   ├── Hero.tsx            — Hero-секция с CTA
│   ├── AuctionTicker.tsx   — Бегущая строка аукционных лотов
│   ├── PainSolution.tsx    — Блок «боль → решение»
│   ├── Services.tsx        — Услуги (авто, мото, спецтехника)
│   ├── Calculator.tsx      — Калькулятор стоимости импорта
│   ├── Trust.tsx           — Отзывы и социальное доказательство
│   ├── DeliveryMap.tsx     — Этапы доставки (таймлайн)
│   ├── LeadMagnet.tsx      — Лид-магнит (PDF-каталог)
│   ├── Footer.tsx          — Подвал сайта
│   ├── FloatingWidget.tsx  — Плавающие кнопки WhatsApp/Telegram
│   └── ExitIntent.tsx      — Exit-intent попап
├── App.tsx                 — Главный компонент
├── index.css               — Tailwind + тема
└── main.tsx                — Точка входа
```
