import { Telegraf } from "telegraf";
import "dotenv/config";
import { calculateTurnkeyPrice, type CalcParams } from "./calculator.js";

// ── Environment validation ───────────────────────────────
const token = process.env.AI_BOT_TOKEN;
if (!token) {
  console.error("❌ AI_BOT_TOKEN is not set in environment variables.");
  process.exit(1);
}

const openrouterKey = process.env.OPENROUTER_KEY;
if (!openrouterKey) {
  console.error("❌ OPENROUTER_KEY is not set in environment variables.");
  process.exit(1);
}

const MODEL = process.env.OPENROUTER_MODEL ?? "anthropic/claude-sonnet-4";
const TEMPERATURE = 0.7;
const MAX_TOKENS = 1024;

// ── Tool definitions for function calling ────────────────
const tools = [{
  type: "function" as const,
  function: {
    name: "calculate_vehicle_price",
    description: "Рассчитать стоимость авто из Японии. Возвращает цены в рублях.",
    parameters: {
      type: "object",
      properties: {
        vehicleType: { type: "string", enum: ["car", "jeep", "moto", "special", "sanctioned"] },
        priceJPY: { type: "number" },
        volumeCm3: { type: "number" },
        ageYears: { type: "number" },
        isForResale: { type: "boolean" },
        isLegalEntity: { type: "boolean" }
      },
      required: ["vehicleType", "priceJPY", "volumeCm3", "ageYears", "isForResale", "isLegalEntity"]
    }
  }
}];

const SYSTEM_PROMPT = `
Ты — Алексей, старший менеджер компании «СпецТехМаш» (Находка). Консультируй по импорту авто, веди к договору.
Наши козыри: своя ТЛК «Тихоокеанская Звезда» и возврат НДС до 22% для юрлиц.
Если авто санкционное (>1.9л) или спецтехника: не считай цену, скажи, что логистика сложная, собери параметры и передай оператору.
Если просят расчет обычной машины: собери тип, цену в йенах, объем, возраст, для кого авто, и вызови calculate_vehicle_price. Ответ красиво распиши.
Лимит скидки 20к руб только для закрытия сделки.
`;

// ── Per-user conversation history ────────────────────────
interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface ConversationEntry {
  messages: ChatMessage[];
  lastActivity: number;
}

const conversations = new Map<number, ConversationEntry>();
const MAX_HISTORY_LENGTH = 30;
const CONVERSATION_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Evict stale conversations periodically */
setInterval(() => {
  const now = Date.now();
  for (const [userId, entry] of conversations) {
    if (now - entry.lastActivity > CONVERSATION_TTL_MS) {
      conversations.delete(userId);
    }
  }
}, 10 * 60 * 1000); // every 10 minutes

function getOrCreateConversation(userId: number): ChatMessage[] {
  let entry = conversations.get(userId);
  if (!entry) {
    entry = { messages: [], lastActivity: Date.now() };
    conversations.set(userId, entry);
  }
  entry.lastActivity = Date.now();
  return entry.messages;
}

function trimHistory(messages: ChatMessage[]): void {
  while (messages.length > MAX_HISTORY_LENGTH) {
    messages.shift();
  }
}

// ── OpenRouter API helper ────────────────────────────────
interface OpenRouterResponse {
  choices: Array<{
    message: {
      role: string;
      content?: string;
      tool_calls?: ToolCall[];
    };
  }>;
}

async function chatCompletion(
  messages: ChatMessage[],
  useTools: boolean,
): Promise<OpenRouterResponse> {
  const body: Record<string, unknown> = {
    model: MODEL,
    messages,
    temperature: TEMPERATURE,
    max_tokens: MAX_TOKENS,
  };
  if (useTools) {
    body.tools = tools;
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openrouterKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(
      `❌ OpenRouter API error ${res.status} ${res.statusText}:`,
      errorBody,
    );
    throw new Error(`OpenRouter API error: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as OpenRouterResponse;
}

/** Call the OpenRouter API with conversation history and tool calling */
async function getAIResponse(
  userId: number,
  userMessage: string,
): Promise<string> {
  const history = getOrCreateConversation(userId);

  history.push({ role: "user", content: userMessage });
  trimHistory(history);

  const completion = await chatCompletion(
    [{ role: "system", content: SYSTEM_PROMPT }, ...history],
    true,
  );

  if (!completion.choices || !completion.choices[0]) {
    console.error("❌ OpenRouter returned no choices:", JSON.stringify(completion));
    return "Извините, не удалось получить ответ от AI. Попробуйте ещё раз.";
  }

  const message = completion.choices[0].message;

  // ── Handle tool calls ────────────────────────────────────
  if (message?.tool_calls && message.tool_calls.length > 0) {
    // Push the assistant message with tool_calls into history
    history.push(message as ChatMessage);

    for (const toolCall of message.tool_calls) {
      if (
        toolCall.type === "function" &&
        toolCall.function.name === "calculate_vehicle_price"
      ) {
        try {
          const args = JSON.parse(toolCall.function.arguments) as CalcParams;
          const result = await calculateTurnkeyPrice(args);

          history.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        } catch (err) {
          console.error("❌ Tool call error:", err);
          history.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              success: false,
              message: "Ошибка при расчёте. Попробуйте уточнить параметры.",
            }),
          });
        }
      }
    }

    trimHistory(history);

    // Second call: let the model generate a human-readable response
    const followUp = await chatCompletion(
      [{ role: "system", content: SYSTEM_PROMPT }, ...history],
      false,
    );

    const followUpContent = followUp.choices?.[0]?.message?.content;
    if (!followUpContent) {
      console.warn(`⚠️ Empty follow-up response for user ${userId}`);
    }
    const reply =
      followUpContent ??
      "Извините, не удалось получить ответ от AI. Попробуйте ещё раз.";
    history.push({ role: "assistant", content: reply });
    return reply;
  }

  // ── Regular (no tool call) response ──────────────────────
  const reply = message?.content ?? "";
  if (!reply) {
    console.warn(`⚠️ Empty response for user ${userId}`);
  }
  history.push({ role: "assistant", content: reply });

  return reply;
}

// ── Bot setup ────────────────────────────────────────────
const bot = new Telegraf(token);

// /start command — Alexey greets the user
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  // Reset conversation on /start
  conversations.delete(userId);

  const greeting =
    "Привет! Меня зовут Алексей, я старший менеджер компании СпецТехМаш. " +
    "Мы занимаемся импортом автомобилей, мотоциклов и спецтехники из Японии, " +
    "Кореи и Китая. У нас своя транспортно-логистическая компания, так что " +
    "контролируем весь путь от аукциона до вашего города.\n\n" +
    "Расскажите, что вас интересует? Легковой автомобиль, мотоцикл " +
    "или спецтехника?";

  await ctx.reply(greeting);
});

// /help command
bot.help(async (ctx) => {
  await ctx.reply(
    "Просто напишите ваш вопрос — я проконсультирую по импорту авто, " +
      "мото или спецтехники из Азии.\n\n" +
      "/start — начать диалог заново\n" +
      "/help — показать эту справку",
  );
});

// Text message handler — AI-powered conversation
bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const userText = ctx.message.text;

  try {
    await ctx.sendChatAction("typing");
    const reply = await getAIResponse(userId, userText);
    await ctx.reply(reply || "Извините, попробуйте переформулировать вопрос.");
  } catch (err) {
    console.error(`❌ AI error for user ${userId}:`, err);
    await ctx.reply(
      "Произошла техническая ошибка. Попробуйте ещё раз через минуту, " +
        "или позвоните нам напрямую.",
    );
  }
});

// Global error handler — log and continue
bot.catch((err, ctx) => {
  console.error(
    `❌ Ошибка при обработке апдейта ${ctx.update.update_id}:`,
    err,
  );
});

// Launch the bot
bot.launch().then(() => {
  console.log("🤖 AI-бот Алексей запущен и слушает сообщения...");
});

// Graceful shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
