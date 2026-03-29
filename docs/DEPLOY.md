# 🚀 Деплой backend-сервера на VPS (Ubuntu, Reg.ru)

Пошаговая инструкция по установке и запуску backend-микросервиса для обработки
заявок с калькулятора на VPS-сервере.

---

## 1. Подключение к серверу

Откройте терминал (или PuTTY на Windows) и подключитесь к серверу по SSH:

```bash
ssh root@<IP_ВАШЕГО_СЕРВЕРА>
```

---

## 2. Установка Node.js

Установите Node.js 20 LTS через NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
```

Проверьте установку:

```bash
node -v   # должен показать v20.x.x
npm -v    # должен показать 10.x.x
```

---

## 3. Создание папки проекта

```bash
mkdir -p /opt/lead-api
cd /opt/lead-api
```

---

## 4. Инициализация проекта и установка зависимостей

```bash
npm init -y
npm install express cors dotenv
```

---

## 5. Создание файла сервера

Создайте файл `server.js`:

```bash
nano server.js
```

Вставьте следующий код:

```js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const PORT = parseInt(process.env.PORT || '3001', 10);
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || '*';

const app = express();

// ── Middleware ──────────────────────────────────
app.use(cors({ origin: ALLOWED_ORIGIN, methods: ['POST', 'OPTIONS'] }));
app.use(express.json({ limit: '1mb' }));

// ── Telegram ───────────────────────────────────
function formatTelegramMessage(lead) {
  const vehicleLabels = {
    car: '🚗 Автомобиль',
    special: '🏗️ Спецтехника',
    moto: '🏍️ Мототехника',
  };

  const lines = [
    '🔥 НОВЫЙ ЛИД (Калькулятор)',
    '',
    `👤 Имя: ${lead.name}`,
    `📞 Телефон: ${lead.phone}`,
  ];

  if (lead.vehicleType) {
    lines.push(`🚘 Тип: ${vehicleLabels[lead.vehicleType] || lead.vehicleType}`);
  }
  if (lead.city) lines.push(`🏙️ Город: ${lead.city}`);
  if (lead.year) lines.push(`📅 Год выпуска: ${lead.year}`);
  if (lead.engineType) lines.push(`⚙️ Двигатель: ${lead.engineType}`);
  if (lead.engineVolume) lines.push(`📏 Объём/мощность: ${lead.engineVolume}`);
  if (lead.auctionPrice && lead.currency) {
    lines.push(`💰 Цена на аукционе: ${lead.auctionPrice} ${lead.currency}`);
  }
  if (lead.ownerType) {
    lines.push(`🏢 Покупатель: ${lead.ownerType === 'entity' ? 'Юрлицо' : 'Физлицо'}`);
  }

  return lines.join('\n');
}

async function sendTelegramNotification(lead) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn('[Telegram] Токен или Chat ID не настроены — пропуск');
    return;
  }

  const text = formatTelegramMessage(lead);
  const url = `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });

  const json = await res.json();
  if (!json.ok) {
    console.error('[Telegram] Ошибка отправки:', json.description);
  }
}

// ── amoCRM (заготовка) ─────────────────────────
// Здесь будет интеграция с amoCRM через OAuth 2.0.
// Сейчас — скелетная функция; токен-рефреш и полная
// логика будут добавлены позже.
async function pushToAmoCRM(lead) {
  const domain = process.env.AMOCRM_DOMAIN;
  const accessToken = process.env.AMOCRM_ACCESS_TOKEN;

  if (!domain || !accessToken) {
    console.warn('[amoCRM] Домен или токен не настроены — пропуск');
    return;
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
  const baseUrl = `https://${domain}`;

  // 1. Создание контакта
  const contactRes = await fetch(`${baseUrl}/api/v4/contacts`, {
    method: 'POST',
    headers,
    body: JSON.stringify([{
      name: lead.name,
      custom_fields_values: [
        { field_code: 'PHONE', values: [{ value: lead.phone, enum_code: 'MOB' }] },
      ],
    }]),
  });

  if (!contactRes.ok) {
    console.error('[amoCRM] Ошибка создания контакта:', await contactRes.text());
    return;
  }

  const contactData = await contactRes.json();
  const contactId = contactData._embedded?.contacts?.[0]?.id;

  // 2. Создание сделки, привязанной к контакту
  const leadName = lead.vehicleType
    ? `${lead.vehicleType} — ${lead.name}`
    : `Заявка — ${lead.name}`;

  await fetch(`${baseUrl}/api/v4/leads`, {
    method: 'POST',
    headers,
    body: JSON.stringify([{
      name: leadName,
      _embedded: { contacts: [{ id: contactId }] },
    }]),
  });
}

// ── Маршруты ───────────────────────────────────
app.post('/api/lead', async (req, res) => {
  try {
    const { name, phone } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Укажите имя и телефон',
      });
    }

    // Запускаем обе интеграции параллельно — ни одна не блокирует ответ
    const results = await Promise.allSettled([
      sendTelegramNotification(req.body),
      pushToAmoCRM(req.body),
    ]);

    for (const r of results) {
      if (r.status === 'rejected') {
        console.error('[Lead] Ошибка интеграции:', r.reason);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Заявка принята. Мы свяжемся с вами в ближайшее время.',
    });
  } catch (err) {
    console.error('[Lead] Ошибка:', err);
    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера',
    });
  }
});

// ── Запуск ─────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Lead API] Сервер запущен: http://localhost:${PORT}`);
});
```

Сохраните файл: **Ctrl + O**, **Enter**, затем **Ctrl + X**.

---

## 6. Настройка переменных окружения

Создайте файл `.env`:

```bash
nano .env
```

Добавьте:

```env
# Telegram
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
TELEGRAM_CHAT_ID=-1001234567890

# amoCRM (заполнить позже, когда будет готова интеграция)
AMOCRM_DOMAIN=
AMOCRM_ACCESS_TOKEN=

# Сервер
PORT=3001

# CORS — укажите домен вашего сайта
CORS_ORIGIN=https://ваш-домен.ru
```

> ⚠️ Замените значения `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID` на реальные.

Как получить токен Telegram-бота:
1. Откройте @BotFather в Telegram, отправьте `/newbot`.
2. Скопируйте полученный HTTP API токен.
3. Отправьте любое сообщение боту, затем откройте:
   `https://api.telegram.org/bot<TOKEN>/getUpdates` — найдите `chat_id`.

---

## 7. Проверка работы

Запустите сервер:

```bash
node server.js
```

В другом терминале (или через Postman) отправьте тестовый запрос:

```bash
curl -X POST http://localhost:3001/api/lead \
  -H "Content-Type: application/json" \
  -d '{"name": "Тест", "phone": "+79001234567", "vehicleType": "car"}'
```

Должен прийти ответ:

```json
{"success": true, "message": "Заявка принята. Мы свяжемся с вами в ближайшее время."}
```

И сообщение в Telegram (если токен настроен).

---

## 8. Установка PM2 (автозапуск)

PM2 — менеджер процессов, который держит сервер запущенным и автоматически
перезапускает при сбоях или перезагрузке VPS.

```bash
npm install -g pm2
```

Запустите сервер через PM2:

```bash
cd /opt/lead-api
pm2 start server.js --name lead-api
```

Добавьте автозапуск при перезагрузке сервера:

```bash
pm2 startup
pm2 save
```

Полезные команды PM2:

| Команда              | Описание                        |
| -------------------- | ------------------------------- |
| `pm2 list`           | Список запущенных процессов     |
| `pm2 logs lead-api`  | Просмотр логов                  |
| `pm2 restart lead-api` | Перезапуск сервера            |
| `pm2 stop lead-api`  | Остановка сервера               |

---

## 9. Настройка Nginx (reverse proxy)

Чтобы ваш API был доступен по домену (например, `api.ваш-домен.ru`),
настройте Nginx как обратный прокси:

```bash
apt install -y nginx
nano /etc/nginx/sites-available/lead-api
```

Вставьте конфигурацию:

```nginx
server {
    listen 80;
    server_name api.ваш-домен.ru;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Активируйте и перезапустите Nginx:

```bash
ln -s /etc/nginx/sites-available/lead-api /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

---

## 10. SSL-сертификат (Let's Encrypt)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d api.ваш-домен.ru
```

Certbot автоматически обновит конфигурацию Nginx для HTTPS.

---

## 11. Подключение фронтенда

В файле `.env` фронтенда (Vite) укажите адрес вашего API:

```env
VITE_API_URL=https://api.ваш-домен.ru
```

Пересоберите фронтенд:

```bash
npm run build
```

---

## Итоговая структура на сервере

```
/opt/lead-api/
├── .env           ← переменные окружения (НЕ коммитить!)
├── server.js      ← основной файл сервера
├── package.json
└── node_modules/
```

---

## Частые проблемы

| Проблема                              | Решение                                            |
| ------------------------------------- | -------------------------------------------------- |
| `EADDRINUSE: port 3001`               | Порт занят. Смените `PORT` в `.env` или убейте процесс: `lsof -i :3001` |
| Telegram не приходит                  | Проверьте `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID` в `.env`             |
| CORS-ошибка в браузере               | Установите `CORS_ORIGIN=https://ваш-домен.ru` в `.env`                  |
| Сервер не перезапускается после VPS   | Выполните `pm2 startup && pm2 save`                                      |
