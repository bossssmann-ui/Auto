/**
 * amoCRM OAuth 2.0 Token Manager.
 *
 * Handles automatic token refresh for the amoCRM REST API.
 * Tokens are persisted to `amocrm_tokens.json` on disk since
 * the project does not use a database.
 *
 * Environment variables required (see .env.example):
 *   AMOCRM_DOMAIN        – amoCRM account subdomain (e.g. mycompany.amocrm.ru)
 *   AMOCRM_CLIENT_ID     – OAuth integration client_id
 *   AMOCRM_CLIENT_SECRET – OAuth integration client_secret
 *   AMOCRM_REDIRECT_URI  – Redirect URI registered in amoCRM integration settings
 */

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/* ─── Types ────────────────────────────────────────────── */

interface AmoCRMTokens {
  access_token: string
  refresh_token: string
  expires_at: number // Unix timestamp in milliseconds
}

interface AmoCRMOAuthResponse {
  token_type: string
  expires_in: number
  access_token: string
  refresh_token: string
}

/* ─── Constants ────────────────────────────────────────── */

/** Path to the token storage file (project root). */
const __dirname = dirname(fileURLToPath(import.meta.url))
const TOKENS_PATH = join(__dirname, '..', 'amocrm_tokens.json')

/** Refresh the token 5 minutes before it actually expires. */
const EXPIRY_BUFFER_MS = 5 * 60 * 1000

/* ─── Token Persistence ───────────────────────────────── */

async function readTokens(): Promise<AmoCRMTokens | null> {
  try {
    const raw = await readFile(TOKENS_PATH, 'utf-8')
    return JSON.parse(raw) as AmoCRMTokens
  } catch {
    return null
  }
}

async function writeTokens(tokens: AmoCRMTokens): Promise<void> {
  await writeFile(TOKENS_PATH, JSON.stringify(tokens, null, 2), 'utf-8')
}

/* ─── OAuth Helpers ────────────────────────────────────── */

function getOAuthCredentials() {
  const domain = process.env.AMOCRM_DOMAIN
  const clientId = process.env.AMOCRM_CLIENT_ID
  const clientSecret = process.env.AMOCRM_CLIENT_SECRET
  const redirectUri = process.env.AMOCRM_REDIRECT_URI

  if (!domain || !clientId || !clientSecret || !redirectUri) {
    throw new Error(
      '[amoCRM] Missing OAuth env vars. Set AMOCRM_DOMAIN, AMOCRM_CLIENT_ID, AMOCRM_CLIENT_SECRET, AMOCRM_REDIRECT_URI.',
    )
  }

  return { domain, clientId, clientSecret, redirectUri }
}

async function requestTokens(body: Record<string, string>): Promise<AmoCRMTokens> {
  const { domain } = getOAuthCredentials()
  const url = `https://${domain}/oauth2/access_token`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`[amoCRM] Token request failed (${res.status}): ${errText}`)
  }

  const data = (await res.json()) as AmoCRMOAuthResponse

  const tokens: AmoCRMTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  }

  await writeTokens(tokens)
  console.log('[amoCRM] Tokens saved to amocrm_tokens.json')
  return tokens
}

/* ─── Public API ───────────────────────────────────────── */

/**
 * Exchange an authorization code (obtained from amoCRM UI) for the
 * initial access + refresh token pair and persist them to disk.
 */
export async function exchangeAuthCode(authorizationCode: string): Promise<AmoCRMTokens> {
  const { clientId, clientSecret, redirectUri } = getOAuthCredentials()

  return requestTokens({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code: authorizationCode,
    redirect_uri: redirectUri,
  })
}

/**
 * Refresh the token pair using the stored refresh_token.
 */
export async function refreshAccessToken(): Promise<AmoCRMTokens> {
  const stored = await readTokens()

  if (!stored?.refresh_token) {
    throw new Error(
      '[amoCRM] No refresh_token found. Run the initial authorization first (GET /api/amocrm/auth?code=...).',
    )
  }

  const { clientId, clientSecret, redirectUri } = getOAuthCredentials()

  return requestTokens({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: stored.refresh_token,
    redirect_uri: redirectUri,
  })
}

/**
 * Return a valid amoCRM access token.
 *
 * Reads tokens from disk; if the token is expired (or about to expire),
 * automatically refreshes it and persists the new pair.
 */
export async function getValidAmoToken(): Promise<string> {
  const tokens = await readTokens()

  if (!tokens) {
    throw new Error(
      '[amoCRM] No tokens file found. Run the initial authorization first (GET /api/amocrm/auth?code=...).',
    )
  }

  // Token is still fresh — return it
  if (Date.now() < tokens.expires_at - EXPIRY_BUFFER_MS) {
    return tokens.access_token
  }

  // Token expired or about to expire — refresh
  console.log('[amoCRM] Access token expired or about to expire, refreshing…')
  const refreshed = await refreshAccessToken()
  return refreshed.access_token
}
