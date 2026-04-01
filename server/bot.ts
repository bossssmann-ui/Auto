const TELEGRAM_TOKEN = "";
const OPENROUTER_KEY = "";
const SYSTEM_PROMPT = "";

import { Telegraf } from "telegraf";

// ── OpenRouter response types ────────────────────────────
interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

// ── Per-user conversation history (last 10 messages) ─────
const conversations = new Map<number, ChatMessage[]>();
const MAX_HISTORY = 10;

function getHistory(userId: number): ChatMessage[] {
  let history = conversations.get(userId);
  if (!history) {
    history = [];
    conversations.set(userId, history);
  }
  return history;
}

function trimHistory(messages: ChatMessage[]): void {
  while (messages.length > MAX_HISTORY) {
    messages.shift();
  }
}

// ── Call OpenRouter API via native fetch ──────────────────
async function getAIResponse(
  userId: number,
  userMessage: string,
): Promise<string> {
  const history = getHistory(userId);

  history.push({ role: "user", content: userMessage });
  trimHistory(history);

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + OPENROUTER_KEY,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://spectehmash.ru",
    },
    body: JSON.stringify({
      model: "anthropic/claude-3.5-sonnet",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...history,
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as OpenRouterResponse;

  if (data.error) {
    throw new Error(`OpenRouter error: ${data.error.message ?? "unknown"}`);
  }

  const reply = data.choices?.[0]?.message?.content ?? "";

  if (reply) {
    history.push({ role: "assistant", content: reply });
  }

  return reply;
}

// ── Bot setup ────────────────────────────────────────────
const bot = new Telegraf(TELEGRAM_TOKEN);

// /start command — clear history and greet in Russian
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  conversations.delete(userId);

  await ctx.reply(
    "Привет! Меня зовут Алексей, я старший менеджер компании СпецТехМаш. " +
      "Мы занимаемся импортом автомобилей, мотоциклов и спецтехники из Японии, " +
      "Кореи и Китая. У нас своя транспортно-логистическая компания, так что " +
      "контролируем весь путь от аукциона до вашего города.\n\n" +
      "Расскажите, что вас интересует? Легковой автомобиль, мотоцикл " +
      "или спецтехника?",
  );
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
    console.error(`❌ OpenRouter error for user ${userId}:`, err);
    await ctx.reply(
      "Извините, у меня технические неполадки. Попробуйте через минуту.",
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
