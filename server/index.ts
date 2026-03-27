/**
 * Lightweight Express-compatible API server for lead capture.
 *
 * Run:
 *   npx tsx server/index.ts
 *
 * Or compile with `tsc` and then:
 *   node dist-server/index.js
 *
 * The server exposes a single POST endpoint: /api/lead
 */

import http from 'node:http'
import { handleLead, type LeadResponse } from './lead.js'

const PORT = parseInt(process.env.PORT ?? '3001', 10)
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN ?? '*'

function setCorsHeaders(res: http.ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

function sendJson(res: http.ServerResponse, status: number, data: LeadResponse): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    const MAX_BODY = 1_048_576 // 1 MB

    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY) {
        req.destroy()
        reject(new Error('Payload too large'))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res)

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.url === '/api/lead' && req.method === 'POST') {
    try {
      const raw = await readBody(req)
      const body: unknown = JSON.parse(raw)
      const result = await handleLead(body)
      sendJson(res, 200, result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Внутренняя ошибка сервера'
      sendJson(res, 400, { success: false, message })
    }
    return
  }

  // Fallback – 404
  sendJson(res, 404, { success: false, message: 'Не найдено' })
})

server.listen(PORT, () => {
  console.log(`[Lead API] Server listening on http://localhost:${PORT}`)
})
