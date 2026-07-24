/**
 * POST /api/lead — site-wide lead capture endpoint.
 *
 * Delivery channel: Telegram Bot API (`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`).
 * Both variables are server-side only and are never echoed to logs or the
 * client. Without them (local dev, preview builds) the endpoint validates,
 * logs a redacted summary and reports success so the UX flow can be tested
 * end-to-end without secrets.
 *
 * amoCRM delivery intentionally lives in the legacy Express server until the
 * unified lead-flow task (P1-01) decides its final home.
 */

import { NextResponse } from "next/server";
import {
  leadInputSchema,
  type LeadInput,
  type LeadResponse,
} from "@/lib/lead-schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SOURCE_LABELS: Record<LeadInput["source"], string> = {
  contacts: "Страница контактов",
  calculator: "Калькулятор",
  lot: "Карточка лота",
  catalog: "Каталог",
};

/** Plain-text message (no parse_mode) so user input can't break formatting. */
function formatMessage(lead: LeadInput): string {
  const lines = [
    "Новая заявка с сайта",
    "",
    `Имя: ${lead.name}`,
    `Телефон: ${lead.phone}`,
    `Источник: ${SOURCE_LABELS[lead.source]}`,
  ];
  if (lead.interest) lines.push(`Интерес: ${lead.interest}`);
  if (lead.comment) lines.push(`Комментарий: ${lead.comment}`);
  if (lead.pageUrl) lines.push(`Страница: ${lead.pageUrl}`);
  if (lead.meta) {
    for (const [key, value] of Object.entries(lead.meta)) {
      lines.push(`${key}: ${value}`);
    }
  }
  return lines.join("\n");
}

async function deliverToTelegram(lead: LeadInput): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn(
      "[lead] TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not configured — lead accepted but not delivered",
    );
    return true;
  }

  const res = await fetch(
    `https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: formatMessage(lead) }),
      signal: AbortSignal.timeout(8_000),
    },
  );

  const json = (await res.json()) as { ok: boolean; description?: string };
  if (!json.ok) {
    console.error("[lead] Telegram sendMessage failed:", json.description);
  }
  return json.ok;
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<LeadResponse>(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  const parsed = leadInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json<LeadResponse>(
      { ok: false, error: "validation", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const lead = parsed.data;

  // Honeypot tripped — pretend success so the bot learns nothing.
  if (lead.website && lead.website.trim().length > 0) {
    return NextResponse.json<LeadResponse>({ ok: true }, { status: 200 });
  }

  let delivered = false;
  try {
    delivered = await deliverToTelegram(lead);
  } catch (err) {
    console.error(
      "[lead] Telegram delivery error:",
      err instanceof Error ? err.message : err,
    );
  }

  if (!delivered) {
    // Surface the failure so the visitor retries or uses the Telegram CTA —
    // silently dropping a lead is worse than an honest error state.
    return NextResponse.json<LeadResponse>(
      { ok: false, error: "delivery_failed" },
      { status: 502 },
    );
  }

  console.log(
    `[lead] accepted: source=${lead.source} name-length=${lead.name.length}`,
  );
  return NextResponse.json<LeadResponse>({ ok: true }, { status: 200 });
}
