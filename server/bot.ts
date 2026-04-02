import { Telegraf } from "telegraf";
import "dotenv/config";
import { calculateTurnkeyPrice, type CalcParams } from "./calculator";

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
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

async function chatCompletion(userMessage: string): Promise<string> {
  const model = process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat";
  const apiKey = process.env.OPENROUTER_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_KEY is missing");
  }

  const SYSTEM_PROMPT = `
Ты — Алексей, старший менеджер компании «СпецТехМаш» из Находки. Работаешь на авторынке Дальнего Востока больше 10 лет. Занимаешься импортом авто, мото и спецтехники из Японии, Кореи и Китая.

Как ты разговариваешь:
- Говоришь живым разговорным русским, как реальный мужик с авторынка — коротко, по делу, уверенно.
- Если клиент использует жаргон (распил, конструктор, пробег по Японии, аук, лот и т.д.) — отвечай в том же стиле.
- Если клиент общается нейтрально — тоже отвечай нейтрально, но без канцелярита и офисных штампов.
- Никогда не пиши как робот техподдержки: без «Благодарим за обращение», «С уважением», «Мы рады помочь».
- Не пересказывай формально то, что клиент только что написал.
- Не объясняй очевидные вещи про японский рынок, если клиент явно в теме.

Правила ответов:
- Будь кратким. 2–5 предложений — норма. Длинные простыни — нет.
- Задавай только минимум нужных уточняющих вопросов. Если клиент уже дал фильтры — двигайся дальше, а не переспрашивай.
- Не выдумывай цены, сроки, наличие, характеристики. Если не знаешь — так и скажи.
- Не дави, не манипулируй, не создавай искусственную срочность. Ты честный продавец, а не барыга.
- Не хами и не грубей — ты опытный, спокойный, уверенный в себе профессионал.

О компании:
- У нас своя ТЛК «Тихоокеанская Звезда» — контролируем логистику от аукциона до города клиента.
- Юрлицам возвращаем НДС до 22%.
- Работаем с Японией, Кореей и Китаем.

Отвечай только на русском языке.
`.trim();

  const body = {
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage }
    ],
    temperature: 0.7,
    max_tokens: 300
  };

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3001",
      "X-OpenRouter-Title": "SpecTechMash Telegram Bot"
    },
    body: JSON.stringify(body)
  });

  const rawText = await response.text();

  if (!response.ok) {
    console.error(`❌ OpenRouter API error ${response.status} ${response.statusText}: ${rawText}`);
    throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
  }

  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch (e) {
    console.error("❌ Failed to parse OpenRouter response:", rawText);
    throw new Error("OpenRouter returned invalid JSON");
  }

  const content = data?.choices?.[0]?.message?.content;

  if (!content || typeof content !== "string") {
    console.error("❌ Unexpected OpenRouter response shape:", data);
    throw new Error("OpenRouter returned empty response");
  }

  return content.trim();
}

async function getAIResponse(userMessage: string): Promise<string> {
  try {
    return await chatCompletion(userMessage);
  } catch (error) {
    console.error("❌ AI error:", error);
    return "Извините, произошла техническая ошибка. Попробуйте ещё раз чуть позже.";
  }
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
    const reply = await getAIResponse(userText);
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
