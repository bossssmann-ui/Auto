const API_URL = import.meta.env.VITE_API_URL ?? ''

export interface LeadData {
  name: string
  phone: string
  vehicleType?: string
  year?: string
  engineType?: string
  engineVolume?: string
  auctionPrice?: string
  currency?: string
  ownerType?: string
  city?: string
  source?: string
}

export interface LeadResponse {
  success: boolean
  message: string
}

export async function submitLead(data: LeadData): Promise<LeadResponse> {
  if (!API_URL) {
    // No backend configured – log to console and return success for development
    console.info('[submitLead] No VITE_API_URL configured. Payload:', data)
    return { success: true, message: 'Заявка принята (dev mode).' }
  }

  const res = await fetch(`${API_URL}/api/lead`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  const json = (await res.json()) as LeadResponse
  return json
}
