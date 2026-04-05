import { Telegraf } from "telegraf";
import "dotenv/config";
import { calculateTurnkeyPrice, type CalcParams } from "./calculator";
import {
  normalizeAutoSlang,
  extractSlangSignals,
  extractExcludedNegativeFlags,
  extractSellerClaimSignals,
  type SellerClaim,
} from "./slang.js";

// ── Cyrillic-aware word boundary fix ─────────────────────
// JavaScript \b only matches ASCII [a-zA-Z0-9_] boundaries and silently fails
// on Cyrillic characters. This helper replaces \b with lookaround assertions
// that include Cyrillic letters, enabling correct word boundary detection
// for Russian text patterns.
//
// IMPORTANT: Only use on patterns with exactly 1 or 2 \b assertions in the
// standard structure \b(...)\b. The first \b becomes a negative lookbehind
// (before-word boundary) and any subsequent \b becomes a negative lookahead
// (after-word boundary). Do NOT use on patterns with 3+ \b.
function cyrb(re: RegExp): RegExp {
  let isFirst = true;
  const fixed = re.source.replace(/\\b/g, () => {
    if (isFirst) {
      isFirst = false;
      return '(?<![а-яёА-ЯЁa-zA-Z0-9])';
    }
    return '(?![а-яёА-ЯЁa-zA-Z0-9])';
  });
  return new RegExp(fixed, re.flags);
}

// ── Environment validation ───────────────────────────────
const isTestMode = !!process.env.BOT_TEST_MODE;
const token = process.env.AI_BOT_TOKEN;
if (!token && !isTestMode) {
  console.error("❌ AI_BOT_TOKEN is not set in environment variables.");
  process.exit(1);
}

const openrouterKey = process.env.OPENROUTER_KEY;
if (!openrouterKey && !isTestMode) {
  console.error("❌ OPENROUTER_KEY is not set in environment variables.");
  process.exit(1);
}

const MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-5.4";
const TEMPERATURE = 0.3;
const MAX_TOKENS = 600;

// ── Tool definitions for function calling ────────────────
const tools = [{
  type: "function" as const,
  function: {
    name: "calculate_vehicle_price",
    description: "Рассчитать стоимость импортного авто. Возвращает цены в рублях.",
    parameters: {
      type: "object",
      properties: {
        vehicleType: { type: "string", enum: ["car", "jeep", "moto", "special", "special_vehicle"] },
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

// ── Stage machine types ──────────────────────────────────

type ConversationStage =
  | "idle"
  | "collecting_filters"
  | "collecting_calc_params"
  | "ready_to_calculate"
  | "explaining_auction"
  | "handoff";

interface SlotMeta {
  source: "regex" | "llm" | "user_explicit" | "derived";
  confidence: "high" | "medium" | "low";
  turnIndex: number;
}

type SlotKey =
  | "activeIntent"
  | "model" | "make" | "generation" | "body"
  | "year" | "yearText"
  | "ageWindow" | "nonPassableType"
  | "drivetrain" | "steering"
  | "fuelType" | "trimLevel"
  | "color" | "mileageText"
  | "auctionGradeMin" | "auctionGradesAllowed"
  | "budgetText" | "auctionPriceJPY" | "volumeCm3"
  | "isForResale" | "isLegalEntity"
  | "priority"
  | "lastResolvedModelAlias";

type ClearableField =
  | "color"
  | "trimLevel"
  | "drivetrain"
  | "fuelType"
  | "auctionGradeMin"
  | "auctionGradesAllowed";

interface StateUpdate {
  set: Partial<ConversationState>;
  clearFields: ClearableField[];
}

// ── Conversation state (parser-first pipeline) ───────────
interface ConversationState {
  stage: ConversationStage;
  activeIntent: "car_search" | "price_calc" | "auction_explanation" | "other";

  model: string | null;
  make: string | null;
  generation: string | null;
  body: string | null;

  year: number | null;
  yearText: string | null;

  ageWindow: "passable" | "non_passable" | null;
  nonPassableType: "under_3_years" | "over_5_years" | null;

  // AWD is intentionally normalized to "4wd" — single internal convention
  drivetrain: "fwd" | "rwd" | "4wd" | null;
  steering: "rhd" | "lhd" | null;

  fuelType: "gasoline" | "hybrid" | "diesel" | "ev" | "phev" | null;
  trimLevel: "base" | "mid" | "top" | null;

  color: string | null;
  mileageText: string | null;

  auctionGradeMin: string | null;
  auctionGradesAllowed: string[];

  budgetText: string | null;
  budgetDeclined: boolean;
  auctionPriceJPY: number | null;
  volumeCm3: number | null;

  isForResale: boolean | null;
  isLegalEntity: boolean | null;

  priority: "cheapest" | "best_condition" | "balanced" | null;

  calculationDone: boolean;
  pendingQuestion: string | null;
  needsClarification: string[];

  lastResolvedModelAlias: string | null;
  turnIndex: number;

  slotMeta: Partial<Record<SlotKey, SlotMeta>>;

  // ── Slang-derived fields ──
  transmission: "manual" | "automatic" | "cvt" | null;
  condition: "poor" | "decent" | null;
  hasSunroof: boolean;
  hasClimate: boolean;
  manualWindows: boolean;
  turbo: boolean;
  noRussiaMileage: boolean;
  sellerClaims: SellerClaim[];
  excludedNegativeFlags: string[];
}

const DEFAULT_CONVERSATION_STATE: ConversationState = {
  stage: "idle",
  activeIntent: "other",
  model: null,
  make: null,
  generation: null,
  body: null,
  year: null,
  yearText: null,
  ageWindow: null,
  nonPassableType: null,
  drivetrain: null,
  steering: null,
  fuelType: null,
  trimLevel: null,
  color: null,
  mileageText: null,
  auctionGradeMin: null,
  auctionGradesAllowed: [],
  budgetText: null,
  budgetDeclined: false,
  auctionPriceJPY: null,
  volumeCm3: null,
  isForResale: null,
  isLegalEntity: null,
  priority: null,
  calculationDone: false,
  pendingQuestion: null,
  needsClarification: [],
  lastResolvedModelAlias: null,
  turnIndex: 0,
  slotMeta: {},
  transmission: null,
  condition: null,
  hasSunroof: false,
  hasClimate: false,
  manualWindows: false,
  turbo: false,
  noRussiaMileage: false,
  sellerClaims: [],
  excludedNegativeFlags: [],
};

/**
 * Derive implicit state values from what we already know.
 * E.g. Japan + no steering specified → rhd; model → make.
 *
 * @param explicitlySetKeys — keys that were explicitly set in the current update;
 *   these take priority over derived values.
 */
function deriveImpliedState(
  state: ConversationState,
  explicitlySetKeys: Set<string> = new Set(),
): void {
  // If model is set but make is missing, try to infer make from MODEL_SLANG / EXPLICIT_MODEL_PATTERNS
  if (state.model && !state.make) {
    for (const entry of MODEL_SLANG) {
      if (entry.model && entry.model.toLowerCase() === state.model.toLowerCase()) {
        state.make = entry.make;
        state.slotMeta.make = { source: "derived", confidence: "high", turnIndex: state.turnIndex };
        break;
      }
    }
    if (!state.make) {
      for (const entry of EXPLICIT_MODEL_PATTERNS) {
        if (entry.model.toLowerCase() === state.model.toLowerCase()) {
          state.make = entry.make;
          state.slotMeta.make = { source: "derived", confidence: "high", turnIndex: state.turnIndex };
          break;
        }
      }
    }
  }

  // Japan origin + no steering → default to RHD
  if (!state.steering && state.make) {
    const jpBrands = ["Toyota", "Honda", "Nissan", "Subaru", "Mitsubishi", "Mazda", "Suzuki", "Lexus", "Infiniti", "Daihatsu"];
    if (jpBrands.includes(state.make)) {
      state.steering = "rhd";
      state.slotMeta.steering = { source: "derived", confidence: "medium", turnIndex: state.turnIndex };
    }
  }

  // Derive ageWindow from year — always recompute when year is present,
  // UNLESS ageWindow was explicitly set in the current update (explicit wins).
  if (state.year && !explicitlySetKeys.has("ageWindow")) {
    const currentYear = new Date().getFullYear();
    const age = currentYear - state.year;
    if (age >= 3 && age <= 5) {
      state.ageWindow = "passable";
      state.nonPassableType = null;
      state.slotMeta.ageWindow = { source: "derived", confidence: "high", turnIndex: state.turnIndex };
      delete state.slotMeta.nonPassableType;
    } else {
      state.ageWindow = "non_passable";
      state.nonPassableType = age < 3 ? "under_3_years" : "over_5_years";
      state.slotMeta.ageWindow = { source: "derived", confidence: "high", turnIndex: state.turnIndex };
      state.slotMeta.nonPassableType = { source: "derived", confidence: "high", turnIndex: state.turnIndex };
    }
  }
}

/**
 * Build the needsClarification array from scratch every turn.
 * Never reuses old clarification arrays — purely derived from current state.
 */
function computeNeedsClarification(state: ConversationState): string[] {
  const missing: string[] = [];

  if ((state.activeIntent === "car_search" || state.activeIntent === "price_calc") && !state.model) {
    missing.push("model");
  }

  if (state.ageWindow === "non_passable" && !state.nonPassableType) {
    missing.push("nonPassableType");
  }

  if (state.activeIntent === "price_calc") {
    if (state.auctionPriceJPY == null && !state.budgetText && !state.budgetDeclined) {
      missing.push("priceOrBudget");
    }
    if (state.volumeCm3 == null) {
      missing.push("volumeCm3");
    }
    if (state.year == null && state.ageWindow == null) {
      missing.push("yearOrAgeWindow");
    }
    if (state.isForResale == null) {
      missing.push("isForResale");
    }
    if (state.isLegalEntity == null) {
      missing.push("isLegalEntity");
    }
  }

  return missing;
}
function deriveStage(state: ConversationState): ConversationStage {
  if (state.activeIntent === "other" && !state.model) {
    return "idle";
  }

  if (state.activeIntent === "auction_explanation") {
    return "explaining_auction";
  }

  if (state.activeIntent === "price_calc") {
    // ready_to_calculate ONLY if ALL required calc fields exist
    const hasModel = !!state.model;
    const hasPrice = state.auctionPriceJPY != null;
    const hasBudgetGuidance = state.budgetText === "approximate_guidance" || state.budgetDeclined;
    const hasVolume = state.volumeCm3 != null;
    const hasAge = state.year != null || state.ageWindow != null;
    const hasResale = state.isForResale != null;
    const hasEntity = state.isLegalEntity != null;
    const nonPassableOk =
      state.ageWindow !== "non_passable" || state.nonPassableType != null;

    // Allow ready_to_calculate with approximate_guidance (price range mode)
    if (hasModel && (hasPrice || hasBudgetGuidance) && hasVolume && hasAge && hasResale && hasEntity && nonPassableOk) {
      return "ready_to_calculate";
    }
    return "collecting_calc_params";
  }

  // car_search or has model set
  if (state.model || state.make || state.activeIntent === "car_search") {
    return "collecting_filters";
  }

  return "idle";
}

/** Build the single most important pending question based on stage + missing slots */
function buildPendingQuestion(state: ConversationState): string | null {
  if (state.stage === "idle") return null;

  // If explicit clarification is needed (e.g. non_passable type unknown)
  if (state.needsClarification.length > 0) {
    const field = state.needsClarification[0];
    if (field === "nonPassableType") {
      return "Непроходной — имеете в виду свежий (до 3 лет) или старше 5 лет?";
    }
    // Other clarification types fall through to stage-specific questions below
  }

  if (state.stage === "collecting_calc_params") {
    // Priority order: model → year → volumeCm3 → isForResale → isLegalEntity → budget (last, skipped if declined)
    if (!state.model) {
      return "Какую модель рассматриваете?";
    }
    if (!state.year && !state.ageWindow) {
      return "Какой год выпуска (или проходной/непроходной)?";
    }
    if (!state.volumeCm3) {
      return "Какой объём двигателя?";
    }
    if (state.isForResale == null && state.isLegalEntity == null) {
      return "Авто для себя (физлицо) или на юрлицо / для перепродажи?";
    }
    if (state.isForResale == null) {
      return "Авто для перепродажи или для себя?";
    }
    if (state.isLegalEntity == null) {
      return "Оформляете на физлицо или юрлицо?";
    }
    if (!state.auctionPriceJPY && !state.budgetText && !state.budgetDeclined) {
      return "Какой ориентир по бюджету или аукционной цене в йенах?";
    }
    return null;
  }

  if (state.stage === "collecting_filters") {
    // Don't ask if model + 2 filters are already known
    const filledFilterCount = [
      state.ageWindow, state.drivetrain, state.fuelType,
      state.trimLevel, state.color, state.year, state.budgetText,
      state.priority, state.auctionGradeMin,
    ].filter(v => v != null).length;

    if (state.model && filledFilterCount >= 2) {
      // Enough info — only ask critical missing if any
      if (!state.ageWindow && !state.year) {
        return "Какой возраст интересует — проходной (3–5 лет) или другой?";
      }
      if (!state.budgetText && !state.budgetDeclined) {
        return "Какой ориентир по бюджету?";
      }
      return null;
    }

    if (!state.model && !state.make) {
      return null; // LLM will ask naturally
    }
    return null;
  }

  return null;
}

/** Build a human-readable summary of known filters for the LLM context */
function buildKnownFiltersSummary(state: ConversationState): string {
  const parts: string[] = [];
  if (state.make && state.model) parts.push(`модель: ${state.make} ${state.model}`);
  else if (state.make) parts.push(`марка: ${state.make}`);
  else if (state.model) parts.push(`модель: ${state.model}`);

  if (state.ageWindow === "passable") parts.push("возраст: проходной (3–5 лет)");
  else if (state.ageWindow === "non_passable") {
    if (state.nonPassableType === "under_3_years") parts.push("возраст: непроходной (до 3 лет)");
    else if (state.nonPassableType === "over_5_years") parts.push("возраст: непроходной (старше 5 лет)");
    else parts.push("возраст: непроходной (тип НЕ уточнён!)");
  }
  if (state.year) parts.push(`год: ${state.year}`);

  if (state.drivetrain === "fwd") parts.push("привод: передний");
  else if (state.drivetrain === "rwd") parts.push("привод: задний");
  else if (state.drivetrain === "4wd") parts.push("привод: полный");

  if (state.fuelType === "gasoline") parts.push("топливо: бензин");
  else if (state.fuelType === "hybrid") parts.push("топливо: гибрид");
  else if (state.fuelType === "diesel") parts.push("топливо: дизель");
  else if (state.fuelType === "ev") parts.push("топливо: электро");

  if (state.trimLevel === "base") parts.push("комплектация: базовая");
  else if (state.trimLevel === "mid") parts.push("комплектация: средняя");
  else if (state.trimLevel === "top") parts.push("комплектация: максимальная");

  if (state.steering === "rhd") parts.push("руль: правый");
  else if (state.steering === "lhd") parts.push("руль: левый");

  if (state.color) parts.push(`цвет: ${state.color}`);
  if (state.budgetText) parts.push(`бюджет: ${state.budgetText}`);
  if (state.auctionPriceJPY) parts.push(`аукц. цена: ${state.auctionPriceJPY} йен`);
  if (state.volumeCm3) parts.push(`объём: ${state.volumeCm3} см³`);
  if (state.auctionGradeMin) parts.push(`мин. оценка: ${state.auctionGradeMin}`);
  if (state.auctionGradesAllowed.length > 0) parts.push(`допустимые оценки: ${state.auctionGradesAllowed.join(", ")}`);
  if (state.priority === "cheapest") parts.push("приоритет: подешевле");
  else if (state.priority === "best_condition") parts.push("приоритет: лучшее состояние");
  else if (state.priority === "balanced") parts.push("приоритет: баланс");

  if (state.isForResale != null) parts.push(state.isForResale ? "для перепродажи" : "для себя");
  if (state.isLegalEntity != null) parts.push(state.isLegalEntity ? "юрлицо" : "физлицо");
  if (state.mileageText) parts.push(`пробег: ${state.mileageText}`);

  // Slang-derived details
  if (state.body) parts.push(`кузов: ${state.body}`);
  if (state.transmission === "manual") parts.push("КПП: механика");
  else if (state.transmission === "automatic") parts.push("КПП: автомат");
  else if (state.transmission === "cvt") parts.push("КПП: вариатор");
  if (state.condition === "poor") parts.push("состояние: плохое");
  else if (state.condition === "decent") parts.push("состояние: живое");
  if (state.hasSunroof) parts.push("люк: да");
  if (state.hasClimate) parts.push("климат-контроль: да");
  if (state.manualWindows) parts.push("ручные стеклоподъёмники");
  if (state.turbo) parts.push("турбо");
  if (state.noRussiaMileage) parts.push("без пробега по РФ");
  if (state.excludedNegativeFlags.length > 0) {
    const flagLabels: Record<string, string> = {
      flood_damage: "не топляк",
      rollover_history: "не перевёртыш",
      cut_import: "не распил",
      constructor_import: "не конструктор",
      poor_condition: "не убитая",
    };
    const labels = state.excludedNegativeFlags.map(f => flagLabels[f] ?? f);
    parts.push(`исключено: ${labels.join(", ")}`);
  }
  if (state.sellerClaims.length > 0) {
    const claimTexts = state.sellerClaims.map(c => `продавец заявляет: ${c.original}`);
    parts.push(claimTexts.join("; "));
  }

  return parts.join("; ");
}

/**
 * Build CalcParams from conversation state.
 * Returns null if any required field is missing — does NOT fake values.
 * auctionPriceJPY is mandatory; budgetText is NOT a substitute.
 */
function buildCalcParamsFromState(state: ConversationState): CalcParams | null {
  if (state.auctionPriceJPY == null) return null;
  if (state.volumeCm3 == null) return null;
  if (state.isForResale == null) return null;
  if (state.isLegalEntity == null) return null;

  // Compute ageYears
  let ageYears: number | null = null;
  if (state.year != null) {
    ageYears = new Date().getFullYear() - state.year;
  } else if (state.ageWindow === "passable") {
    ageYears = 4; // middle of 3-5 range
  } else if (state.ageWindow === "non_passable" && state.nonPassableType === "under_3_years") {
    ageYears = 1;
  } else if (state.ageWindow === "non_passable" && state.nonPassableType === "over_5_years") {
    ageYears = 7;
  }
  if (ageYears == null) return null;

  // Determine vehicle type
  let vehicleType: CalcParams["vehicleType"] = "car";
  if (state.volumeCm3 > 1900) {
    vehicleType = "special_vehicle";
  }

  return {
    vehicleType,
    priceJPY: state.auctionPriceJPY,
    volumeCm3: state.volumeCm3,
    ageYears,
    isForResale: state.isForResale,
    isLegalEntity: state.isLegalEntity,
  };
}

/**
 * Get typical market auction price range (low / high) in JPY
 * based on engine volume and vehicle age.
 * Used when user says they don't know the budget — we provide a range.
 */
function getMarketPriceRangeJPY(volumeCm3: number, ageYears: number): { low: number; high: number } {
  // Ranges calibrated to Japanese auction market (2024-2026 data)
  if (ageYears <= 3) {
    // Fresh cars — higher prices
    if (volumeCm3 <= 1500) return { low: 800_000, high: 1_800_000 };
    if (volumeCm3 <= 1800) return { low: 1_000_000, high: 2_500_000 };
    return { low: 1_500_000, high: 3_500_000 };
  }
  if (ageYears <= 5) {
    // Passable window (3-5 years)
    if (volumeCm3 <= 1500) return { low: 400_000, high: 1_200_000 };
    if (volumeCm3 <= 1800) return { low: 600_000, high: 1_800_000 };
    return { low: 800_000, high: 2_500_000 };
  }
  // Older cars (5+ years)
  if (volumeCm3 <= 1500) return { low: 150_000, high: 700_000 };
  if (volumeCm3 <= 1800) return { low: 200_000, high: 1_000_000 };
  return { low: 300_000, high: 1_500_000 };
}

/**
 * Build CalcParams for price range estimation (approximate_guidance mode).
 * Returns low/high CalcParams. Returns null if required non-price fields are missing.
 */
function buildCalcParamsRange(state: ConversationState): { low: CalcParams; high: CalcParams } | null {
  if (state.volumeCm3 == null) return null;
  if (state.isForResale == null) return null;
  if (state.isLegalEntity == null) return null;

  let ageYears: number | null = null;
  if (state.year != null) {
    ageYears = new Date().getFullYear() - state.year;
  } else if (state.ageWindow === "passable") {
    ageYears = 4;
  } else if (state.ageWindow === "non_passable" && state.nonPassableType === "under_3_years") {
    ageYears = 1;
  } else if (state.ageWindow === "non_passable" && state.nonPassableType === "over_5_years") {
    ageYears = 7;
  }
  if (ageYears == null) return null;

  let vehicleType: CalcParams["vehicleType"] = "car";
  if (state.volumeCm3 > 1900) {
    vehicleType = "special_vehicle";
  }

  const range = getMarketPriceRangeJPY(state.volumeCm3, ageYears);

  return {
    low: {
      vehicleType,
      priceJPY: range.low,
      volumeCm3: state.volumeCm3,
      ageYears,
      isForResale: state.isForResale,
      isLegalEntity: state.isLegalEntity,
    },
    high: {
      vehicleType,
      priceJPY: range.high,
      volumeCm3: state.volumeCm3,
      ageYears,
      isForResale: state.isForResale,
      isLegalEntity: state.isLegalEntity,
    },
  };
}

/**
 * Deterministic reply planner — runs BEFORE the LLM.
 * Returns a list of questions/instructions to guide the reply.
 * If model is known, never asks about brand/model/type.
 * Asks only the top 1 missing field (strictly one question at a time).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function planReply(state: ConversationState, _userMessage: string): string[] {
  const hints: string[] = [];

  // If model is known, confirm it and never ask about brand/model/type
  if (state.model) {
    hints.push(`Модель определена: ${state.make ?? ""} ${state.model}. НЕ спрашивай бренд/модель/тип.`);
  }

  // Collect missing critical fields (max 1 — strictly one question at a time)
  const missingCritical: string[] = [];

  if (state.activeIntent === "price_calc") {
    // Priority 1: nonPassableType — blocks age computation and is quick to answer
    if (state.ageWindow === "non_passable" && state.nonPassableType == null) {
      missingCritical.push("непроходной: свежий (до 3 лет) или старый (старше 5 лет)");
    }
    if (state.year == null && state.ageWindow == null) {
      missingCritical.push("год выпуска или возрастное окно");
    }
    // Priority 2: volumeCm3
    if (state.volumeCm3 == null) {
      missingCritical.push("объём двигателя");
    }
    // Priority 3: drivetrain
    if (state.drivetrain == null) {
      missingCritical.push("какой привод — передний, задний или полный");
    }
    // Priority 4: isForResale / isLegalEntity
    if (state.isForResale == null) {
      missingCritical.push("для перепродажи или нет");
    }
    if (state.isLegalEntity == null) {
      missingCritical.push("физлицо или юрлицо");
    }
    // Priority 5: budget — LAST and skipped if budgetDeclined
    if (state.auctionPriceJPY == null && !state.budgetText && !state.budgetDeclined) {
      missingCritical.push("бюджет или аукционная цена в йенах");
    }
  } else if (state.activeIntent === "car_search") {
    if (!state.model && !state.make) {
      missingCritical.push("модель или марка");
    }
    if (state.year == null && state.ageWindow == null) {
      missingCritical.push("возрастное окно или год");
    }
    if (!state.budgetText && !state.budgetDeclined) {
      missingCritical.push("бюджет");
    }
  }

  // Only top 1 — strictly one clarifying question at a time
  const top = missingCritical.slice(0, 1);
  if (top.length > 0) {
    hints.push(`Спроси ТОЛЬКО: ${top[0]}.`);
  }

  return hints;
}

/**
 * Post-reply guard: checks if the reply violates known-model constraints.
 * Returns true if the reply contains forbidden questions about model/brand
 * when the model is already known.
 */
function violatesKnownModelGuard(reply: string, state: ConversationState): boolean {
  if (!state.model) return false;
  const lower = reply.toLowerCase();
  const forbidden = [
    "какая марка",
    "какая модель",
    "какой автомобиль вас интересует",
    "что вы имеете в виду",
    "какой бренд",
    "какую марку",
    "какую модель",
    "какой тип техники",
    "что вас интересует",
    "какую машину",
    "какой автомобиль вы",
    "какой кроссовер",
    "какой внедорожник",
    "какой транспорт",
    "что именно вас интересует",
    "что именно вы ищете",
    "какой вид техники",
    "расскажите, что вас",
    "что вы хотите найти",
    "какое авто",
    "какой авто",
    "легковой, мотоцикл",
    "легковой автомобиль, мотоцикл",
  ];
  return forbidden.some(phrase => lower.includes(phrase));
}

/**
 * Response validation: checks if the reply contradicts known parsed state.
 * Returns true if the reply contains false claims or re-asks known slots.
 */
function replyContradictsState(reply: string, state: ConversationState): boolean {
  const lower = reply.toLowerCase();

  // 1. If model is known, reply must not call it a brand/type or say it's unclear
  if (state.model) {
    const modelLower = state.model.toLowerCase();
    const brandClaims = [
      `${modelLower} — это бренд`, `${modelLower} - это бренд`,
      `${modelLower} это бренд`, `${modelLower} является брендом`,
      `${modelLower} — это марка`, `${modelLower} - это марка`,
      `${modelLower} это марка`, `${modelLower} является маркой`,
    ];
    if (brandClaims.some(p => lower.includes(p))) return true;

    const modelUnclear = [
      "не понял какую модель", "какую модель вы имеете",
      "уточните модель", "какая именно модель",
    ];
    if (modelUnclear.some(p => lower.includes(p))) return true;
  }

  // 2. If ageWindow=non_passable, reply must not redefine it as mileage/condition
  //    e.g. "непроходной означает малый пробег" — wrong; it means customs age window
  if (state.ageWindow === "non_passable") {
    if (
      /(?:непроходн|не\s*проходн)[а-яё]*\s[^.]*?(?:пробег|состояни|километр|малый\s+пробег|хорош[а-яё]*\s+состояни)/i.test(reply)
    ) {
      return true;
    }
  }

  // 3. If drivetrain known, reply should not re-ask about it
  if (state.drivetrain) {
    const driveQuestions = [
      "какой привод", "какую систему привода",
      "полный привод или передний", "передний или полный",
      "какой тип привода", "полный или передний привод",
    ];
    if (driveQuestions.some(p => lower.includes(p))) return true;
  }

  // 4. If trimLevel known, reply should not re-ask about it
  if (state.trimLevel) {
    const trimQuestions = [
      "какая комплектация", "какую комплектацию",
      "базовую или максимальную", "базовая или максимальная",
      "какой уровень оснащения",
    ];
    if (trimQuestions.some(p => lower.includes(p))) return true;
  }

  // 5. If budget is declined (user said "не знаю бюджет"), reply should not re-ask about it
  if (state.budgetDeclined || state.budgetText === "approximate_guidance") {
    const budgetQuestions = [
      "какой бюджет", "какой ориентир по бюджету",
      "какой бюджет или цена", "какая сумма",
      "в каком бюджете", "на какую сумму",
      "сколько готовы потратить", "сколько планируете",
    ];
    if (budgetQuestions.some(p => lower.includes(p))) return true;
  }

  // 6. If nonPassableType known, reply should not re-ask about it
  if (state.nonPassableType) {
    const ageQuestions = [
      "свежий или старый", "до 3 лет или старше 5",
      "нужен вариант до 3 лет или старше",
      "свежий (до 3 лет) или старше",
      "какой непроходной",
    ];
    if (ageQuestions.some(p => lower.includes(p))) return true;
  }

  // 7. If isForResale and isLegalEntity are both known, reply should not re-ask about ownership
  if (state.isForResale != null && state.isLegalEntity != null) {
    const ownershipQuestions = [
      "физлицо или юрлицо", "юрлицо или физлицо",
      "для перепродажи или для себя", "для себя или для перепродажи",
      "оформление на физлицо",
      "физлицо, юрлицо или под перепродажу",
    ];
    if (ownershipQuestions.some(p => lower.includes(p))) return true;
  }

  return false;
}

/**
 * Deterministic fallback response builder.
 * Used when LLM reply contradicts parsed state.
 * Confirms known slots and asks only calc-critical missing fields.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function buildSafeFallbackReply(state: ConversationState, _plan: string[]): string {
  const parts: string[] = [];

  // ── Collect known filter descriptions ──
  const knownParts: string[] = [];

  if (state.ageWindow === "non_passable") {
    if (state.nonPassableType === "under_3_years") knownParts.push("непроходной (до 3 лет)");
    else if (state.nonPassableType === "over_5_years") knownParts.push("непроходной (старше 5 лет)");
    else knownParts.push("непроходной");
  } else if (state.ageWindow === "passable") {
    knownParts.push("проходной (3–5 лет)");
  }
  if (state.year) knownParts.push(`${state.year} год`);

  if (state.drivetrain === "fwd") knownParts.push("передний привод");
  else if (state.drivetrain === "rwd") knownParts.push("задний привод");
  else if (state.drivetrain === "4wd") knownParts.push("полный привод");

  if (state.trimLevel === "base") knownParts.push("самая простая комплектация");
  else if (state.trimLevel === "mid") knownParts.push("средняя комплектация");
  else if (state.trimLevel === "top") knownParts.push("топовая комплектация");

  if (state.auctionGradesAllowed.length > 0) {
    knownParts.push(`оценка ${state.auctionGradesAllowed.join(", ")} допустима`);
  }
  if (state.auctionGradeMin) knownParts.push(`оценка от ${state.auctionGradeMin}`);

  if (state.fuelType === "hybrid") knownParts.push("гибрид");
  else if (state.fuelType === "diesel") knownParts.push("дизель");
  else if (state.fuelType === "ev") knownParts.push("электро");

  if (state.color) knownParts.push(state.color);
  if (state.budgetText && state.budgetText !== "approximate_guidance") knownParts.push(`бюджет: ${state.budgetText}`);
  if (state.budgetText === "approximate_guidance" || state.budgetDeclined) knownParts.push("рассчитаю по среднерыночным ценам");
  if (state.auctionPriceJPY) knownParts.push(`аукц. цена: ${state.auctionPriceJPY} йен`);
  if (state.volumeCm3) knownParts.push(`объём: ${state.volumeCm3} см³`);
  if (state.isForResale != null) knownParts.push(state.isForResale ? "для перепродажи" : "для себя");
  if (state.isLegalEntity != null) knownParts.push(state.isLegalEntity ? "юрлицо" : "физлицо");
  // Only show priority if it adds info beyond trimLevel
  if (state.priority === "cheapest" && state.trimLevel !== "base") knownParts.push("подешевле");
  else if (state.priority === "best_condition") knownParts.push("лучшее состояние");

  // Slang-derived details in confirmation
  if (state.body) knownParts.push(`кузов: ${state.body}`);
  if (state.transmission === "manual") knownParts.push("механика");
  else if (state.transmission === "automatic") knownParts.push("автомат");
  else if (state.transmission === "cvt") knownParts.push("вариатор");
  if (state.hasSunroof) knownParts.push("с люком");
  if (state.hasClimate) knownParts.push("климат-контроль");
  if (state.manualWindows) knownParts.push("ручные стеклоподъёмники");
  if (state.turbo) knownParts.push("турбо");
  if (state.noRussiaMileage) knownParts.push("без пробега по РФ");
  if (state.condition === "decent") knownParts.push("живое состояние");
  if (state.excludedNegativeFlags.length > 0) {
    const flagLabels: Record<string, string> = {
      flood_damage: "не топляк",
      rollover_history: "не перевёртыш",
      cut_import: "не распил",
      constructor_import: "не конструктор",
      poor_condition: "не убитая",
    };
    const labels = state.excludedNegativeFlags.map(f => flagLabels[f] ?? f);
    knownParts.push(labels.join(", "));
  }
  // Seller claims — cautious language
  if (state.sellerClaims.length > 0) {
    for (const claim of state.sellerClaims) {
      knownParts.push(`продавец заявляет: ${claim.original}`);
    }
  }

  // ── Build confirmation line ──
  const modelName = state.model
    ? (state.make ? `${state.make} ${state.model}` : state.model)
    : state.make ?? null;

  if (modelName && knownParts.length > 0) {
    parts.push(`По ${modelName} понял: ${knownParts.join(", ")}.`);
  } else if (modelName) {
    parts.push(`По ${modelName} — понял.`);
  } else if (knownParts.length > 0) {
    parts.push(`Понял: ${knownParts.join(", ")}.`);
  }

  // ── Build missing calc-critical fields ──
  const missingQuestions: string[] = [];
  const isBudgetGuidanceMode = state.budgetText === "approximate_guidance" || state.budgetDeclined;

  if (state.activeIntent === "price_calc") {
    // Priority 1: nonPassableType
    if (state.ageWindow === "non_passable" && !state.nonPassableType) {
      missingQuestions.push("нужен вариант до 3 лет или старше 5 лет");
    }
    if (!state.year && !state.ageWindow) {
      missingQuestions.push("какой год или возрастная категория");
    }
    // Priority 2: volumeCm3
    if (!state.volumeCm3) {
      missingQuestions.push("какой объём двигателя");
    }
    // Priority 3: drivetrain
    if (!state.drivetrain) {
      missingQuestions.push("какой привод — передний, задний или полный");
    }
    // Priority 4: isForResale / isLegalEntity
    if (state.isForResale == null && state.isLegalEntity == null) {
      missingQuestions.push("оформление на физлицо, юрлицо или под перепродажу");
    } else {
      if (state.isForResale == null) missingQuestions.push("для перепродажи или для себя");
      if (state.isLegalEntity == null) missingQuestions.push("физлицо или юрлицо");
    }
    // Priority 5: budget — LAST and skipped if budgetDeclined
    if (!state.auctionPriceJPY && !state.budgetText && !state.budgetDeclined) {
      missingQuestions.push("какой бюджет или цена покупки в йенах");
    }
  } else if (state.activeIntent === "car_search") {
    if (!state.model && !state.make) {
      missingQuestions.push("какая модель или марка");
    }
    if (!state.year && !state.ageWindow) {
      missingQuestions.push("какой возраст или год");
    }
    if (!state.budgetText && !state.budgetDeclined) {
      missingQuestions.push("какой бюджет");
    }
  }

  if (isBudgetGuidanceMode && missingQuestions.length === 0) {
    if (state.calculationDone) {
      parts.push("Расчёт по среднерыночным ценам уже выполнен. Если хотите уточнить — напишите новые параметры.");
    } else {
      // All other slots are filled — auto-calculate with market price range
      parts.push("Сейчас рассчитаю по среднерыночным ценам и дам диапазон стоимости.");
    }
  } else if (missingQuestions.length > 0) {
    // Strictly ONE question at a time
    parts.push(`Уточни, пожалуйста: ${missingQuestions[0]}.`);
  } else if (state.calculationDone) {
    parts.push("Расчёт уже выполнен. Если хотите пересчитать с другими параметрами — напишите новые данные.");
  } else if (state.stage === "ready_to_calculate") {
    parts.push("Все данные есть, сейчас посчитаю.");
  }

  return parts.join(" ") || "Расскажите подробнее, что именно вас интересует?";
}

interface ConversationEntry {
  summary: string;
  messages: ChatMessage[];
  lastActivity: number;
  state: ConversationState;
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
    entry = {
      summary: "",
      messages: [],
      lastActivity: Date.now(),
      state: { ...DEFAULT_CONVERSATION_STATE, auctionGradesAllowed: [], needsClarification: [], slotMeta: {} },
    };
    conversations.set(userId, entry);
  }
  entry.lastActivity = Date.now();
  return entry;
}

/** Detect short follow-up messages that refine the current car, not a fresh search */
function isFollowUpFilter(message: string): boolean {
  const trimmed = message.trim();
  // Short messages (under ~80 chars) that don't name a new car model are likely follow-ups
  if (trimmed.length > 80) return false;
  const followUpPatterns = [
    /^(любой|любая|любое)(?![а-яёА-ЯЁa-zA-Z0-9])/i,
    /^(максималка|максимальная|жирная|база|попроще|средняя)/i,
    /^(тогда|а |ну |ок|ладно|давай|хорошо)/i,
    /^(вд|полный|передний|задний)/i,
    /^(светл|тёмн|темн|бел|черн|серебр|серый)/i,
    /^(проходн|непроходн|не проходн|свеж|стар)/i,
    /^(гибрид|бензин|дизель|электр)/i,
    /^R\b/i,
    /^(оценк|оценка)(?![а-яёА-ЯЁa-zA-Z0-9])/i,
    /^(можно|допустим|подойд|пойд|годит)/i,
    /^(да|нет|угу|ага|не надо|не нужн)/i,
    /^(бюджет|до \d|в пределах)/i,
    /^(посчитай|рассчитай|считай|можешь посчитать)/i,
    /^(а проходн|а что по|а если|а можно)/i,
  ];
  return followUpPatterns.some((p) => p.test(trimmed));
}

/**
 * On model switch, clear all model-dependent slots.
 * Preserve only: budgetText, isForResale, isLegalEntity.
 * SlotMeta is preserved only for the global fields that survive.
 */
function clearStateForModelSwitch(previous: ConversationState): ConversationState {
  const preservedMetaKeys: SlotKey[] = ["budgetText", "isForResale", "isLegalEntity"];
  const keptMeta: Partial<Record<SlotKey, SlotMeta>> = {};
  for (const key of preservedMetaKeys) {
    if (previous.slotMeta[key]) keptMeta[key] = previous.slotMeta[key];
  }

  return {
    ...previous,
    generation: null,
    body: null,
    year: null,
    yearText: null,
    ageWindow: null,
    nonPassableType: null,
    drivetrain: null,
    steering: null,
    fuelType: null,
    trimLevel: null,
    color: null,
    mileageText: null,
    auctionGradeMin: null,
    auctionGradesAllowed: [],
    auctionPriceJPY: null,
    volumeCm3: null,
    priority: null,
    calculationDone: false,
    pendingQuestion: null,
    needsClarification: [],
    // budgetText, isForResale, isLegalEntity are preserved via spread
    slotMeta: keptMeta,
  };
}

/** Map extraction source to default confidence */
function sourceConfidence(src: "regex" | "llm" | "user_explicit"): "high" | "medium" {
  return src === "regex" || src === "user_explicit" ? "high" : "medium";
}

/**
 * Filter out LLM-proposed slots that would overwrite existing regex/high-confidence data.
 * LLM may only fill empty slots or replace low-confidence ones.
 */
function applyLlmOverwriteProtection(
  llmSet: Partial<ConversationState>,
  existingState: ConversationState,
): Partial<ConversationState> {
  const filtered: Partial<ConversationState> = { ...llmSet };
  const protectedKeys: SlotKey[] = [
    "model", "make", "generation", "body",
    "year", "ageWindow", "nonPassableType",
    "drivetrain", "steering", "fuelType", "trimLevel",
    "color", "mileageText", "auctionGradeMin",
    "budgetText", "auctionPriceJPY", "volumeCm3",
    "priority", "isForResale", "isLegalEntity",
  ];
  for (const key of protectedKeys) {
    const meta = existingState.slotMeta[key];
    if (!meta) continue; // slot is empty — LLM may fill
    if (meta.confidence === "high" || meta.source === "regex" || meta.source === "user_explicit") {
      // existing slot is high-confidence / regex — LLM must not overwrite
      delete (filtered as Record<string, unknown>)[key];
    }
  }
  return filtered;
}

/**
 * Apply a state update to the persistent conversation state.
 *
 * Pipeline:
 * 1. Detect model switch → reset dependent slots
 * 2. Apply clearFields (deterministic clears for "любой цвет" etc.)
 * 3. Apply set values
 * 4. Derive implied state
 * 5. Recompute needsClarification from scratch
 * 6. Derive stage from scratch
 * 7. Build pendingQuestion
 */
function applyStateUpdate(
  previous: ConversationState,
  update: StateUpdate,
  source: "regex" | "llm" | "user_explicit",
): ConversationState {
  const nextTurn = previous.turnIndex + 1;
  const { set: current, clearFields } = update;

  // ── Intent resolution ──
  // "price_calc" is sticky: once the user says "посчитай", adding more filters
  // (which auto-infers "car_search") should NOT downgrade the intent.
  // Only an explicit new intent (price_calc, auction_explanation) can override.
  const currentIntent = current.activeIntent ?? "other";
  let effectiveIntent: ConversationState["activeIntent"];
  if (currentIntent === "other") {
    // No explicit intent in this message — keep previous
    effectiveIntent = previous.activeIntent;
  } else if (currentIntent === "car_search" && previous.activeIntent === "price_calc") {
    // Don't downgrade price_calc to car_search — user just added more filters
    effectiveIntent = "price_calc";
  } else {
    effectiveIntent = currentIntent;
  }

  // Helper: pick current value if non-null/undefined, otherwise keep previous
  const pick = <T>(prev: T | null, cur: T | null | undefined): T | null =>
    cur !== undefined && cur !== null ? cur : prev;

  // ── Model switch detection ──
  const incomingModel = current.model ?? null;
  const isModelSwitch =
    incomingModel != null &&
    previous.model != null &&
    incomingModel.toLowerCase() !== previous.model.toLowerCase();

  // ── Step 1: Start from previous or model-switch-reset base ──
  let base: ConversationState;
  if (isModelSwitch) {
    base = clearStateForModelSwitch(previous);
  } else {
    base = { ...previous, slotMeta: { ...previous.slotMeta } };
  }

  // ── Step 2: Apply clearFields (deterministic clears) ──
  for (const field of clearFields) {
    if (field === "auctionGradesAllowed") {
      base.auctionGradesAllowed = [];
    } else {
      base[field] = null;
    }
    delete base.slotMeta[field];
  }

  // ── Step 3: Build merged slot meta ──
  const mergedSlotMeta: Partial<Record<SlotKey, SlotMeta>> = { ...base.slotMeta };
  const trackSlot = (key: SlotKey, val: unknown): void => {
    if (val !== undefined && val !== null) {
      mergedSlotMeta[key] = {
        source, confidence: sourceConfidence(source), turnIndex: nextTurn,
      };
    }
  };
  trackSlot("model", current.model);
  trackSlot("make", current.make);
  trackSlot("generation", current.generation);
  trackSlot("body", current.body);
  trackSlot("year", current.year);
  trackSlot("ageWindow", current.ageWindow);
  trackSlot("nonPassableType", current.nonPassableType);
  trackSlot("drivetrain", current.drivetrain);
  trackSlot("steering", current.steering);
  trackSlot("fuelType", current.fuelType);
  trackSlot("trimLevel", current.trimLevel);
  trackSlot("color", current.color);
  trackSlot("mileageText", current.mileageText);
  trackSlot("auctionGradeMin", current.auctionGradeMin);
  trackSlot("budgetText", current.budgetText);
  trackSlot("auctionPriceJPY", current.auctionPriceJPY);
  trackSlot("volumeCm3", current.volumeCm3);
  trackSlot("priority", current.priority);
  trackSlot("isForResale", current.isForResale);
  trackSlot("isLegalEntity", current.isLegalEntity);

  // Merge arrays by union (deduplicated)
  const mergeArrays = (prev: string[], cur: string[] | undefined): string[] => {
    if (!cur || cur.length === 0) return prev;
    const set = new Set([...prev, ...cur]);
    return [...set];
  };

  // Merge seller claims by meaning (deduplicated by meaning field)
  const mergeSellerClaims = (prev: SellerClaim[], cur: SellerClaim[]): SellerClaim[] => {
    if (cur.length === 0) return prev;
    const seen = new Set(prev.map(c => c.meaning));
    const merged = [...prev];
    for (const claim of cur) {
      if (!seen.has(claim.meaning)) {
        merged.push(claim);
        seen.add(claim.meaning);
      }
    }
    return merged;
  };

  // For model/make: never erase if current omitted them
  const model = current.model ?? base.model;
  const make = current.make ?? base.make;

  // ── Step 4: Assemble merged state ──
  const merged: ConversationState = {
    stage: base.stage, // will be recomputed
    activeIntent: effectiveIntent,
    model,
    make,
    generation: pick(base.generation, current.generation),
    body: pick(base.body, current.body),
    year: pick(base.year, current.year),
    yearText: pick(base.yearText, current.yearText),
    ageWindow: pick(base.ageWindow, current.ageWindow),
    nonPassableType: pick(base.nonPassableType, current.nonPassableType),
    drivetrain: pick(base.drivetrain, current.drivetrain),
    steering: pick(base.steering, current.steering),
    fuelType: pick(base.fuelType, current.fuelType),
    trimLevel: pick(base.trimLevel, current.trimLevel),
    color: pick(base.color, current.color),
    mileageText: pick(base.mileageText, current.mileageText),
    auctionGradeMin: pick(base.auctionGradeMin, current.auctionGradeMin),
    auctionGradesAllowed: mergeArrays(base.auctionGradesAllowed, current.auctionGradesAllowed),
    budgetText: pick(base.budgetText, current.budgetText),
    budgetDeclined: current.budgetDeclined || base.budgetDeclined,
    auctionPriceJPY: pick(base.auctionPriceJPY, current.auctionPriceJPY),
    volumeCm3: pick(base.volumeCm3, current.volumeCm3),
    isForResale: pick(base.isForResale, current.isForResale),
    isLegalEntity: pick(base.isLegalEntity, current.isLegalEntity),
    priority: pick(base.priority, current.priority),
    calculationDone: base.calculationDone,
    pendingQuestion: null, // will be recomputed
    needsClarification: [], // will be recomputed
    lastResolvedModelAlias: current.lastResolvedModelAlias ?? base.lastResolvedModelAlias,
    turnIndex: nextTurn,
    slotMeta: mergedSlotMeta,
    // Slang-derived fields
    transmission: pick(base.transmission, current.transmission),
    condition: pick(base.condition, current.condition),
    hasSunroof: current.hasSunroof || base.hasSunroof,
    hasClimate: current.hasClimate || base.hasClimate,
    manualWindows: current.manualWindows || base.manualWindows,
    turbo: current.turbo || base.turbo,
    noRussiaMileage: current.noRussiaMileage || base.noRussiaMileage,
    sellerClaims: mergeSellerClaims(base.sellerClaims, current.sellerClaims ?? []),
    excludedNegativeFlags: mergeArrays(base.excludedNegativeFlags, current.excludedNegativeFlags ?? []),
  };

  // ── Step 5–7: Post-merge pipeline ──
  const explicitKeys = new Set(
    (Object.keys(current) as Array<keyof typeof current>).filter(
      k => current[k] !== undefined && current[k] !== null,
    ),
  );
  deriveImpliedState(merged, explicitKeys);
  merged.needsClarification = computeNeedsClarification(merged);
  merged.stage = deriveStage(merged);
  merged.pendingQuestion = buildPendingQuestion(merged);

  // ── Reset calculationDone when calc-critical fields change ──
  if (merged.calculationDone) {
    const calcCriticalKeys: Array<keyof typeof current> = [
      "auctionPriceJPY", "volumeCm3", "isForResale", "isLegalEntity",
      "year", "ageWindow", "nonPassableType", "model",
    ];
    const calcFieldChanged = calcCriticalKeys.some(k =>
      current[k] !== undefined && current[k] !== null,
    );
    if (calcFieldChanged || isModelSwitch) {
      merged.calculationDone = false;
    }
  }

  return merged;
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
    "Compress this conversation into a short factual memory for a vehicle import sales assistant.",
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

// ── Deterministic parser (primary — no LLM) ──────────────

/** Slang-to-model dictionary. Keys are lowercase, NFD-normalized. */
const MODEL_SLANG: Array<{ patterns: RegExp; make: string; model: string | null }> = [
  // Honda
  { patterns: cyrb(/\b(?:везел[аеёо]?|визел[аеёо]?|везёл[аеёо]?)\b/i), make: "Honda", model: "Vezel" },
  { patterns: cyrb(/\b(?:фит|фита)\b/i), make: "Honda", model: "Fit" },
  { patterns: cyrb(/\b(?:цээрвух[аи]?|cr-?v)\b/i), make: "Honda", model: "CR-V" },
  { patterns: cyrb(/\b(?:ашэрвух[аи]?|hr-?v)\b/i), make: "Honda", model: "HR-V" },
  { patterns: cyrb(/\b(?:шаттл|фит\s*шаттл)\b/i), make: "Honda", model: "Fit Shuttle" },
  // Toyota
  { patterns: cyrb(/\b(?:харе[кг]|харьк[аи]?)\b/i), make: "Toyota", model: "Harrier" },
  { patterns: cyrb(/\b(?:филдер[аи]?)\b/i), make: "Toyota", model: "Corolla Fielder" },
  { patterns: cyrb(/\b(?:приус[аеёо]?|prius)\b/i), make: "Toyota", model: "Prius" },
  { patterns: cyrb(/\b(?:прадик[аи]?|prado)\b/i), make: "Toyota", model: "Land Cruiser Prado" },
  { patterns: cyrb(/\b(?:вокси|вокс)\b/i), make: "Toyota", model: "Voxy" },
  { patterns: cyrb(/\b(?:ноах|ной)\b/i), make: "Toyota", model: "Noah" },
  { patterns: cyrb(/\b(?:рав(?:чик)?|рав\s*4|rav\s*4)\b/i), make: "Toyota", model: "RAV4" },
  { patterns: cyrb(/\b(?:камр(?:и|юх[аи]?))\b/i), make: "Toyota", model: "Camry" },
  { patterns: cyrb(/\b(?:краун)\b/i), make: "Toyota", model: "Crown" },
  { patterns: cyrb(/\b(?:крузак[аи]?)\b/i), make: "Toyota", model: "Land Cruiser" },
  { patterns: cyrb(/\b(?:сиента)\b/i), make: "Toyota", model: "Sienta" },
  { patterns: cyrb(/\b(?:пассо)\b/i), make: "Toyota", model: "Passo" },
  { patterns: cyrb(/\b(?:танк)\b/i), make: "Toyota", model: "Tank" },
  { patterns: cyrb(/\b(?:руми)\b/i), make: "Toyota", model: "Roomy" },
  { patterns: cyrb(/\b(?:виш)\b/i), make: "Toyota", model: "Wish" },
  { patterns: cyrb(/\b(?:суксид)\b/i), make: "Toyota", model: "Succeed" },
  { patterns: cyrb(/\b(?:пробокс)\b/i), make: "Toyota", model: "Probox" },
  { patterns: cyrb(/\b(?:рактис)\b/i), make: "Toyota", model: "Ractis" },
  { patterns: cyrb(/\b(?:марк)\b/i), make: "Toyota", model: "Mark II" },
  { patterns: cyrb(/\b(?:чайзер|чайник)\b/i), make: "Toyota", model: "Chaser" },
  // Nissan
  { patterns: cyrb(/\b(?:серена)\b/i), make: "Nissan", model: "Serena" },
  { patterns: cyrb(/\b(?:эльгранд)\b/i), make: "Nissan", model: "Elgrand" },
  { patterns: cyrb(/\b(?:виноград)\b/i), make: "Nissan", model: "Wingroad" },
  { patterns: cyrb(/\b(?:ad|адэха)\b/i), make: "Nissan", model: "AD" },
  // Subaru
  { patterns: cyrb(/\b(?:форик|форестер|форесрер)\b/i), make: "Subaru", model: "Forester" },
  // Mitsubishi
  { patterns: cyrb(/\b(?:паджер(?:о|ик)|пыжик)\b/i), make: "Mitsubishi", model: "Pajero" },
  // Suzuki
  { patterns: cyrb(/\b(?:эскуд(?:о|ик))\b/i), make: "Suzuki", model: "Escudo" },
  // Lexus (make only)
  { patterns: cyrb(/\b(?:лось)\b/i), make: "Lexus", model: null },
];

/** Explicit make names (full brand match) */
const MAKE_PATTERNS: Array<{ pattern: RegExp; make: string }> = [
  { pattern: cyrb(/\b(?:тойота|toyota)\b/i), make: "Toyota" },
  { pattern: cyrb(/\b(?:хонда|honda)\b/i), make: "Honda" },
  { pattern: cyrb(/\b(?:ниссан|nissan)\b/i), make: "Nissan" },
  { pattern: cyrb(/\b(?:субару|subaru)\b/i), make: "Subaru" },
  { pattern: cyrb(/\b(?:мицубиси|мицубиши|mitsubishi)\b/i), make: "Mitsubishi" },
  { pattern: cyrb(/\b(?:мазда|mazda)\b/i), make: "Mazda" },
  { pattern: cyrb(/\b(?:сузуки|suzuki)\b/i), make: "Suzuki" },
  { pattern: cyrb(/\b(?:лексус|lexus)\b/i), make: "Lexus" },
  { pattern: cyrb(/\b(?:инфинити|infiniti)\b/i), make: "Infiniti" },
  { pattern: cyrb(/\b(?:дайхатсу|daihatsu)\b/i), make: "Daihatsu" },
];

/** Explicit model names (when user types full model name) */
const EXPLICIT_MODEL_PATTERNS: Array<{ pattern: RegExp; make: string; model: string }> = [
  { pattern: /\b(?:vezel)\b/i, make: "Honda", model: "Vezel" },
  { pattern: /\b(?:harrier)\b/i, make: "Toyota", model: "Harrier" },
  { pattern: /\b(?:fielder)\b/i, make: "Toyota", model: "Corolla Fielder" },
  { pattern: /\b(?:forester)\b/i, make: "Subaru", model: "Forester" },
  { pattern: /\b(?:voxy)\b/i, make: "Toyota", model: "Voxy" },
  { pattern: /\b(?:noah)\b/i, make: "Toyota", model: "Noah" },
  { pattern: /\b(?:serena)\b/i, make: "Nissan", model: "Serena" },
  { pattern: /\b(?:camry)\b/i, make: "Toyota", model: "Camry" },
  { pattern: /\b(?:crown)\b/i, make: "Toyota", model: "Crown" },
  { pattern: /\b(?:pajero)\b/i, make: "Mitsubishi", model: "Pajero" },
];

/** Color dictionary */
const COLOR_PATTERNS: Array<{ pattern: RegExp; color: string }> = [
  { pattern: cyrb(/\b(?:любой\s+светл|светл[аыйое])/i), color: "light" },
  { pattern: cyrb(/\b(?:бел[аыйое])/i), color: "белый" },
  { pattern: cyrb(/\b(?:серебрист[аыйое])/i), color: "серебристый" },
  { pattern: cyrb(/\b(?:сер[аыйое])\b/i), color: "серый" },
  { pattern: cyrb(/\b(?:черн[аыйое]|чёрн[аыйое])/i), color: "чёрный" },
  { pattern: cyrb(/\b(?:синь|син[аыйиое])/i), color: "синий" },
  { pattern: cyrb(/\b(?:красн[аыйое])/i), color: "красный" },
  { pattern: cyrb(/\b(?:бежев[аыйое])/i), color: "бежевый" },
  { pattern: cyrb(/\b(?:любой\s+тёмн|любой\s+темн|тёмн[аыйое]|темн[аыйое])/i), color: "dark" },
  { pattern: cyrb(/\b(?:зелён[аыйое]|зелен[аыйое])/i), color: "зелёный" },
  { pattern: cyrb(/\b(?:перламутр)/i), color: "перламутр" },
];

/**
 * Deterministic state extractor — regex/dictionary based.
 * This is the PRIMARY parser. No LLM calls.
 */
function extractStateUpdate(
  userMessage: string,
  previousState: ConversationState,
): StateUpdate {
  // ── Slang normalization pass ──
  // Apply auto-slang normalization BEFORE lowering — preserves case for model matching
  const slangNormalized = normalizeAutoSlang(userMessage);

  let msg = slangNormalized.toLowerCase().replace(/ё/g, "е");

  // ── Russian numeric word normalization ──
  // Normalize Russian number words to digits so downstream regexes work uniformly.
  msg = msg
    .replace(/(?<![а-яА-Яa-zA-Z])полторашк[а-яё]*/gi, "1.5 л")
    .replace(/(?<![а-яА-Яa-zA-Z])полтора(?![а-яА-Яa-zA-Z])/gi, "1.5")
    .replace(/(?<![а-яА-Яa-zA-Z])трех(?:летк[а-яё]*)/gi, "до 3 лет")
    .replace(/(?<![а-яА-Яa-zA-Z])(?:трех|трёх)(?![а-яА-Яa-zA-Z])/gi, "3")
    .replace(/(?<![а-яА-Яa-zA-Z])(?:пяти|пять)(?![а-яА-Яa-zA-Z])/gi, "5");

  const update: Partial<ConversationState> = {};
  const clearFields: ClearableField[] = [];

  // ── Extract slang signals from the ORIGINAL text (before normalization) ──
  const slangSignals = extractSlangSignals(userMessage);
  const sellerClaims = extractSellerClaimSignals(userMessage);
  const excludedNegFlags = extractExcludedNegativeFlags(userMessage);

  // Apply slang signals to update (only if detected)
  if (slangSignals.transmission) {
    update.transmission = slangSignals.transmission;
  }
  if (slangSignals.drivetrain) {
    update.drivetrain = slangSignals.drivetrain;
  }
  if (slangSignals.trimLevel) {
    update.trimLevel = slangSignals.trimLevel;
  }
  if (slangSignals.fuelType) {
    update.fuelType = slangSignals.fuelType;
  }
  if (slangSignals.steering) {
    update.steering = slangSignals.steering;
  }
  if (slangSignals.body) {
    update.body = slangSignals.body;
  }
  if (slangSignals.condition) {
    update.condition = slangSignals.condition;
  }
  if (slangSignals.hasSunroof) {
    update.hasSunroof = true;
  }
  if (slangSignals.hasClimate) {
    update.hasClimate = true;
  }
  if (slangSignals.manualWindows) {
    update.manualWindows = true;
  }
  if (slangSignals.turbo) {
    update.turbo = true;
  }
  if (slangSignals.noRussiaMileage) {
    update.noRussiaMileage = true;
  }
  if (slangSignals.engineVolume) {
    update.volumeCm3 = Math.round(slangSignals.engineVolume * 1000);
  }
  if (slangSignals.isForResale != null) {
    update.isForResale = slangSignals.isForResale;
  }
  if (slangSignals.isLegalEntity != null) {
    update.isLegalEntity = slangSignals.isLegalEntity;
  }
  if (slangSignals.priority === "cheapest") {
    update.priority = "cheapest";
  } else if (slangSignals.priority === "better_condition") {
    update.priority = "best_condition";
  }
  if (slangSignals.color) {
    update.color = slangSignals.color;
  }
  if (slangSignals.budgetGuidance) {
    update.budgetText = "approximate_guidance";
    update.budgetDeclined = true;
  }
  if (sellerClaims.length > 0) {
    update.sellerClaims = sellerClaims;
  }
  if (excludedNegFlags.length > 0) {
    update.excludedNegativeFlags = excludedNegFlags;
  }

  // ── Deterministic clear rules ──
  if (/(?:цвет\s+не\s*важ|любой\s+цвет|без\s+разницы\s+по\s+цвету)/i.test(msg)) {
    clearFields.push("color");
  }
  if (/(?:комплектация\s+не\s*важн|любая\s+комплектация)/i.test(msg)) {
    clearFields.push("trimLevel");
  }
  if (/(?:без\s+разницы\s+по\s+приводу)/i.test(msg)) {
    clearFields.push("drivetrain");
  }
  if (/(?:не\s+важно\s+гибрид|без\s+разницы\s+гибрид)/i.test(msg)) {
    clearFields.push("fuelType");
  }
  if (/(?:без\s+разницы\s+по\s+оценке|без\s+оценки)/i.test(msg)) {
    clearFields.push("auctionGradeMin");
    clearFields.push("auctionGradesAllowed");
  }

  // ── A) Model / slang resolution ──
  let matchedAlias: string | null = null;
  for (const entry of MODEL_SLANG) {
    const slangMatch = userMessage.match(entry.patterns);
    if (slangMatch) {
      update.make = entry.make;
      update.model = entry.model;
      matchedAlias = slangMatch[0].toLowerCase();
      break;
    }
  }
  // Try explicit model names if no slang match
  if (!update.model) {
    for (const entry of EXPLICIT_MODEL_PATTERNS) {
      if (entry.pattern.test(userMessage)) {
        update.make = entry.make;
        update.model = entry.model;
        break;
      }
    }
  }
  // Try explicit make names (without model)
  if (!update.make) {
    for (const entry of MAKE_PATTERNS) {
      if (entry.pattern.test(userMessage)) {
        update.make = entry.make;
        break;
      }
    }
  }
  if (matchedAlias) {
    update.lastResolvedModelAlias = matchedAlias;
  }

  // ── B) Filter parsing ──

  // Age window
  if (/(?:не\s*проходн|непроходн)/i.test(msg)) {
    update.ageWindow = "non_passable";
    if (/(?:свеж|до\s*(?:3|тр[её]х)|младше\s*(?:3|тр[её]х)|менее\s*(?:3|тр[её]х)|не\s*старше\s*(?:3|тр[её]х)|молод)/i.test(msg)) {
      update.nonPassableType = "under_3_years";
    } else if (/(?:стар(?:ый)?\s*фонд|стар|(?:от|старше|свыше|более|больше)\s*(?:5|пяти))/i.test(msg)) {
      update.nonPassableType = "over_5_years";
    } else if (!previousState.nonPassableType) {
      // nonPassableType will be detected by computeNeedsClarification
    }
  } else if (/проходн/i.test(msg)) {
    update.ageWindow = "passable";
  }

  // Context-aware: standalone "свежий"/"старше"/"до 3 лет" when ageWindow is already non_passable.
  // Allows overriding a previously set nonPassableType (e.g., user changes from "до 3 лет" to "старше 5 лет").
  if (previousState.ageWindow === "non_passable" && !update.nonPassableType && !update.ageWindow) {
    if (/(?:свеж|до\s*(?:3\s*(?:-?\s*х)?|тр[её]х)|менее\s*(?:3|тр[её]х)|младше\s*(?:3|тр[её]х)|не\s*старше\s*(?:3|тр[её]х)|молод)/i.test(msg)) {
      update.nonPassableType = "under_3_years";
    } else if (/(?:стар(?:ый)?\s*фонд|стар|больше\s*(?:5|пяти)|более\s*(?:5|пяти)|старше\s*(?:5|пяти)|свыше\s*(?:5|пяти)|от\s*(?:5|пяти)|5\s*\+)/i.test(msg)) {
      update.nonPassableType = "over_5_years";
    }
  }

  // Standalone nonPassableType detection (even without "непроходной" in this message):
  // When the user says "до 3 лет" or "от 5 лет" alone, infer both ageWindow + nonPassableType.
  // Also allows overriding a previously set nonPassableType when user explicitly changes their mind.
  if (!update.ageWindow && !update.nonPassableType) {
    if (/(?:до\s*(?:3\s*(?:-?\s*х)?|тр[её]х)\s*лет|младше\s*(?:3|тр[её]х)(?:\s*лет)?|не\s*старше\s*(?:3|тр[её]х)(?:\s*лет)?|свежи[йея])/i.test(msg)) {
      update.ageWindow = "non_passable";
      update.nonPassableType = "under_3_years";
    } else if (/(?:(?:от|старше|свыше|более|больше)\s*(?:5|пяти)\s*(?:-?\s*и)?\s*лет|5\s*\+\s*лет|старше\s*(?:5|пяти)|стар(?:ый)?\s*фонд)/i.test(msg)) {
      update.ageWindow = "non_passable";
      update.nonPassableType = "over_5_years";
    }
  }

  // Drivetrain
  if (/(?:передн(?:ий|яя)?\s*привод|передн(?:ий|яя)?(?:\s|$))/i.test(msg)) {
    update.drivetrain = "fwd";
  } else if (/(?:задн(?:ий|яя)?\s*привод|задн(?:ий|яя)?(?:\s|$))/i.test(msg)) {
    update.drivetrain = "rwd";
  } else if (/(?:полн(?:ый|ая)?\s*привод|(?<![а-яёА-ЯЁa-zA-Z0-9])вд(?![а-яёА-ЯЁa-zA-Z0-9])|4\s*(?:вд|wd)(?![а-яёА-ЯЁa-zA-Z0-9])|(?<![а-яёА-ЯЁa-zA-Z0-9])awd(?![а-яёА-ЯЁa-zA-Z0-9]))/i.test(msg)) {
    update.drivetrain = "4wd";
  }

  // Steering
  if (/(?:прав(?:ый|ая)?\s*руль|правый(?:\s|$))/i.test(msg) && !/привод/i.test(msg)) {
    update.steering = "rhd";
  } else if (/(?:лев(?:ый|ая)?\s*руль|левый(?:\s|$))/i.test(msg) && !/привод/i.test(msg)) {
    update.steering = "lhd";
  }

  // Fuel type
  if (/(?:без\s*гибрид)/i.test(msg)) {
    update.fuelType = "gasoline";
  } else if (/(?<![а-яёА-ЯЁa-zA-Z0-9])(?:гибрид)/i.test(msg)) {
    update.fuelType = "hybrid";
  }
  if (/(?<![а-яёА-ЯЁa-zA-Z0-9])(?:бенз(?:ин)?)(?![а-яёА-ЯЁa-zA-Z0-9])/i.test(msg)) {
    update.fuelType = "gasoline";
  }
  if (/(?<![а-яёА-ЯЁa-zA-Z0-9])(?:дизель)(?![а-яёА-ЯЁa-zA-Z0-9])/i.test(msg)) {
    update.fuelType = "diesel";
  }
  if (/(?<![а-яёА-ЯЁa-zA-Z0-9])(?:электр(?:о|ичка)?|ev)(?![а-яёА-ЯЁa-zA-Z0-9])/i.test(msg)) {
    update.fuelType = "ev";
  }

  // Trim level
  const BASE_TRIM_RE = /(?:сам(?:ый|ая)\s+прост(?:ой|ая)|попроще|(?<![а-яёА-ЯЁa-zA-Z0-9])база(?![а-яёА-ЯЁa-zA-Z0-9])|базов)/i;
  if (BASE_TRIM_RE.test(msg)) {
    update.trimLevel = "base";
  } else if (/(?:средн(?:яя|ий|ее)|средн(?:\s|$))/i.test(msg)) {
    update.trimLevel = "mid";
  } else if (/(?:максималк|максимальн|(?<![а-яёА-ЯЁa-zA-Z0-9])макс(?![а-яёА-ЯЁa-zA-Z0-9])|жирн)/i.test(msg)) {
    update.trimLevel = "top";
  }

  // Priority
  if (/(?:подешевле|главное\s+дешевле|попроще.*цен|бюджетн)/i.test(msg) || BASE_TRIM_RE.test(msg)) {
    update.priority = "cheapest";
  } else if (/(?:главное\s+живой|получше\s+состояни|хорош(?:ее|ий)\s+состояни)/i.test(msg)) {
    update.priority = "best_condition";
  } else if (/(?:что-то\s+среднее|нормальн(?:ый|ое)\s+баланс|золотая\s+середин)/i.test(msg)) {
    update.priority = "balanced";
  }

  // Resale / legal entity
  // "для себя" implies both personal use (not for resale) and physical entity
  if (/(?:для\s+себя)/i.test(msg)) {
    update.isForResale = false;
    update.isLegalEntity = false;
  }
  // Check negation BEFORE positive to avoid "не для перепродажи" matching positive
  if (/(?:не\s+(?:для\s+)?перепродаж|не\s+на\s+продажу|не\s+для\s+продажи)/i.test(msg)) {
    update.isForResale = false;
  } else if (/(?:перепродаж|на\s+продажу|для\s+продажи)/i.test(msg)) {
    update.isForResale = true;
  }
  if (/(?:юрлиц|юр\.\s*лиц|для\s+компании|(?<![а-яёА-ЯЁa-zA-Z0-9])ооо(?![а-яёА-ЯЁa-zA-Z0-9])|(?<![а-яёА-ЯЁa-zA-Z0-9])ип(?![а-яёА-ЯЁa-zA-Z0-9]))/i.test(msg)) {
    update.isLegalEntity = true;
  } else if (/(?:физлиц|физ\.\s*лиц)/i.test(msg)) {
    update.isLegalEntity = false;
  }

  // ── C) Auction grade parsing ──
  // "оценка R тоже можно" / "R допустима" / "R можно"
  const gradeAllowedMatch = msg.match(/(?:оценк[аи]?\s+)?(R|RA)\s+(?:тоже\s+)?(?:можно|допустим|подойд|пойд|годит)/i)
    ?? msg.match(/\b(R|RA)\s+(?:можно|допустим)/i);
  if (gradeAllowedMatch) {
    update.auctionGradesAllowed = [gradeAllowedMatch[1].toUpperCase()];
  }

  // "не ниже 4" / "минимум 4.5" / "от 4"
  const gradeMinMatch = msg.match(/(?:не\s+ниже|минимум|от)\s+([\d](?:\.[\d])?)/i);
  if (gradeMinMatch) {
    update.auctionGradeMin = gradeMinMatch[1];
  }

  // "хорошая оценка" / "с хорошей оценкой"
  if (/(?:хорош(?:ая|ей|ую)\s+оценк)/i.test(msg) && !gradeMinMatch) {
    update.auctionGradeMin = "4";
  }

  // Explicit standalone grades like "4.5", "3.5" as allowed grades (but not as years)
  // Only match if preceded by "оценка" or similar context
  const explicitGradeMatch = msg.match(/(?:оценк[аиу]?\s+)(S|[1-6](?:\.[05])?|R|RA)/i);
  if (explicitGradeMatch && !gradeAllowedMatch) {
    const grade = explicitGradeMatch[1].toUpperCase();
    if (!update.auctionGradesAllowed) {
      update.auctionGradesAllowed = [];
    }
    if (!update.auctionGradesAllowed.includes(grade)) {
      update.auctionGradesAllowed.push(grade);
    }
  }

  // ── D) Year parsing ──
  // "2021", "21 год", "21й", "21-й"
  const yearFullMatch = msg.match(/\b(20[12]\d)\s*(?:год|г\.?)?/i);
  if (yearFullMatch) {
    update.year = parseInt(yearFullMatch[1], 10);
    update.yearText = yearFullMatch[0];
  } else {
    const yearShortMatch = msg.match(/\b(\d{2})\s*(?:-?й|й|-?го|год|г\.)/i);
    if (yearShortMatch) {
      const twoDigit = parseInt(yearShortMatch[1], 10);
      // Normalize: 10-30 → 2010-2030 for modern JDM context
      if (twoDigit >= 10 && twoDigit <= 35) {
        update.year = 2000 + twoDigit;
        update.yearText = yearShortMatch[0];
      }
    }
  }

  // ── E) Color parsing ──
  for (const entry of COLOR_PATTERNS) {
    if (entry.pattern.test(userMessage)) {
      update.color = entry.color;
      break;
    }
  }

  // ── F) Intent parsing ──
  if (/(?:посчитай|можешь\s+посчитать|расч[её]т|под\s+ключ\s+сколько|сколько\s+будет\s+стоить|сколько\s+стоит)/i.test(msg)) {
    update.activeIntent = "price_calc";
  } else if (/(?:что\s+значит|чем\s+(?:\d|R|RA)\S*\s+отличается|что\s+такое\s+(?:оценка|аукцион)|расскажи\s+про\s+оценк)/i.test(msg)) {
    update.activeIntent = "auction_explanation";
  } else if (
    update.model || update.make || update.drivetrain || update.ageWindow ||
    update.fuelType || update.trimLevel || update.year || update.color
  ) {
    update.activeIntent = "car_search";
  }

  // ── Budget parsing ──
  // Detect "don't know the budget" / "show me approximate prices" FIRST
  const BUDGET_UNKNOWN_RE = /(?:бюджет[а-яё]*\s+не\s*знаю|не\s+знаю\s+бюджет[а-яё]*|цен[а-яё]*\s+не\s*знаю|не\s+знаю\s+цен|дай\s+примерн|засвети\s+(?:стоимост|бюджет|цен)|покажи\s+стоимост|сориентируй|дай\s+вилку|примерн[а-яё]*\s+(?:бюджет|стоимост|цен)|ориентировочн[а-яё]*\s+(?:бюджет|стоимост|цен)|не\s+знаю\s+сколько|хз\s+(?:по\s+)?(?:бюджет|цен|стоимост)|жду\s+от\s+(?:тебя|вас)\s+цен|дай\s+ценообразовани|дай\s+(?:цен(?:у|ы|ник)|стоимост[а-яё]*)|покажи\s+цен|скажи\s+цен|сколько\s+стоит|не\s+знаю\s+цену|предлагай)/i;
  if (BUDGET_UNKNOWN_RE.test(msg)) {
    update.budgetText = "approximate_guidance";
    update.budgetDeclined = true;
  }

  if (!update.budgetText && !update.nonPassableType && !update.ageWindow) {
    const budgetMatch = msg.match(/(?:бюджет|до)\s+([\d.,]+\s*(?:тыс|тысяч|к|млн|миллион|\d)?[^\n,]*)/i);
    // Reject matches that contain age-related words: "лет", "год/года/году", or colloquial "-х" suffix (e.g. "до 3-х")
    const AGE_SUFFIX_RE = /(?:лет|год[ау]?(?![а-яе])|\d\s*-?\s*х(?:\s|$|[.,;!?]))/i;
    if (budgetMatch && !AGE_SUFFIX_RE.test(budgetMatch[0])) {
      update.budgetText = budgetMatch[0];
    }
  }
  if (!update.budgetText) {
    const budgetMatch2 = msg.match(/(?:в\s+пределах)\s+([\d.,]+[^\n,]*)/i);
    if (budgetMatch2) {
      update.budgetText = budgetMatch2[0];
    }
  }

  // ── Mileage parsing ──
  const mileageMatch = msg.match(/(?:пробег\s+(?:до|не\s+более|максимум)\s+[\d.,]+\s*(?:тыс|к|км)?[^\n,]*)/i);
  if (mileageMatch) {
    update.mileageText = mileageMatch[0];
  }

  // ── Volume parsing ──
  const volumeMatch = msg.match(/(?:объ[её]м(?:ом)?|двигатель|мотор)\s*(?:—|-)?\s*([\d.,]+)\s*(?:л(?:итр)?|куб|см3|cc)/i);
  if (volumeMatch) {
    const volStr = volumeMatch[1].replace(",", ".");
    const volNum = parseFloat(volStr);
    if (volNum > 0 && volNum < 10) {
      // Likely liters, convert to cm3
      update.volumeCm3 = Math.round(volNum * 1000);
    } else if (volNum >= 100) {
      update.volumeCm3 = Math.round(volNum);
    }
  }

  // Fallback volume: with unit but no prefix keyword (e.g., "1.5 литра", "1500 куб")
  if (!update.volumeCm3) {
    // Note: trailing \b removed — JS \b doesn't match Cyrillic word boundaries
    const volumeFallback = msg.match(/\b([\d]+[.,][\d]+)\s*(?:л(?:итр[аов]?)?)(?:\s|$|[.,])/i)
      ?? msg.match(/\b(\d{3,5})\s*(?:куб(?:\.\s*см)?|см3|cc)(?:\s|$|[.,])/i);
    if (volumeFallback) {
      const volStr = volumeFallback[1].replace(",", ".");
      const volNum = parseFloat(volStr);
      if (volNum > 0 && volNum < 10) {
        update.volumeCm3 = Math.round(volNum * 1000);
      } else if (volNum >= 100 && volNum <= 10000) {
        update.volumeCm3 = Math.round(volNum);
      }
    }
  }

  // Context-aware: bare number when volume is the pending question
  if (!update.volumeCm3 && previousState.pendingQuestion && /объ[её]м/i.test(previousState.pendingQuestion)) {
    const bareVol = msg.match(/^\s*([\d]+[.,]?[\d]*)\s*$/);
    if (bareVol) {
      const v = parseFloat(bareVol[1].replace(",", "."));
      if (v > 0 && v < 10) {
        update.volumeCm3 = Math.round(v * 1000);
      } else if (v >= 100 && v <= 10000) {
        update.volumeCm3 = Math.round(v);
      }
    }
  }

  // ── Auction price in JPY ──
  const jpyMatch = msg.match(/([\d.,]+)\s*(?:тыс(?:яч)?\s+)?(?:йен|иен|¥|jpy)/i);
  if (jpyMatch) {
    const priceStr = jpyMatch[1].replace(/\s/g, "").replace(",", ".");
    let price = parseFloat(priceStr);
    if (/тыс/i.test(jpyMatch[0])) {
      price *= 1000;
    }
    if (price > 0) {
      update.auctionPriceJPY = Math.round(price);
    }
  }

  // Context-aware: bare number when auction price/budget is the pending question
  if (!update.auctionPriceJPY && previousState.pendingQuestion && /(?:цен|бюджет|йен)/i.test(previousState.pendingQuestion)) {
    const barePrice = msg.match(/^\s*([\d][\d\s.,]*)\s*$/);
    if (barePrice) {
      const v = parseFloat(barePrice[1].replace(/[\s,]/g, ""));
      if (v >= 1000) {
        update.auctionPriceJPY = Math.round(v);
      }
    }
  }

  return { set: update, clearFields };
}

// ── LLM fallback parser (secondary enrichment only) ──────
const PARSER_SYSTEM_PROMPT = `You are a strict JSON extractor for a car import business.
Given a user message (possibly with slang), extract structured car-search filters.
Return ONLY valid JSON matching this schema — no markdown, no code fences, no explanation:

{
  "activeIntent": "car_search" | "price_calc" | "auction_explanation" | "other",
  "model": string | null,
  "make": string | null,
  "generation": string | null,
  "year": number | null,
  "color": string | null,
  "body": string | null,
  "ageWindow": "passable" | "non_passable" | null,
  "nonPassableType": "under_3_years" | "over_5_years" | null,
  "drivetrain": "fwd" | "rwd" | "4wd" | "awd" | null,
  "fuelType": "gasoline" | "hybrid" | "diesel" | "ev" | "phev" | null,
  "trimLevel": "base" | "mid" | "top" | null,
  "auctionGradeMin": string | null,
  "auctionGradesAllowed": string[],
  "mileageText": string | null,
  "budgetText": string | null,
  "budgetDeclined": boolean,
  "priority": "cheapest" | "best_condition" | "balanced" | null,
  "volumeCm3": number | null,
  "auctionPriceJPY": number | null,
  "isForResale": boolean | null,
  "isLegalEntity": boolean | null
}

CRITICAL SLANG RULES (use SEPARATE make and model fields — never combine them):
- "везел" / "везела" / "везёл" / "визел" → make="Honda", model="Vezel". NEVER "вездеход".
- "харек" → make="Toyota", model="Harrier"
- "филдер" → make="Toyota", model="Corolla Fielder"
- "приус" → make="Toyota", model="Prius"
- "прадик" → make="Toyota", model="Land Cruiser Prado"
- "фит" → make="Honda", model="Fit"
- "вокси" → make="Toyota", model="Voxy"
- "рав" / "рав4" / "равчик" → make="Toyota", model="RAV4"
- "форик" / "форестер" → make="Subaru", model="Forester"
- "камри" / "камрюха" → make="Toyota", model="Camry"
- "краун" → make="Toyota", model="Crown"
- "лось" → make="Lexus", model=null (clarify specific model)
- "крузак" → make="Toyota", model="Land Cruiser"
- "цээрвуха" → make="Honda", model="CR-V"
- "ашэрвуха" → make="Honda", model="HR-V"

IMPORTANT: "model" must be the model name ONLY (e.g. "Vezel", "Harrier"), NOT "Make Model" (e.g. NOT "Honda Vezel").

AGE RULES:
- "проходной" / "проходная" → ageWindow="passable" (3-5 years, favorable customs)
- "непроходной" / "непроходная" / "не проходной" → ageWindow="non_passable"
- If non_passable and context says "свежий" or implies new → nonPassableType="under_3_years"
- If non_passable and context says "старый" or implies old → nonPassableType="over_5_years"
- If ambiguous which non_passable → nonPassableType=null
- "до трёх лет" / "до 3 лет" / "младше трёх" / "младше 3" → ageWindow="non_passable", nonPassableType="under_3_years"
- "старше пяти" / "старше 5" / "от 5 лет" / "от пяти лет" → ageWindow="non_passable", nonPassableType="over_5_years"

FILTER RULES:
- "передний привод" / "передний" → drivetrain="fwd"
- "полный привод" / "вд" / "4вд" → drivetrain="4wd"
- "самый простой" / "попроще" / "база" → trimLevel="base"
- "максималка" / "жирная" → trimLevel="top"
- "главное дешевле" / "подешевле" / "попроще" → priority="cheapest"
- "оценка R тоже можно" / "R допустима" → add "R" to auctionGradesAllowed
- "посчитай" / "посчитать" / "можешь посчитать" → activeIntent="price_calc"
- "белый" / "чёрный" / "серебристый" etc. → color (as the client said it)
- "2023" / "2024 год" → year (numeric, e.g. 2023)
- "не больше 4.5" / "минимум 4" → auctionGradeMin (e.g. "4.5", "4")
- "до 100 тысяч пробег" / "пробег до 80к" → mileageText (as free text, e.g. "до 100 тыс. км")

CALC-CRITICAL FIELDS:
- "объём 1.5 литра" / "1.5л" / "1500 куб" → volumeCm3=1500 (always in cm³; if given in liters, multiply by 1000)
- "500000 йен" / "500 тысяч йен" → auctionPriceJPY=500000 (always in whole JPY)
- "для перепродажи" / "на продажу" → isForResale=true
- "для себя" / "не для перепродажи" → isForResale=false
- "юрлицо" / "ООО" / "ИП" → isLegalEntity=true
- "физлицо" / "для себя" → isLegalEntity=false

BUDGET DECLINED RULE:
- If the user says they don't know the budget, asks for pricing, or requests approximate costs (e.g. "не знаю бюджет", "жду от тебя цену", "сколько стоит", "дай ценообразование", "не знаю цену", "сориентируй по цене") → set budgetDeclined=true and budgetText="approximate_guidance".

⚠️ AGE vs BUDGET DISAMBIGUATION:
- "до 3 лет", "до трёх лет", "младше трёх", "до 3-х" → ageWindow="non_passable", nonPassableType="under_3_years". This is NEVER budgetText.
- "до 5 лет", "до пяти лет" → ageWindow="non_passable", nonPassableType="over_5_years". This is NEVER budgetText.
- "до X тысяч", "до X млн", "бюджет X" → budgetText (budget amount). This is NEVER about age.
- When in doubt: if the number is small (3, 5) and context is about vehicle age/customs — it is age, NOT budget.

If the message is not about cars at all, return activeIntent="other" with all other fields null/empty.
Return ONLY the JSON object. No other text.`;

async function extractStateUpdateWithLLM(
  userMessage: string,
  previousState: ConversationState,
): Promise<StateUpdate> {
  const apiKey = process.env.OPENROUTER_KEY;
  if (!apiKey) return { set: {}, clearFields: [] };

  try {
    const contextHint = previousState.model
      ? `\nCurrent active car in conversation: ${previousState.make ?? ""} ${previousState.model}. If the user message is a short follow-up, preserve this model.`
      : "";

    const pendingHint = previousState.pendingQuestion
      ? `\nThe bot just asked the user: "${previousState.pendingQuestion}". Interpret the user's response in this context.`
      : "";

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
          { role: "system", content: PARSER_SYSTEM_PROMPT + contextHint + pendingHint },
          { role: "user", content: userMessage },
        ],
        temperature: 0,
        max_tokens: 512,
      }),
    });

    if (!response.ok) {
      console.error(`⚠️ LLM parser call failed: ${response.status} ${response.statusText}`);
      return { set: {}, clearFields: [] };
    }

    const data: OpenRouterResponse = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (typeof raw !== "string" || raw.trim().length === 0) {
      return { set: {}, clearFields: [] };
    }

    // Strip possible markdown code fences despite instructions
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    const parsed = JSON.parse(cleaned) as Partial<ConversationState>;
    const result: Partial<ConversationState> = {};

    // Only pick non-null fields from LLM response
    if (parsed.activeIntent && parsed.activeIntent !== "other") result.activeIntent = parsed.activeIntent;
    if (parsed.model) {
      let m = parsed.model;
      // Normalize: strip make prefix if LLM returned "Honda Vezel" → "Vezel"
      if (parsed.make && m.toLowerCase().startsWith(parsed.make.toLowerCase() + " ")) {
        m = m.slice(parsed.make.length + 1);
      }
      result.model = m;
    }
    if (parsed.make) result.make = parsed.make;
    if (parsed.generation) result.generation = parsed.generation;
    if (typeof parsed.year === "number") result.year = parsed.year;
    if (parsed.color) result.color = parsed.color;
    if (parsed.body) result.body = parsed.body;
    if (parsed.ageWindow) result.ageWindow = parsed.ageWindow;
    if (parsed.nonPassableType) result.nonPassableType = parsed.nonPassableType;
    if (parsed.drivetrain) {
      // Normalize awd → 4wd (LLM may return "awd" despite schema)
      const dt = parsed.drivetrain as string;
      result.drivetrain = dt === "awd" ? "4wd" : parsed.drivetrain;
    }
    if (parsed.fuelType) result.fuelType = parsed.fuelType;
    if (parsed.trimLevel) result.trimLevel = parsed.trimLevel;
    if (parsed.auctionGradeMin) result.auctionGradeMin = parsed.auctionGradeMin;
    if (Array.isArray(parsed.auctionGradesAllowed) && parsed.auctionGradesAllowed.length > 0) {
      result.auctionGradesAllowed = parsed.auctionGradesAllowed;
    }
    if (parsed.mileageText) result.mileageText = parsed.mileageText;
    if (parsed.budgetText) result.budgetText = parsed.budgetText;
    if (parsed.budgetDeclined) result.budgetDeclined = true;
    if (parsed.priority) result.priority = parsed.priority;
    // Calc-critical fields
    if (typeof parsed.volumeCm3 === "number" && parsed.volumeCm3 > 0) {
      result.volumeCm3 = parsed.volumeCm3 < 15 ? Math.round(parsed.volumeCm3 * 1000) : Math.round(parsed.volumeCm3);
    }
    if (typeof parsed.auctionPriceJPY === "number" && parsed.auctionPriceJPY > 0) {
      result.auctionPriceJPY = Math.round(parsed.auctionPriceJPY);
    }
    if (typeof parsed.isForResale === "boolean") result.isForResale = parsed.isForResale;
    if (typeof parsed.isLegalEntity === "boolean") result.isLegalEntity = parsed.isLegalEntity;
    // needsClarification is NOT extracted — always computed from state via computeNeedsClarification

    return { set: result, clearFields: [] };
  } catch (err) {
    console.error("⚠️ LLM parser error:", err);
    return { set: {}, clearFields: [] };
  }
}

async function chatCompletion(chatId: number, userMessage: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_KEY;

  if (!apiKey) {
    throw new Error("OPENROUTER_KEY is missing");
  }

  const LOCAL_SYSTEM_PROMPT = `
Ты — Алексей, старший менеджер компании «СпецТехМаш» (Находка / Владивосток).
Специализация — импорт авто, мото и спецтехники из Азии.
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

Если клиент уже назвал конкретную модель И хотя бы 2 фильтра — НЕ задавай общие вопросы типа «какую машину хотите?», «какой бренд?», «кроссовер или внедорожник?». Сразу подтверди понятые фильтры и задай строго 1 точечный уточняющий вопрос — самый важный из недостающих параметров.

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
  • НЕ спрашивай: какой тип кузова, какой бренд, SUV или кроссовер, страну происхождения — если модель уже делает это очевидным.

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
• «санкционка» = автомобиль с нестандартной логистикой (объём > 1.9 л и др. ограничения).
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

Азиатский рынок без уточнения руля = правый руль (JDM). Не переспрашивай.

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
СПЕЦКАТЕГОРИЯ И СПЕЦТЕХНИКА
════════════════════════════════════════════

Авто спецкатегории (>1.9 л) или спецтехника: не считай цену, скажи что логистика нестандартная, собери параметры, передай оператору.

════════════════════════════════════════════
РАСЧЁТ ОБЫЧНОЙ МАШИНЫ
════════════════════════════════════════════

Если просят расчёт: собери тип, цену в йенах, объём двигателя, возраст, для кого авто (физлицо / юрлицо / перепродажа) — затем вызови calculate_vehicle_price. Результат распиши понятно.
Лимит скидки — 20 000 ₽, только для закрытия сделки.

ПРАВИЛО: Если клиент говорит «не знаю бюджет», «жду от тебя цену», «дай ценообразование», «сколько стоит», «сориентируй по цене» — НЕ спрашивай бюджет повторно. Вместо этого рассчитай стоимость по среднерыночным аукционным ценам и предоставь диапазон «от ... до ...».

ПРАВИЛО: Задавай строго ОДИН уточняющий вопрос за раз — самый важный из оставшихся. Не задавай 2+ вопроса одновременно.

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
• Если activeIntent="price_calc" но данных для calculate_vehicle_price недостаточно — подтверди фильтры и спроси только недостающее (аукционная цена в йенах, объём двигателя, точный возраст).

════════════════════════════════════════════
ЖЁСТКИЙ ЗАПРЕТ: ЕСЛИ МОДЕЛЬ ИЗВЕСТНА
════════════════════════════════════════════

Если в Parsed user intent уже заполнено поле "model", ты ОБЯЗАН:
• Работать с этой моделью.
• НЕ спрашивать: «какой бренд?», «какую модель?», «какой тип техники?», «что вас интересует?».
• Короткие уточняющие сообщения клиента (цвет, привод, комплектация) — это дополнения к текущей модели, а НЕ новый запрос.
`.trim();

  // ── Deterministic parser first, then LLM fallback if needed ──
  const mem = getMemory(chatId);

  // Step 1: deterministic extraction (instant, no API call)
  const deterministicUpdate = extractStateUpdate(userMessage, mem.state);

  // Step 2: check if deterministic parser found anything meaningful
  const detSet = deterministicUpdate.set;
  const hasSubstantiveUpdate = !!(
    detSet.model || detSet.make ||
    detSet.drivetrain || detSet.ageWindow || detSet.nonPassableType ||
    detSet.fuelType || detSet.trimLevel ||
    detSet.year || detSet.color || detSet.steering ||
    detSet.activeIntent || detSet.auctionGradeMin ||
    (detSet.auctionGradesAllowed && detSet.auctionGradesAllowed.length > 0) ||
    detSet.budgetText || detSet.priority || detSet.mileageText ||
    detSet.volumeCm3 || detSet.auctionPriceJPY ||
    detSet.isForResale != null || detSet.isLegalEntity != null
  );

  let combinedUpdate: StateUpdate = deterministicUpdate;
  let mergeSource: "regex" | "llm" = "regex";

  // Step 3: LLM fallback — when deterministic parser found nothing AND:
  //   - message is not a simple follow-up, OR
  //   - we're in collecting_calc_params stage (short answers to calc questions need LLM interpretation)
  if (!hasSubstantiveUpdate && deterministicUpdate.clearFields.length === 0
      && (!isFollowUpFilter(userMessage) || mem.state.stage === "collecting_calc_params")) {
    // Deterministic parser found nothing — try LLM as backup
    const llmUpdate = await extractStateUpdateWithLLM(userMessage, mem.state);
    // Deterministic parser always takes precedence; LLM fills remaining gaps
    // Apply overwrite protection: LLM cannot overwrite regex/high-confidence slots
    const protectedLlmSet = applyLlmOverwriteProtection(llmUpdate.set, mem.state);
    combinedUpdate = {
      set: { ...protectedLlmSet, ...deterministicUpdate.set },
      clearFields: [...deterministicUpdate.clearFields, ...llmUpdate.clearFields],
    };
    mergeSource = "llm";
  }

  // Step 3: apply update to persistent state (includes derive, stage transition, pending question)
  const mergedState = applyStateUpdate(mem.state, combinedUpdate, mergeSource);
  mem.state = mergedState;

  // ── Fast-path: deterministic response when parser extracted enough data ──
  // When model is known AND ≥2 filter/preference slots are filled, and we're
  // still collecting data, use the deterministic response builder directly.
  // This prevents the LLM from ignoring parsed state and asking generic questions
  // (the root cause of the "bot is still тупой" production bug).
  if (
    mergedState.model != null &&
    (mergedState.stage === "collecting_calc_params" || mergedState.stage === "collecting_filters")
  ) {
    const filledCount = [
      mergedState.ageWindow != null,
      mergedState.drivetrain != null,
      mergedState.fuelType != null,
      mergedState.trimLevel != null,
      mergedState.year != null,
      mergedState.budgetText != null,
      mergedState.priority != null,
      mergedState.auctionGradeMin != null,
      mergedState.color != null,
      mergedState.volumeCm3 != null,
      mergedState.auctionPriceJPY != null,
      mergedState.isForResale != null,
      mergedState.isLegalEntity != null,
      mergedState.auctionGradesAllowed.length > 0,
    ].filter(Boolean).length;

    if (filledCount >= 2) {
      console.log(`🔀 Fast-path: deterministic response (${mergedState.make} ${mergedState.model}, ${filledCount} filters)`);
      const plan = planReply(mergedState, userMessage);
      return buildSafeFallbackReply(mergedState, plan);
    }
  }

  const recentMessages = mem.messages.filter(
    (m): m is { role: "user" | "assistant"; content: string } =>
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string",
  );

  // ── Build a SINGLE consolidated state context message ──
  // Consolidating into one message helps the LLM follow instructions better.
  const stateContextParts: string[] = [];

  if (mergedState.activeIntent !== "other" || mergedState.model != null) {
    const knownSummary = buildKnownFiltersSummary(mergedState);

    // Human-readable summary of what's already known
    stateContextParts.push(`═══ ТЕКУЩИЙ СТАТУС РАЗГОВОРА ═══`);
    stateContextParts.push(`ЭТАП: ${mergedState.stage}`);
    if (knownSummary) {
      stateContextParts.push(`УЖЕ ИЗВЕСТНО: ${knownSummary}`);
    }

    // Hard model constraint
    if (mergedState.model) {
      stateContextParts.push(
        `\n⛔ МОДЕЛЬ ОПРЕДЕЛЕНА: ${mergedState.make ?? ""} ${mergedState.model}. ` +
        `КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО спрашивать: «какой бренд?», «какую марку?», «какую модель?», «какой тип техники?», «что вас интересует?». ` +
        `Все новые фильтры от клиента применяй к этой модели.`
      );
    }
  }

  // Stage-specific instructions with clear known/missing breakdown
  if (mergedState.stage === "collecting_calc_params") {
    const missing: string[] = [];
    if (!mergedState.volumeCm3) missing.push("объём двигателя");
    if (!mergedState.year && !mergedState.ageWindow) missing.push("год или возрастное окно");
    if (mergedState.ageWindow === "non_passable" && !mergedState.nonPassableType) missing.push("уточнить непроходной: свежий (до 3 лет) или старый (5+ лет)");
    if (mergedState.isForResale == null && mergedState.isLegalEntity == null) missing.push("для себя (физлицо) или юрлицо/перепродажа");
    else if (mergedState.isForResale == null) missing.push("для перепродажи или для себя");
    else if (mergedState.isLegalEntity == null) missing.push("физлицо или юрлицо");
    // Budget is LAST priority and skipped if budgetDeclined
    if (!mergedState.auctionPriceJPY && !mergedState.budgetText && !mergedState.budgetDeclined) missing.push("бюджет или аукционная цена в йенах");

    stateContextParts.push(
      `\n═══ ИНСТРУКЦИЯ ═══`,
      `Клиент хочет расчёт. Действуй так:`,
      `1. Подтверди КОРОТКО все уже известные фильтры (одним предложением).`,
      missing.length > 0
        ? `2. Спроси строго ОДИН вопрос — самый важный: ${missing[0]}.`
        : `2. Все параметры собраны — вызови calculate_vehicle_price.`,
      `3. НЕ задавай НИКАКИХ других вопросов. НЕ предлагай альтернативы.`,
    );
  } else if (mergedState.stage === "ready_to_calculate") {
    stateContextParts.push(
      `\n═══ ИНСТРУКЦИЯ ═══`,
      `Все параметры для расчёта собраны. Вызови calculate_vehicle_price. Не задавай лишних вопросов.`,
    );
  } else if (mergedState.stage === "explaining_auction") {
    stateContextParts.push(
      `\n═══ ИНСТРУКЦИЯ ═══`,
      `Клиент спрашивает про аукционные оценки. Объясни кратко и по делу.`,
    );
  } else if (mergedState.stage === "collecting_filters") {
    // Pending question hint
    if (mergedState.pendingQuestion) {
      stateContextParts.push(
        `\n═══ ИНСТРУКЦИЯ ═══`,
        `Задай естественно (не дословно): ${mergedState.pendingQuestion}`,
      );
    }
  }

  // Deterministic reply plan — strongest instruction for the LLM
  const replyPlan = planReply(mergedState, userMessage);
  if (replyPlan.length > 0) {
    stateContextParts.push(
      `\n═══ ПЛАН ОТВЕТА (выполняй СТРОГО) ═══`,
      ...replyPlan.map(h => `• ${h}`),
    );
  }

  // ── Auto-calculate when all params are ready ──
  // Use buildCalcParamsFromState directly instead of relying on LLM making the correct tool call
  let autoCalcDone = false;
  if (mergedState.stage === "ready_to_calculate" && !mergedState.calculationDone) {
    const isRangeMode = (mergedState.budgetText === "approximate_guidance" || mergedState.budgetDeclined) && mergedState.auctionPriceJPY == null;

    if (isRangeMode) {
      // Range calculation: user doesn't know budget — calculate with market price range
      const rangeParams = buildCalcParamsRange(mergedState);
      if (rangeParams) {
        try {
          const [lowResult, highResult] = await Promise.all([
            calculateTurnkeyPrice(rangeParams.low),
            calculateTurnkeyPrice(rangeParams.high),
          ]);
          stateContextParts.push(
            `\n═══ РЕЗУЛЬТАТ РАСЧЁТА ДИАПАЗОНА (выполнен автоматически) ═══`,
            `Клиент не назвал бюджет — рассчитано по среднерыночным аукционным ценам.`,
            `Аукционная цена ОТ: ${rangeParams.low.priceJPY.toLocaleString("ru")} йен`,
            `Результат (нижняя граница):`,
            JSON.stringify(lowResult, null, 2),
            `Аукционная цена ДО: ${rangeParams.high.priceJPY.toLocaleString("ru")} йен`,
            `Результат (верхняя граница):`,
            JSON.stringify(highResult, null, 2),
            `Распиши клиенту ДИАПАЗОН стоимости «от ... до ...» понятно и красиво по-русски. Объясни, что точная цена зависит от аукционной стоимости конкретного лота. НЕ вызывай calculate_vehicle_price — расчёт уже сделан. НЕ спрашивай бюджет повторно.`,
          );
          autoCalcDone = true;
          mergedState.calculationDone = true;
          mem.state = mergedState;
        } catch (err) {
          console.error("❌ Auto-calculate range error:", err);
        }
      }
    } else {
      // Exact calculation with known auction price
      const calcParams = buildCalcParamsFromState(mergedState);
      if (calcParams) {
        try {
          const calcResult = await calculateTurnkeyPrice(calcParams);
          stateContextParts.push(
            `\n═══ РЕЗУЛЬТАТ РАСЧЁТА (выполнен автоматически) ═══`,
            JSON.stringify(calcResult, null, 2),
            `Распиши этот результат клиенту понятно и красиво по-русски. НЕ вызывай calculate_vehicle_price — расчёт уже сделан.`,
          );
          autoCalcDone = true;
          mergedState.calculationDone = true;
          mem.state = mergedState;
        } catch (err) {
          console.error("❌ Auto-calculate error:", err);
        }
      }
    }
  } else if (mergedState.calculationDone) {
    // Calculation was already performed — tell LLM to handle follow-up naturally
    autoCalcDone = true;
    stateContextParts.push(
      `\n═══ ИНСТРУКЦИЯ ═══`,
      `Расчёт стоимости уже был выполнен ранее. НЕ вызывай calculate_vehicle_price повторно.`,
      `Отвечай на вопросы клиента по существу. Если клиент хочет пересчитать с другими параметрами — скажи, какие именно новые данные нужны.`,
    );
  }

  // Build the state context as a single system message
  const stateContextMessages: Array<{ role: "system"; content: string }> = [];
  if (stateContextParts.length > 0) {
    stateContextMessages.push({
      role: "system" as const,
      content: stateContextParts.join("\n"),
    });
  }

  // ── Determine if tools should be included ──
  // Skip tools when auto-calc already produced a result
  const includeTools = mergedState.activeIntent === "price_calc" && !autoCalcDone;

  const body: Record<string, unknown> = {
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
      ...stateContextMessages,
      ...recentMessages,
      { role: "user", content: userMessage }
    ],
    temperature: TEMPERATURE,
    max_tokens: MAX_TOKENS,
  };

  if (includeTools) {
    body.tools = tools;
  }

  const headers = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "http://localhost:3001",
    "X-OpenRouter-Title": "SpecTechMash Telegram Bot"
  };

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  const rawText = await response.text();

  if (!response.ok) {
    console.error(`❌ OpenRouter API error ${response.status} ${response.statusText}: ${rawText}`);
    throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(rawText);
  } catch {
    console.error("❌ Failed to parse OpenRouter response:", rawText);
    throw new Error("OpenRouter returned invalid JSON");
  }

  // ── Handle tool calls ──
  const choices = data?.choices as Array<{ message?: { content?: string; tool_calls?: ToolCall[] } }> | undefined;
  const firstMessage = choices?.[0]?.message;
  const toolCalls = firstMessage?.tool_calls;

  if (toolCalls && toolCalls.length > 0) {
    // Execute tool calls and collect results
    const toolResults: Array<{ role: "tool"; tool_call_id: string; content: string }> = [];

    for (const tc of toolCalls) {
      if (tc.function.name === "calculate_vehicle_price") {
        try {
          const args = JSON.parse(tc.function.arguments) as {
            vehicleType?: string;
            priceJPY?: number;
            volumeCm3?: number;
            ageYears?: number;
            isForResale?: boolean;
            isLegalEntity?: boolean;
          };

          // Validate required numeric params — reject if missing to avoid nonsense calculations
          if (args.priceJPY == null || args.volumeCm3 == null || args.ageYears == null) {
            toolResults.push({
              role: "tool",
              tool_call_id: tc.id,
              content: JSON.stringify({ error: "Недостаточно данных для расчёта: нужны цена в йенах, объём двигателя и возраст." }),
            });
            continue;
          }

          const calcParams: CalcParams = {
            vehicleType: (args.vehicleType as CalcParams["vehicleType"]) ?? "car",
            priceJPY: args.priceJPY,
            volumeCm3: args.volumeCm3,
            ageYears: args.ageYears,
            isForResale: args.isForResale ?? false,
            isLegalEntity: args.isLegalEntity ?? false,
          };

          const result = await calculateTurnkeyPrice(calcParams);
          toolResults.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });
        } catch (err) {
          console.error("❌ Tool call error:", err);
          toolResults.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ error: "Ошибка при расчёте. Попробуйте позже." }),
          });
        }
      }
    }

    // Send tool results back to the LLM for human-readable formatting
    const followUpMessages = [
      ...(body.messages as ChatMessage[]),
      { role: "assistant" as const, content: firstMessage?.content ?? null, tool_calls: toolCalls },
      ...toolResults,
    ];

    const followUpBody = {
      model: MODEL,
      messages: followUpMessages,
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
    };

    const followUpResponse = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(followUpBody),
    });

    const followUpRawText = await followUpResponse.text();
    if (!followUpResponse.ok) {
      console.error(`❌ OpenRouter follow-up error ${followUpResponse.status}: ${followUpRawText}`);
      throw new Error(`OpenRouter follow-up error: ${followUpResponse.status}`);
    }

    let followUpData: Record<string, unknown>;
    try {
      followUpData = JSON.parse(followUpRawText);
    } catch {
      console.error("❌ Failed to parse follow-up response:", followUpRawText);
      throw new Error("OpenRouter follow-up returned invalid JSON");
    }

    const followUpChoices = followUpData?.choices as Array<{ message?: { content?: string } }> | undefined;
    const followUpContent = followUpChoices?.[0]?.message?.content;
    if (followUpContent && typeof followUpContent === "string") {
      return followUpContent.trim();
    }

    // Fallback: return tool result summary directly
    return "Расчёт выполнен. Свяжитесь с менеджером для уточнения деталей.";
  }

  // ── Normal text response (no tool calls) ──
  const content = firstMessage?.content;

  if (!content || typeof content !== "string") {
    console.error("❌ Unexpected OpenRouter response shape:", data);
    throw new Error("OpenRouter returned empty response");
  }

  return content.trim();
}

async function getAIResponse(chatId: number, userMessage: string): Promise<string> {
  try {
    let reply = await chatCompletion(chatId, userMessage);

    // Post-reply validation: if LLM reply contradicts parsed state, use deterministic fallback
    const mem = getMemory(chatId);
    if (
      violatesKnownModelGuard(reply, mem.state) ||
      replyContradictsState(reply, mem.state)
    ) {
      console.warn("⚠️ Reply contradicts parsed state — using deterministic fallback");
      const plan = planReply(mem.state, userMessage);
      reply = buildSafeFallbackReply(mem.state, plan);
    }

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

// ── Test exports (used by regression tests) ──
export {
  extractStateUpdate as _test_extractStateUpdate,
  applyStateUpdate as _test_applyStateUpdate,
  buildSafeFallbackReply as _test_buildSafeFallbackReply,
  planReply as _test_planReply,
  DEFAULT_CONVERSATION_STATE as _test_DEFAULT_CONVERSATION_STATE,
};
export type { ConversationState as _test_ConversationState };

// ── Bot setup (skip in test mode) ────────────────────────
if (!isTestMode) {
const bot = new Telegraf(token!);

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
} // end if (!isTestMode)
