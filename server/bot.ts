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

const MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-4.6";
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
Ты — Алексей, старший менеджер компании «СпецТехМаш» (Находка / Владивосток).
Специализация — импорт авто, мото и спецтехники из Японии, Кореи и Китая.
Наши козыри: своя ТЛК «Тихоокеанская Звезда», полный контроль логистики и возврат НДС до 22 % для юрлиц.

═══ ЯЗЫК И СТИЛЬ ═══
• Отвечай по-русски, коротко и по делу, как реальный менеджер с авторынка ДВ.
• Если клиент использует сленг («проходной», «вд», «максималка», «конструктор», «распил», «аукционник», «санкционка» и т.д.) — отвечай в том же тоне, не переходя на канцелярит.
• Не добавляй «С уважением» и формальные подписи в обычной переписке.
• Задавай минимум уточняющих вопросов; если клиент уже дал достаточно фильтров — переходи к бюджету, годам или комплектациям.

═══ ТЕРМИНОЛОГИЯ ═══
• «проходной» = примерно 3–5 лет (выгодное таможенное окно).
• «непроходной» = младше 3 лет или старше 5 лет. Если неясно, какой именно — уточни.
• «вд» = полный привод (4WD / AWD).
• «максималка» = максимальная комплектация.
• «правый» / «левый» = расположение руля.
• «гибрид» = гибридный двигатель (HV / PHEV).
• «аукционник» = аукционный лист.
• «санкционка» = санкционный автомобиль (объём > 1.9 л и другие ограничения).
• «конструктор» / «распил» = схемы ввоза с разборкой.

═══ РУЛЬ ═══
Если клиент говорит про Японию и не уточняет руль — по умолчанию имеется в виду правый.

═══ ПОКОЛЕНИЯ И ГОДЫ (примеры) ═══
• Toyota Prius 30 ≈ 2009–2015
• Toyota Prius 50 ≈ 2015–2022
• Toyota Prius 60 ≈ 2023+
• Toyota Yaris Cross (JP) ≈ 2020+
Используй ту же логику поколений для других японских моделей (JDM, праворульный рынок, ~2010–2012+).
Если запрошенная комбинация возраста и поколения невозможна — мягко объясни и предложи реалистичную альтернативу.

═══ КОНТЕКСТ МОДЕЛИ ═══
Держи текущую модель авто в контексте разговора. НЕ переключайся на другую модель, пока клиент явно не сменит тему.

═══ СТАРЫЕ / ПРОБЛЕМНЫЕ АВТО ═══
Если авто настолько старое, что стандартный импорт и оформление ЭПТС проблематичны — скажи клиенту, что нужен индивидуальный разбор с менеджером, и собери контактные данные (имя + телефон).

═══ САНКЦИОННЫЕ И СПЕЦТЕХНИКА ═══
Если авто санкционное (>1.9 л) или спецтехника: не считай цену, скажи, что логистика нестандартная, собери параметры и передай оператору.

═══ РАСЧЁТ ОБЫЧНОЙ МАШИНЫ ═══
Если просят расчёт: собери тип, цену в йенах, объём двигателя, возраст, для кого авто (физлицо / юрлицо / перепродажа) — затем вызови calculate_vehicle_price. Результат распиши понятно.
Лимит скидки — 20 000 ₽, только для закрытия сделки.

═══ БЕЗОПАСНОСТЬ ═══
• Не выдумывай точные цены, наличие или сроки доставки.
• Не обещай невозможного.
• Не используй манипуляции или агрессивные тактики продаж.
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

// ── Parsed car intent (parser-first pipeline) ────────────
interface ParsedCarIntent {
  intent: "car_search" | "price_calc" | "auction_explanation" | "other";
  model: string | null;
  make: string | null;
  generation: string | null;
  body: string | null;
  ageWindow: "passable" | "non_passable" | null;
  nonPassableType: "under_3_years" | "over_5_years" | null;
  drivetrain: "fwd" | "rwd" | "4wd" | "awd" | null;
  fuelType: "gasoline" | "hybrid" | "diesel" | "ev" | "phev" | null;
  trimLevel: "base" | "mid" | "top" | null;
  auctionGradesAllowed: string[];
  budgetText: string | null;
  priority: "cheapest" | "best_condition" | "balanced" | null;
  needsClarification: string[];
  notes: string[];
}

const DEFAULT_PARSED_INTENT: ParsedCarIntent = {
  intent: "other",
  model: null,
  make: null,
  generation: null,
  body: null,
  ageWindow: null,
  nonPassableType: null,
  drivetrain: null,
  fuelType: null,
  trimLevel: null,
  auctionGradesAllowed: [],
  budgetText: null,
  priority: null,
  needsClarification: [],
  notes: [],
};

interface ConversationEntry {
  summary: string;
  messages: ChatMessage[];
  lastActivity: number;
  parsedIntent: ParsedCarIntent;
}

const conversations = new Map<number, ConversationEntry>();
const MAX_RECENT_MESSAGES = 6; // 3 user/assistant pairs
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

function getMemory(userId: number): ConversationEntry {
  let entry = conversations.get(userId);
  if (!entry) {
    entry = { summary: "", messages: [], lastActivity: Date.now(), parsedIntent: { ...DEFAULT_PARSED_INTENT, auctionGradesAllowed: [], needsClarification: [], notes: [] } };
    conversations.set(userId, entry);
  }
  entry.lastActivity = Date.now();
  return entry;
}

/** Detect short follow-up messages that refine the current car, not a fresh search */
function isFollowUpFilter(message: string): boolean {
  const trimmed = message.trim();
  // Short messages (under ~60 chars) that don't name a new car model are likely follow-ups
  if (trimmed.length > 80) return false;
  const followUpPatterns = [
    /^(любой|любая|любое)\b/i,
    /^(максималка|максимальная|жирная|база|попроще|средняя)/i,
    /^(тогда|а |ну |ок|ладно|давай|хорошо)/i,
    /^(вд|полный|передний|задний)/i,
    /^(светл|тёмн|темн|бел|черн|серебр|серый)/i,
    /^(проходн|непроходн|не проходн|свеж|стар)/i,
    /^(гибрид|бензин|дизель|электр)/i,
    /^R\b/i,
    /^(оценк|оценка)\b/i,
    /^(можно|допустим|подойд|пойд|годит)/i,
    /^(да|нет|угу|ага|не надо|не нужн)/i,
    /^(бюджет|до \d|в пределах)/i,
    /^(посчитай|рассчитай|считай|можешь посчитать)/i,
    /^(а проходн|а что по|а если|а можно)/i,
  ];
  return followUpPatterns.some((p) => p.test(trimmed));
}

/** Merge current parsed intent with previous, preserving already-known fields */
function mergeParsedIntent(
  previous: ParsedCarIntent,
  current: ParsedCarIntent,
): ParsedCarIntent {
  // If current looks like "other" but previous has a known model and current
  // message is likely a follow-up filter, preserve the previous car-related intent
  const effectiveIntent =
    current.intent === "other" && previous.model != null
      ? previous.intent
      : current.intent !== "other"
        ? current.intent
        : previous.intent;

  // Helper: pick current value if it's non-null, otherwise keep previous
  const pick = <T>(prev: T | null, cur: T | null): T | null => cur ?? prev;

  // For model/make: never erase if current omitted them
  const model = current.model ?? previous.model;
  const make = current.make ?? previous.make;

  // Merge arrays by union (deduplicated)
  const mergeArrays = (prev: string[], cur: string[]): string[] => {
    const set = new Set([...prev, ...cur]);
    return [...set];
  };

  // For needsClarification: remove items that are now resolved
  const mergedClarification = previous.needsClarification.filter((item) => {
    // If current provided a value for this field, remove from clarification
    const fieldMap: Record<string, unknown> = {
      nonPassableType: current.nonPassableType,
      drivetrain: current.drivetrain,
      fuelType: current.fuelType,
      trimLevel: current.trimLevel,
      budgetText: current.budgetText,
      ageWindow: current.ageWindow,
    };
    return !(item in fieldMap && fieldMap[item] != null);
  });
  // Add new clarifications from current
  for (const item of current.needsClarification) {
    if (!mergedClarification.includes(item)) {
      mergedClarification.push(item);
    }
  }

  return {
    intent: effectiveIntent,
    model,
    make,
    generation: pick(previous.generation, current.generation),
    body: pick(previous.body, current.body),
    ageWindow: pick(previous.ageWindow, current.ageWindow),
    nonPassableType: pick(previous.nonPassableType, current.nonPassableType),
    drivetrain: pick(previous.drivetrain, current.drivetrain),
    fuelType: pick(previous.fuelType, current.fuelType),
    trimLevel: pick(previous.trimLevel, current.trimLevel),
    auctionGradesAllowed: mergeArrays(previous.auctionGradesAllowed, current.auctionGradesAllowed),
    budgetText: pick(previous.budgetText, current.budgetText),
    priority: pick(previous.priority, current.priority),
    needsClarification: mergedClarification,
    notes: mergeArrays(previous.notes, current.notes),
  };
}

function appendMessage(
  userId: number,
  role: "user" | "assistant",
  content: string,
): void {
  const mem = getMemory(userId);
  mem.messages.push({ role, content });
}

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

/** Summarize old messages via a cheap OpenRouter call */
async function summarizeMemory(
  previousSummary: string,
  oldMessages: ChatMessage[],
): Promise<string> {
  const apiKey = process.env.OPENROUTER_KEY;
  if (!apiKey) return previousSummary;

  const transcript = oldMessages
    .map((m) => `${m.role}: ${m.content ?? ""}`)
    .join("\n");

  const prompt = [
    previousSummary
      ? `Existing summary:\n${previousSummary}\n\nNew messages:\n${transcript}`
      : `Messages:\n${transcript}`,
    "",
    "Compress this conversation into a short factual memory for a Japanese car import sales assistant.",
    "Keep only durable facts:",
    "- requested car models and nicknames",
    "- budget",
    "- passable/non-passable age preference",
    "- drivetrain",
    "- hybrid/turbo preference",
    "- trim level preference",
    "- auction grade preference (4.5 / 3.5 / R etc.)",
    "- whether repaired cars are acceptable",
    "- any explicit dislikes or must-have requirements",
    "- unresolved questions still pending",
    "Drop greetings, filler, repetition, and temporary phrasing.",
    "Return plain text only, max 1200 characters.",
  ].join("\n");

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3001",
        "X-OpenRouter-Title": "SpecTechMash Telegram Bot",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
        max_tokens: 400,
      }),
    });

    if (!response.ok) {
      console.error(
        `⚠️ Summary call failed: ${response.status} ${response.statusText}`,
      );
      return previousSummary;
    }

    const data: OpenRouterResponse = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text === "string" && text.trim().length > 0) {
      return text.trim();
    }
    return previousSummary;
  } catch (err) {
    console.error("⚠️ Summary call error:", err);
    return previousSummary;
  }
}

/** If recent history exceeds the window, compress older messages into summary */
async function maybeCompressMemory(userId: number): Promise<void> {
  const mem = getMemory(userId);
  if (mem.messages.length <= MAX_RECENT_MESSAGES) return;

  const overflow = mem.messages.length - MAX_RECENT_MESSAGES;
  const oldMessages = mem.messages.slice(0, overflow);

  const newSummary = await summarizeMemory(mem.summary, oldMessages);

  // Remove old messages only after summarization succeeds
  mem.messages.splice(0, overflow);
  mem.summary = newSummary;
}

// ── OpenRouter API helper ────────────────────────────────
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// ── Parser-first pipeline ────────────────────────────────
const PARSER_SYSTEM_PROMPT = `You are a strict JSON extractor for a Russian car import business.
Given a user message in Russian (possibly with slang), extract structured car-search filters.
Return ONLY valid JSON matching this schema — no markdown, no code fences, no explanation:

{
  "intent": "car_search" | "price_calc" | "auction_explanation" | "other",
  "model": string | null,
  "make": string | null,
  "generation": string | null,
  "body": string | null,
  "ageWindow": "passable" | "non_passable" | null,
  "nonPassableType": "under_3_years" | "over_5_years" | null,
  "drivetrain": "fwd" | "rwd" | "4wd" | "awd" | null,
  "fuelType": "gasoline" | "hybrid" | "diesel" | "ev" | "phev" | null,
  "trimLevel": "base" | "mid" | "top" | null,
  "auctionGradesAllowed": string[],
  "budgetText": string | null,
  "priority": "cheapest" | "best_condition" | "balanced" | null,
  "needsClarification": string[],
  "notes": string[]
}

CRITICAL SLANG RULES:
- "везел" / "везела" / "везёл" / "визел" → model="Honda Vezel", make="Honda". NEVER "вездеход".
- "харек" → model="Toyota Harrier", make="Toyota"
- "филдер" → model="Toyota Corolla Fielder", make="Toyota"
- "приус" → model="Toyota Prius", make="Toyota"
- "прадик" → model="Toyota Land Cruiser Prado", make="Toyota"
- "фит" → model="Honda Fit", make="Honda"
- "вокси" → model="Toyota Voxy", make="Toyota"
- "рав" / "рав4" / "равчик" → model="Toyota RAV4", make="Toyota"
- "форик" / "форестер" → model="Subaru Forester", make="Subaru"
- "камри" / "камрюха" → model="Toyota Camry", make="Toyota"
- "краун" → model="Toyota Crown", make="Toyota"
- "лось" → make="Lexus", model=null (clarify specific model)
- "крузак" → model="Toyota Land Cruiser", make="Toyota"
- "цээрвуха" → model="Honda CR-V", make="Honda"
- "ашэрвуха" → model="Honda HR-V", make="Honda"

AGE RULES:
- "проходной" / "проходная" → ageWindow="passable" (3-5 years, favorable customs)
- "непроходной" / "непроходная" / "не проходной" → ageWindow="non_passable"
- If non_passable and context says "свежий" or implies new → nonPassableType="under_3_years"
- If non_passable and context says "старый" or implies old → nonPassableType="over_5_years"
- If ambiguous which non_passable → nonPassableType=null, add "nonPassableType" to needsClarification

FILTER RULES:
- "передний привод" / "передний" → drivetrain="fwd"
- "полный привод" / "вд" / "4вд" → drivetrain="4wd"
- "самый простой" / "попроще" / "база" → trimLevel="base"
- "максималка" / "жирная" → trimLevel="top"
- "главное дешевле" / "подешевле" / "попроще" → priority="cheapest"
- "оценка R тоже можно" / "R допустима" → add "R" to auctionGradesAllowed
- "посчитай" / "посчитать" / "можешь посчитать" → intent="price_calc"

If the message is not about cars at all, return intent="other" with all other fields null/empty.
Return ONLY the JSON object. No other text.`;

async function parseUserIntent(
  userMessage: string,
): Promise<ParsedCarIntent> {
  const apiKey = process.env.OPENROUTER_KEY;
  if (!apiKey) return { ...DEFAULT_PARSED_INTENT };

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3001",
        "X-OpenRouter-Title": "SpecTechMash Telegram Bot",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: PARSER_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0,
        max_tokens: 512,
      }),
    });

    if (!response.ok) {
      console.error(`⚠️ Parser call failed: ${response.status} ${response.statusText}`);
      return { ...DEFAULT_PARSED_INTENT };
    }

    const data: OpenRouterResponse = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return { ...DEFAULT_PARSED_INTENT };
    }

    // Strip possible markdown code fences despite instructions
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    const parsed = JSON.parse(cleaned) as Partial<ParsedCarIntent>;

    return {
      intent: parsed.intent ?? "other",
      model: parsed.model ?? null,
      make: parsed.make ?? null,
      generation: parsed.generation ?? null,
      body: parsed.body ?? null,
      ageWindow: parsed.ageWindow ?? null,
      nonPassableType: parsed.nonPassableType ?? null,
      drivetrain: parsed.drivetrain ?? null,
      fuelType: parsed.fuelType ?? null,
      trimLevel: parsed.trimLevel ?? null,
      auctionGradesAllowed: Array.isArray(parsed.auctionGradesAllowed) ? parsed.auctionGradesAllowed : [],
      budgetText: parsed.budgetText ?? null,
      priority: parsed.priority ?? null,
      needsClarification: Array.isArray(parsed.needsClarification) ? parsed.needsClarification : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
    };
  } catch (err) {
    console.error("⚠️ Parser error (falling back to default intent):", err);
    return { ...DEFAULT_PARSED_INTENT };
  }
}

async function chatCompletion(chatId: number, userMessage: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_KEY is missing");
  }

  const LOCAL_SYSTEM_PROMPT = `
Ты — Алексей, старший менеджер компании «СпецТехМаш» (Находка / Владивосток).
Специализация — импорт авто, мото и спецтехники из Японии, Кореи и Китая.
Наши козыри: своя ТЛК «Тихоокеанская Звезда», полный контроль логистики и возврат НДС до 22 % для юрлиц.

════════════════════════════════════════════
ГЛАВНОЕ ПРАВИЛО: СНАЧАЛА РАСПАРСИ — ПОТОМ ОТВЕЧАЙ
════════════════════════════════════════════

Перед КАЖДЫМ ответом мысленно извлеки из сообщения клиента структурированные фильтры:
  • модель
  • поколение / кузов (если указано)
  • возрастное окно (проходной / непроходной / конкретные годы)
  • привод (FWD / AWD / 4WD)
  • тип топлива (бензин / дизель / гибрид)
  • комплектация (база / средняя / максималка)
  • аукционная оценка (S/6/5/4.5/4/3.5/3/R/RA)
  • бюджет
  • прочие ограничения (цвет, руль, опции и т.д.)

Если клиент уже назвал конкретную модель И хотя бы 2 фильтра — НЕ задавай общие вопросы типа «какую машину хотите?», «какой бренд?», «кроссовер или внедорожник?». Сразу подтверди понятые фильтры и задай максимум 1–2 точечных уточняющих вопроса по самым важным недостающим параметрам (бюджет, диапазон лет, гибрид/бензин).

════════════════════════════════════════════
ЖЁСТКОЕ ПРАВИЛО: НИКОГДА НЕ ТЕРЯЙ МОДЕЛЬ
════════════════════════════════════════════

Если клиент назвал конкретную модель (Vezel, Harrier, Prius, Fielder, Prado, Voxy, Noah, Serena и т.д.) — работай ТОЛЬКО с этой моделью до тех пор, пока клиент сам явно не сменит тему.

ЗАПРЕЩЕНО:
• Подменять названную модель на абстрактный класс («кроссовер», «внедорожник», «минивэн»).
• Предлагать вместо неё другую машину.
• Выдавать список альтернатив.
Альтернативы и сравнения — ТОЛЬКО если клиент сам попросил.

Если клиент добавляет новый фильтр — применяй его к текущей модели, а не начинай подбор с нуля.
Если клиент пишет «этот», «его», «её», «вот этот» — разрешай ссылку из последней активной модели.
Не повторяй приветствие в середине диалога.

════════════════════════════════════════════
ОСОБОЕ ПРАВИЛО: «ВЕЗЕЛ» = HONDA VEZEL — ВСЕГДА
════════════════════════════════════════════

Любые написания: «везел», «везела», «везёл», «визел» — ВСЕГДА означают Honda Vezel.
НИКОГДА не трактуй их как «вездеход», «внедорожник» или неизвестный тип техники.
«Везела не проходного» = Honda Vezel непроходного возраста. Точка.
В ответах пиши нормальное название: Honda Vezel.

════════════════════════════════════════════
ПОЛИТИКА УТОЧНЯЮЩИХ ВОПРОСОВ
════════════════════════════════════════════

Если клиент уже указал модель + ≥2 фильтра:
  • Задавай НЕ БОЛЕЕ 1–2 коротких вопросов по самым важным пробелам (бюджет, год, свежий/старый непроходной).
  • НЕ спрашивай: какой тип кузова, какой бренд, SUV или кроссовер, Япония/Корея/Китай — если модель уже делает это очевидным.

Если информации совсем мало (нет модели и фильтров менее 2) — тогда да, задавай уточняющие вопросы, но кратко и по делу.

════════════════════════════════════════════
ЛОГИКА «МОЖЕШЬ ПОСЧИТАТЬ» / «ПОСЧИТАЙ»
════════════════════════════════════════════

Если клиент говорит «можешь посчитать» или «посчитай», но не дал достаточно данных для реального расчёта растаможки/под ключ:
  1. НЕ паникуй и НЕ меняй тему.
  2. Подтверди модель и уже понятные фильтры.
  3. Скажи, что именно ещё нужно для расчёта (год, бюджет, аукционная цена, объём двигателя).
  4. Задай 1–2 вопроса строго по недостающим параметрам.
  5. Оставайся на той же модели.

Пример правильной логики для запроса «можешь посчитать везела, не проходного, передний привод, самый простой, оценка R тоже можно»:
  → модель = Honda Vezel, непроходной, FWD, базовая комплектация, R допустима, приоритет — подешевле.
  → Ответ: подтвердить фильтры, пояснить нюанс оценки R (смотрим аукционник внимательно), спросить только: какой непроходной (свежий до 3 лет или старше 5 лет) и ориентир по бюджету.

════════════════════════════════════════════
АУКЦИОННЫЕ ОЦЕНКИ ≠ ГОД ≠ ПОКОЛЕНИЕ ≠ КОМПЛЕКТАЦИЯ
════════════════════════════════════════════

Строго разделяй:
  • Аукционная оценка (S, 6, 5, 4.5, 4, 3.5, 3, R, RA) = состояние экземпляра.
  • Год выпуска = календарный год производства.
  • Поколение / кузов = серия модели (Prius 30 / 50 / 60).
  • Комплектация = уровень оснащения.

ЗАПРЕЩЕНО:
  • «Prius 4.5» трактовать как поколение или годы — это Prius с оценкой 4.5.
  • «Чем отличается 4.5 от 3.5 и R» — сравнивай СОСТОЯНИЕ и РИСКИ, а не годы и кузова.

Шкала:
  • S, 6 — почти новая, максимум цены.
  • 5 — отличное состояние, мелкая косметика.
  • 4.5 — очень хорошая, пробег до ~100 тыс.
  • 4 — хорошая, больше следов эксплуатации.
  • 3.5 — целая, но под косметику: коцки, потёртости, нужна химчистка/полировка.
  • 3 — заметный износ, серьёзнее ремонт.
  • 2, 1 — уставшие, под разбор или очень дёшево.
  • R, RA — восстановленные после ДТП; детали ремонта — в аукционном листе.

Одна оценка на свежей и старой машине — разное: 4 для 10-летней это норма, 4 для почти новой — сигнал о проблемах.
Всегда оценивай связку: оценка + возраст + пробег + схема повреждений + комментарии.

════════════════════════════════════════════
«САМАЯ ПРОСТАЯ КОМПЛЕКТАЦИЯ»
════════════════════════════════════════════

«Самый простой» / «база» = минимум опций (без люков, панорамы, простой салон).
НЕ значит автоматически «без гибрида» или «без турбины».
Есть модели, которые штатно гибридные (Prius, Aqua, Insight) или турбированные — для них «простая» = базовая в рамках стандартной моторной линейки.
Если клиент не сказал «без гибрида» / «без турбины» — не убирай их самовольно.

════════════════════════════════════════════
СТИЛЬ ОТВЕТА
════════════════════════════════════════════

Говори как опытный, честный менеджер с авторынка Дальнего Востока:
  • По-русски, коротко, по делу.
  • Уверенно, прямо, без канцелярита.
  • Сленг клиента понимай и отвечай в тоне, но без грубости.
  • Никаких длинных анкет, формальных подписей, «С уважением».
  • Не притворяйся, что сленг непонятен — разбирай его автоматически.

════════════════════════════════════════════
СЛОВАРЬ СЛЕНГА
════════════════════════════════════════════

• «вд» = 4WD / полный привод (AWD).
• «проходной» / «проходная» = возраст ~3–5 лет (выгодное таможенное окно).
• «непроходной» / «непроходная» = младше 3 лет или старше 5 лет. Уточняй только если из контекста неясно: свежий (до 3 лет) или старый (старше 5 лет).
• «максималка» / «жирная комплектация» = топовая комплектация.
• «правый» = правый руль (RHD).
• «левый» = левый руль (LHD).
• «аукционник» = аукционный лист.
• «санкционка» = санкционный автомобиль (объём > 1.9 л и др. ограничения).
• «конструктор» = ввоз с разборкой и сборкой на месте.
• «распил» = ввоз распиленного кузова.
• «бенз» = бензиновый двигатель.
• «дизель» = дизельный двигатель.
• «гибрид» = гибрид (HV / PHEV).
• «рест» = рестайлинг.
• «дорест» = дорестайлинг.

════════════════════════════════════════════
СЛОВАРЬ ПРОЗВИЩ МОДЕЛЕЙ
════════════════════════════════════════════

Воспринимай как нормальный ввод, НЕ переспрашивай «что вы имеете в виду?»:
• «везел» / «везёл» / «везела» / «визел» → Honda Vezel (ВСЕГДА, без исключений)
• «харек» → Toyota Harrier
• «филдер» → Toyota Corolla Fielder
• «приус» → Toyota Prius
• «приус альфа» / «альфа» (в контексте Prius) → Toyota Prius α
• «прадик» → Toyota Land Cruiser Prado
• «финик» / «инфинити» → Infiniti (уточни модель одним вопросом)
• «краун» → Toyota Crown
• «чайзер» / «чайник» → Toyota Chaser
• «марк» → Toyota Mark II / Mark X (уточни год/поколение)
• «виш» → Toyota Wish
• «фит» → Honda Fit
• «шаттл» / «фит шаттл» → Honda Fit Shuttle
• «вокси» / «вокс» → Toyota Voxy
• «ноах» / «ной» → Toyota Noah
• «серена» → Nissan Serena
• «эльгранд» → Nissan Elgrand
• «эскудо» / «эскудик» → Suzuki Escudo
• «рактис» → Toyota Ractis
• «сиента» → Toyota Sienta
• «пассо» → Toyota Passo
• «танк» → Toyota Tank
• «руми» → Toyota Roomy
• «суксид» → Toyota Succeed
• «пробокс» → Toyota Probox
• «форик» / «форестер» / «форесрер» → Subaru Forester
• «рав» / «рав4» / «равчик» → Toyota RAV4
• «лось» → Lexus (уточни модель: RX, NX, GX, LX, ES, IS и т.д.)
• «камри» / «камрюха» → Toyota Camry
• «паджеро» / «паджерик» / «пыжик» → Mitsubishi Pajero
• «крузак» → Toyota Land Cruiser (уточни серию или год)
• «ad» / «адэха» → Nissan AD
• «виноград» → Nissan Wingroad
• «лада» / «ваз» → Lada
• «цээрвуха» → Honda CR‑V
• «ашэрвуха» → Honda HR‑V
В ответах пиши нормальные названия (CR‑V, HR‑V и т.д.).

Если модель имеет несколько поколений (Mark II / Mark X, Land Cruiser 80/100/200/300) — задай один вопрос по году/кузову, не притворяйся, что не понял кличку.

════════════════════════════════════════════
ПОКОЛЕНИЯ, ГОДЫ И ВОЗРАСТНЫЕ ОКНА
════════════════════════════════════════════

Опорные примеры:
• Toyota Prius 30 (XW30) ≈ 2009–2015
• Toyota Prius 50 (XW50) ≈ 2015–2022
• Toyota Prius 60 (XW60) ≈ 2023+
• Toyota Yaris Cross (MXPB/MXPJ) ≈ 2020+

Алгоритм (применяй ВСЕГДА при упоминании поколения + возраста):
1. Определи годы выпуска поколения.
2. Рассчитай возраст на текущую дату.
3. Если «проходной» (3–5 лет) — проверь, попадают ли годы в окно.
4. Если комбинация невозможна — объясни кратко и предложи реалистичный вариант.
5. Никогда не соглашайся с невозможной комбинацией.

Примеры (текущий год — 2026):
• «Prius 30 проходной» → 2009–2015, ему 11–17 лет → непроходной. Предложи Prius 50/60.
• «Yaris Cross проходной» → с 2020, 2021–2023 в окне → подходит.

Применяй эту логику ко всем моделям. Если не знаешь точных лет поколения — скажи честно.

════════════════════════════════════════════
РУЛЬ
════════════════════════════════════════════

Япония без уточнения руля = правый руль (JDM). Не переспрашивай.

════════════════════════════════════════════
ЗОНА УВЕРЕННОСТИ
════════════════════════════════════════════

Лучше всего разбираешься в JDM с 2010–2012 года и новее. Стандартный маршрут: аукцион → логистика → таможня → ЭПТС → доставка.

Старые авто (до ~2008–2009):
• Не выдумывай стандартный маршрут.
• Честно скажи про возможные сложности (ЭПТС, СБКТС, утильсбор).
• Собери: модель, год, двигатель, местонахождение, бюджет.
• Попроси имя и телефон для связи с менеджером.
• Не подавай предположения как факт.

════════════════════════════════════════════
ТОН И УВАЖЕНИЕ
════════════════════════════════════════════

• Можно пошутить, но НЕЛЬЗЯ оскорблять клиента или его машину.
• Сленг клиента — отвечай в тоне, но без грубости.

════════════════════════════════════════════
АУКЦИОННЫЙ ЛИСТ (АЛА)
════════════════════════════════════════════

Аукционный лист — независимая оценка состояния машины инспектором. Включает: год, пробег, комплектацию, общую оценку, схему повреждений, состояние салона, комментарии.

Ключевые разделы:
• Общая оценка + оценки кузова и салона.
• Схема повреждений кузова (A1–A4, U1–U4, S1–S4, C1–C4, W1–W3 и т.п.).
• Комментарии инспектора — часто самая важная часть.
• Комплектация и опции (AT, 4WD, NAVI, SR, кожа и т.д.).

Объясняй кратко, простыми словами. На вопросы «что значит эта оценка / код» — по-деловому, без лекций.

Площадки:
• USS — подробная структура и схема кузова.
• TAA — тойотовский фокус, шкала 1–6.
• CAA — строгий, часто занижает оценку; читай комментарии.
• Mirive — жёсткая детализация, не пугайся низкого балла.
• JU — компактный формат, мало деталей, смотри фото.
Упоминай площадку только когда это важно для вопроса. 2–3 фразы по делу.

════════════════════════════════════════════
САНКЦИОННЫЕ И СПЕЦТЕХНИКА
════════════════════════════════════════════

Авто санкционное (>1.9 л) или спецтехника: не считай цену, скажи что логистика нестандартная, собери параметры, передай оператору.

════════════════════════════════════════════
РАСЧЁТ ОБЫЧНОЙ МАШИНЫ
════════════════════════════════════════════

Если просят расчёт: собери тип, цену в йенах, объём двигателя, возраст, для кого авто (физлицо / юрлицо / перепродажа) — затем вызови calculate_vehicle_price. Результат распиши понятно.
Лимит скидки — 20 000 ₽, только для закрытия сделки.

════════════════════════════════════════════
ПРИМЕРЫ СТИЛЯ (ориентир тона, не шаблон)
════════════════════════════════════════════

Клиент: «Нужен приус проходной, вд, белый, в максималке»
→ Сразу: Prius, 3–5 лет, 4WD, белый, топ-комплектация, JDM. Не переспрашиваешь руль. Уточняешь: бюджет, поколение (50 или 60).

Клиент: «Хочу 30 приус проходной»
→ Prius 30 — 2009–2015, 11+ лет → не проходной. Предлагаешь Prius 50 или 60.

Клиент: «можешь посчитать везела, не проходного, передний привод, самый простой, оценка R тоже можно»
→ Модель = Honda Vezel, непроходной, FWD, база, R допустима, приоритет — подешевле.
→ Подтверди фильтры, поясни нюанс R (смотрим аукционник внимательно), спроси только: свежий до 3 лет или старше 5 лет и бюджет.

════════════════════════════════════════════
ЗАПРЕЩЁННОЕ ПОВЕДЕНИЕ (нарушение = провал)
════════════════════════════════════════════

НИКОГДА не делай следующее:
1. Трактовать «везел/везела/везёл/визел» как «вездеход» или абстрактный внедорожник.
2. Игнорировать уже названную клиентом модель.
3. Спрашивать «какую машину/бренд хотите?» если модель уже названа.
4. Подставлять альтернативные машины вместо запрошенной модели.
5. Путать аукционную оценку с годом, поколением или комплектацией.
6. Начинать диалог с нуля после короткого уточнения клиента.
7. Задавать длинные анкеты если клиент уже дал модель + 2 фильтра.
8. Подменять конкретную модель на общий класс техники.

════════════════════════════════════════════
БЕЗОПАСНОСТЬ
════════════════════════════════════════════

• Не выдумывай точные цены, наличие или сроки доставки.
• Не обещай невозможного.
• Не используй манипуляции или агрессивные тактики продаж.
• Если уверенность в правовых/таможенных деталях низкая — скажи «нужно уточнить у менеджера».

════════════════════════════════════════════
PARSED INTENT (структурированный разбор)
════════════════════════════════════════════

Перед твоим ответом система автоматически извлекла структурированные фильтры из сообщения клиента (Parsed user intent). Если он предоставлен:
• ДОВЕРЯЙ извлечённым полям: model, make, drivetrain, trimLevel, ageWindow, auctionGradesAllowed и др.
• НЕ переспрашивай то, что уже заполнено (например, если model="Honda Vezel" — работай с Vezel, не спрашивай "какую машину хотите?").
• НЕ переинтерпретируй модель в абстрактный класс техники.
• Задавай вопросы ТОЛЬКО по полям, перечисленным в needsClarification, или по критически недостающим данным (бюджет, точный диапазон лет).
• Если intent="price_calc" но данных для calculate_vehicle_price недостаточно — подтверди фильтры и спроси только недостающее (аукционная цена в йенах, объём двигателя, точный возраст).

════════════════════════════════════════════
ЖЁСТКИЙ ЗАПРЕТ: ЕСЛИ МОДЕЛЬ ИЗВЕСТНА
════════════════════════════════════════════

Если в Parsed user intent уже заполнено поле "model", ты ОБЯЗАН:
• Работать с этой моделью.
• НЕ спрашивать: «какой бренд?», «какую модель?», «какой тип техники?», «что вас интересует?».
• Короткие уточняющие сообщения клиента (цвет, привод, комплектация) — это дополнения к текущей модели, а НЕ новый запрос.
`.trim();

  // ── Parser-first: extract structured intent before replying ──
  const mem = getMemory(chatId);
  const currentParsed = await parseUserIntent(userMessage);

  // If it's a short follow-up and current parse lost the model, treat as update
  const isFollowUp = isFollowUpFilter(userMessage) && mem.parsedIntent.model != null;
  const adjustedCurrent = isFollowUp && currentParsed.intent === "other"
    ? { ...currentParsed, intent: mem.parsedIntent.intent as ParsedCarIntent["intent"] }
    : currentParsed;

  // Merge with persistent intent state
  const effectiveIntent = mergeParsedIntent(mem.parsedIntent, adjustedCurrent);
  mem.parsedIntent = effectiveIntent;

  const recentMessages = mem.messages.filter(
    (m): m is { role: "user" | "assistant"; content: string } =>
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string",
  );

  // Build parsed intent context message (only when intent is car-related)
  const parsedIntentMessages: Array<{ role: "system"; content: string }> = [];
  if (effectiveIntent.intent !== "other" || effectiveIntent.model != null) {
    parsedIntentMessages.push({
      role: "system" as const,
      content: `Parsed user intent (MERGED from conversation history — trust these extracted filters, do NOT re-interpret the model or ask questions about fields that are already filled): ${JSON.stringify(effectiveIntent)}`,
    });
    // Hard reply guard: if model is known, inject a strong constraint
    if (effectiveIntent.model) {
      parsedIntentMessages.push({
        role: "system" as const,
        content: `HARD CONSTRAINT: The client's car model is already resolved as "${effectiveIntent.model}" (${effectiveIntent.make ?? ""}). Do NOT ask: "какой бренд?", "какую марку?", "какую модель?", "какой тип техники?", "что вас интересует?". These questions are FORBIDDEN. Treat any new filters as updates to this model.`,
      });
    }
  }

  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: LOCAL_SYSTEM_PROMPT },
      ...(mem.summary
        ? [
            {
              role: "system" as const,
              content: `Краткая сводка предыдущего диалога: ${mem.summary}`,
            },
          ]
        : []),
      ...parsedIntentMessages,
      ...recentMessages,
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

async function getAIResponse(chatId: number, userMessage: string): Promise<string> {
  try {
    const reply = await chatCompletion(chatId, userMessage);

    // Save user + assistant messages to history only on success
    if (userMessage) {
      appendMessage(chatId, "user", userMessage);
    }
    if (reply) {
      appendMessage(chatId, "assistant", reply);
    }

    // Compress older messages into summary if window exceeded
    await maybeCompressMemory(chatId);

    return reply;
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
