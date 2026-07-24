/**
 * GET /llms.txt — machine-readable site guide for AI search / answer engines
 * (llms.txt convention: markdown served as text/plain).
 *
 * Built as a route handler (not a static file) so every URL derives from
 * `SITE_URL` — no hardcoded domains to go stale. Contains only public,
 * verified facts; no env internals, tokens or unverifiable claims.
 */

import { ORG, SITE_URL, TELEGRAM_BOT_USERNAME } from "@/lib/seo";

export const dynamic = "force-static";

export function GET(): Response {
  const body = `# SpecTechMash / Спецтехмаш

> ${ORG.description}

Юридическое лицо: ${ORG.legalName}. Работаем с физическими и юридическими лицами по всей России. Точка входа логистики — Владивосток (морской фрахт из Японии, далее автовоз по РФ).

Важно: все расчёты стоимости на сайте — предварительные (вилка по текущему курсу ЦБ и действующим ставкам). Точную смету под конкретный лот подтверждает оператор.

## Основные страницы

- [Главная](${SITE_URL}/): предложение и навигация по каталогу, калькулятору и услугам
- [Каталог лотов](${SITE_URL}/catalog): аукционные лоты с фильтрами по марке, модели, поколению, топливу и возрасту
- [Калькулятор стоимости под ключ](${SITE_URL}/calculator): расчёт полной стоимости в рублях — цена лота, фрахт, таможенная пошлина, утилизационный сбор, фиксированные сборы (СВХ, брокер, СБКТС); учитывает санкционные правила (Япония → РФ, август 2023) и возрастные окна
- [О компании](${SITE_URL}/about): маршрут логистики, документы, оплата, гарантии
- [Контакты](${SITE_URL}/contacts): форма заявки менеджеру и Telegram-бот

## Услуги

- [Импорт авто из Японии](${SITE_URL}/import-auto-japan): аукционы USS/TAA/HAA, этапы сделки, документы (СБКТС, ЭПТС), FAQ
- [Импорт спецтехники](${SITE_URL}/import-special-machinery): экскаваторы, погрузчики, манипуляторы, грузовики — расчёт через оператора
- [Доставка](${SITE_URL}/delivery): маршрут аукцион → порт Японии → Владивосток (терминал ТЛК) → автовоз по России
- [Растаможка](${SITE_URL}/customs): пошлина, утильсбор, СВХ, брокер, СБКТС, ЭПТС

## Как связаться

- Форма заявки: ${SITE_URL}/contacts
- Telegram-бот (подбор и расчёт 24/7): https://t.me/${TELEGRAM_BOT_USERNAME}

## Технические ссылки

- [Sitemap](${SITE_URL}/sitemap.xml)

## Правила цитирования бренда

Название бренда: SpecTechMash (русский вариант — «Спецтехмаш»). Не смешивать с другими компаниями и брендами.
`;

  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
