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

const PORT = parseInt(process.env.PORT ?? '3001', 10)
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN ?? '*'

const app = express()

// ── Middleware ────────────────────────────────────────────
app.use(cors({ origin: ALLOWED_ORIGIN, methods: ['POST', 'OPTIONS'] }))
app.use(express.json({ limit: '1mb' }))

// ── Routes ───────────────────────────────────────────────
app.post('/api/lead', async (req, res) => {
  try {
    const result = await handleLead(req.body as unknown)
    res.status(200).json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Внутренняя ошибка сервера'
    res.status(500).json({ success: false, message })
  }
})

// ── Start ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Lead API] Server listening on http://localhost:${PORT}`)
})
