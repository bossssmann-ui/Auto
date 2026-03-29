/**
 * Express.js API server for lead capture.
 *
 * Run:
 *   npx tsx server/index.ts
 *
 * Or compile with `tsc` and then:
 *   node dist-server/index.js
 *
 * The server exposes a single POST endpoint: /api/lead
 */

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { handleLead } from './lead.js'
import { exchangeAuthCode } from './amocrm.js'

const PORT = parseInt(process.env.PORT ?? '3001', 10)
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN ?? '*'

const app = express()

// ── Middleware ────────────────────────────────────────────
app.use(cors({ origin: ALLOWED_ORIGIN, methods: ['GET', 'POST', 'OPTIONS'] }))
app.use(express.json({ limit: '1mb' }))

// ── Routes ───────────────────────────────────────────────
app.post('/api/lead', async (req, res) => {
  try {
    const result = await handleLead(req.body)
    res.status(200).json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка сервера'
    const isValidation = message === 'Укажите ваше имя'
      || message === 'Укажите номер телефона'
      || message === 'Некорректный формат данных'
    res.status(isValidation ? 400 : 500).json({ success: false, message })
  }
})

// ── Rate limiter for auth endpoint ────────────────────────
const AUTH_RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const AUTH_RATE_LIMIT_MAX = 5 // max requests per window
const authRequestTimestamps: number[] = []

/**
 * Exchange an authorization code for the initial amoCRM token pair.
 *
 * Usage:
 *   GET /api/amocrm/auth?code=<authorization_code>
 *
 * The authorization code is obtained once from the amoCRM UI after creating
 * an integration. See docs/amocrm-setup.md for step-by-step instructions.
 */
app.get('/api/amocrm/auth', async (req, res) => {
  // Simple rate limiting
  const now = Date.now()
  while (authRequestTimestamps.length > 0 && authRequestTimestamps[0]! < now - AUTH_RATE_LIMIT_WINDOW_MS) {
    authRequestTimestamps.shift()
  }
  if (authRequestTimestamps.length >= AUTH_RATE_LIMIT_MAX) {
    res.status(429).json({ success: false, message: 'Слишком много запросов. Попробуйте позже.' })
    return
  }
  authRequestTimestamps.push(now)

  const code = req.query.code
  if (!code || typeof code !== 'string') {
    res.status(400).json({ success: false, message: 'Параметр "code" обязателен.' })
    return
  }

  try {
    await exchangeAuthCode(code)
    res.status(200).json({ success: true, message: 'Токены amoCRM успешно получены и сохранены.' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка при обмене кода авторизации'
    console.error('[amoCRM Auth]', message)
    res.status(500).json({ success: false, message })
  }
})

// ── Start ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Lead API] Server listening on http://localhost:${PORT}`)
})
