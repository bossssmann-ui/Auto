/**
 * Backend API route for lead capture.
 *
 * Handles form submissions from the calculator and lead-magnet components.
 * On each submission the handler:
 *   1. Validates the incoming JSON payload.
 *   2. Sends a formatted message to the owner's Telegram chat via the Bot API.
 *   3. Creates a new Contact + Lead in amoCRM via their REST API.
 *
 * Environment variables required (see .env.example):
 *   TELEGRAM_BOT_TOKEN – Telegram Bot HTTP API token
 *   TELEGRAM_CHAT_ID   – Target chat / group ID for notifications
 *   AMOCRM_DOMAIN      – amoCRM account domain (e.g. mycompany.amocrm.ru)
 *   AMOCRM_ACCESS_TOKEN – Long-lived amoCRM API token
 *   AMOCRM_PIPELINE_ID  – (optional) Sales pipeline ID
 *
 * This module exports a framework-agnostic `handleLead` function so it can be
 * used from Express, Fastify, Vercel serverless, or any other Node.js runtime.
 */

/* ─── Types ────────────────────────────────────────────── */

export interface LeadPayload {
  name: string
  phone: string
  vehicleType?: string
  year?: string
  engineType?: string
  engineVolume?: string
  auctionPrice?: string
  currency?: string
  ownerType?: string
  source?: string
}

interface TelegramResponse {
  ok: boolean
  description?: string
}

/* ─── Validation ───────────────────────────────────────── */

export function validatePayload(body: unknown): LeadPayload {
  if (!body || typeof body !== 'object') {
    throw new Error('Некорректный формат данных')
  }

  const data = body as Record<string, unknown>

  const name = typeof data.name === 'string' ? data.name.trim() : ''
  const phone = typeof data.phone === 'string' ? data.phone.trim() : ''

  if (!name) throw new Error('Укажите ваше имя')
  if (!phone) throw new Error('Укажите номер телефона')

  return {
    name,
    phone,
    vehicleType: typeof data.vehicleType === 'string' ? data.vehicleType : undefined,
    year: typeof data.year === 'string' ? data.year : undefined,
    engineType: typeof data.engineType === 'string' ? data.engineType : undefined,
    engineVolume: typeof data.engineVolume === 'string' ? data.engineVolume : undefined,
    auctionPrice: typeof data.auctionPrice === 'string' ? data.auctionPrice : undefined,
    currency: typeof data.currency === 'string' ? data.currency : undefined,
    ownerType: typeof data.ownerType === 'string' ? data.ownerType : undefined,
    source: typeof data.source === 'string' ? data.source : undefined,
  }
}

/* ─── Telegram ─────────────────────────────────────────── */

function formatTelegramMessage(lead: LeadPayload): string {
  const vehicleLabels: Record<string, string> = {
    car: '🚗 Автомобиль',
    special: '🏗️ Спецтехника',
    moto: '🏍️ Мототехника',
  }

  const lines = [
    '🔔 *Новая заявка с сайта*',
    '',
    `👤 *Имя:* ${lead.name}`,
    `📞 *Телефон:* ${lead.phone}`,
  ]

  if (lead.vehicleType) {
    lines.push(`🚘 *Тип:* ${vehicleLabels[lead.vehicleType] ?? lead.vehicleType}`)
  }
  if (lead.year) lines.push(`📅 *Год выпуска:* ${lead.year}`)
  if (lead.engineType) lines.push(`⚙️ *Двигатель:* ${lead.engineType}`)
  if (lead.engineVolume) lines.push(`📏 *Объём/мощность:* ${lead.engineVolume}`)
  if (lead.auctionPrice && lead.currency) {
    lines.push(`💰 *Цена на аукционе:* ${lead.auctionPrice} ${lead.currency}`)
  }
  if (lead.ownerType) {
    lines.push(`🏢 *Покупатель:* ${lead.ownerType === 'entity' ? 'Юрлицо' : 'Физлицо'}`)
  }
  if (lead.source) lines.push(`📍 *Источник:* ${lead.source}`)

  return lines.join('\n')
}

export async function sendTelegramNotification(lead: LeadPayload): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId) {
    console.warn('[Telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured – skipping')
    return
  }

  const text = formatTelegramMessage(lead)
  const url = `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
    }),
  })

  const json = (await res.json()) as TelegramResponse

  if (!json.ok) {
    console.error('[Telegram] Failed to send message:', json.description)
  }
}

/* ─── amoCRM ───────────────────────────────────────────── */

import { getValidAmoToken, refreshAccessToken } from './amocrm.js'

/**
 * Push a lead to amoCRM (create Contact + Lead).
 *
 * Uses OAuth 2.0 tokens managed by `amocrm.ts`.
 * If the API returns 401 Unauthorized, the token is refreshed once and
 * the entire request is retried.
 */
export async function pushToAmoCRM(lead: LeadPayload): Promise<void> {
  const domain = process.env.AMOCRM_DOMAIN

  if (!domain) {
    console.warn('[amoCRM] AMOCRM_DOMAIN not configured – skipping')
    return
  }

  let accessToken: string
  try {
    accessToken = await getValidAmoToken()
  } catch (err) {
    console.warn('[amoCRM]', err instanceof Error ? err.message : err)
    return
  }

  try {
    await pushToAmoCRMWithToken(lead, domain, accessToken)
  } catch (err) {
    // If we got a 401, refresh once and retry
    if (err instanceof AmoCRMUnauthorizedError) {
      console.log('[amoCRM] Got 401, refreshing token and retrying…')
      try {
        const refreshed = await refreshAccessToken()
        await pushToAmoCRMWithToken(lead, domain, refreshed.access_token)
      } catch (retryErr) {
        console.error('[amoCRM] Retry after token refresh failed:', retryErr)
        throw retryErr
      }
    } else {
      throw err
    }
  }
}

class AmoCRMUnauthorizedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AmoCRMUnauthorizedError'
  }
}

async function pushToAmoCRMWithToken(
  lead: LeadPayload,
  domain: string,
  accessToken: string,
): Promise<void> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }

  const baseUrl = `https://${domain}`

  // 1. Create Contact
  const contactPayload = [
    {
      name: lead.name,
      custom_fields_values: [
        {
          field_code: 'PHONE',
          values: [{ value: lead.phone, enum_code: 'MOB' }],
        },
      ],
    },
  ]

  const contactRes = await fetch(`${baseUrl}/api/v4/contacts`, {
    method: 'POST',
    headers,
    body: JSON.stringify(contactPayload),
  })

  if (contactRes.status === 401) {
    throw new AmoCRMUnauthorizedError('Unauthorized when creating contact')
  }

  if (!contactRes.ok) {
    const errText = await contactRes.text()
    console.error('[amoCRM] Failed to create contact:', errText)
    return
  }

  const contactData = (await contactRes.json()) as {
    _embedded: { contacts: { id: number }[] }
  }
  const contactId = contactData._embedded.contacts[0]?.id

  // 2. Create Lead linked to Contact
  const vehicleLabels: Record<string, string> = {
    car: 'Автомобиль',
    special: 'Спецтехника',
    moto: 'Мототехника',
  }

  const leadName = lead.vehicleType
    ? `${vehicleLabels[lead.vehicleType] ?? lead.vehicleType} — ${lead.name}`
    : `Заявка — ${lead.name}`

  const leadPayload: Record<string, unknown>[] = [
    {
      name: leadName,
      ...(process.env.AMOCRM_PIPELINE_ID
        ? { pipeline_id: Number(process.env.AMOCRM_PIPELINE_ID) }
        : {}),
      _embedded: {
        contacts: [{ id: contactId }],
      },
      custom_fields_values: [
        ...(lead.vehicleType
          ? [{ field_code: 'VEHICLE_TYPE', values: [{ value: lead.vehicleType }] }]
          : []),
        ...(lead.year
          ? [{ field_code: 'YEAR', values: [{ value: lead.year }] }]
          : []),
        ...(lead.auctionPrice
          ? [{ field_code: 'PRICE', values: [{ value: `${lead.auctionPrice} ${lead.currency ?? ''}` }] }]
          : []),
      ],
    },
  ]

  const leadRes = await fetch(`${baseUrl}/api/v4/leads`, {
    method: 'POST',
    headers,
    body: JSON.stringify(leadPayload),
  })

  if (leadRes.status === 401) {
    throw new AmoCRMUnauthorizedError('Unauthorized when creating lead')
  }

  if (!leadRes.ok) {
    const errText = await leadRes.text()
    console.error('[amoCRM] Failed to create lead:', errText)
  }
}

/* ─── Main handler (framework-agnostic) ───────────────── */

export interface LeadResponse {
  success: boolean
  message: string
}

export async function handleLead(body: unknown): Promise<LeadResponse> {
  const lead = validatePayload(body)

  // Fire both integrations in parallel – neither should block the response
  const results = await Promise.allSettled([
    sendTelegramNotification(lead),
    pushToAmoCRM(lead),
  ])

  for (const r of results) {
    if (r.status === 'rejected') {
      console.error('[Lead handler] integration error:', r.reason)
    }
  }

  return { success: true, message: 'Заявка принята. Мы свяжемся с вами в ближайшее время.' }
}
