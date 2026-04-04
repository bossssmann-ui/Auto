/**
 * Auto-slang normalization layer.
 *
 * Handles Russian car-market jargon, abbreviations, seller claims,
 * and colloquial phrases — normalising them into canonical state fields.
 *
 * Design:
 *  - normalizeAutoSlang(text)   → cleaned text with slang replaced
 *  - extractSlangSignals(text)  → Partial<SlangSignals> for state merge
 *  - Trust classification: hard_fact / soft_claim / negative_flag
 */

// ── Cyrillic-aware word boundary (duplicated from bot.ts for module independence) ──
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

// ── Trust classification ──
export type TrustLevel = "hard_fact" | "soft_claim" | "negative_flag";

export interface SellerClaim {
  original: string;
  meaning: string;
  trust: TrustLevel;
}

// ── Slang signals extracted from text ──
export interface SlangSignals {
  transmission: "manual" | "automatic" | "cvt" | null;
  drivetrain: "fwd" | "rwd" | "4wd" | null;
  trimLevel: "base" | "top" | null;
  fuelType: "diesel" | "gasoline" | "hybrid" | "ev" | null;
  turbo: boolean;
  hasSunroof: boolean;
  hasClimate: boolean;
  manualWindows: boolean;
  body: string | null;
  condition: "poor" | "decent" | null;
  steering: "rhd" | "lhd" | null;
  engineVolume: number | null;  // in liters, e.g. 1.5, 2.0
  isForResale: boolean | null;
  isLegalEntity: boolean | null;
  priority: "cheapest" | "better_condition" | null;
  useCase: "personal" | "resale" | "legal_entity" | null;
  noRussiaMileage: boolean;
  sellerClaims: SellerClaim[];
  negativeFlags: string[];
  budgetGuidance: boolean;
  color: string | null;
}

// ── Category alias dictionaries ──

/** Transmission aliases */
const transmissionAliases: Array<{ pattern: RegExp; value: "manual" | "automatic" | "cvt" }> = [
  { pattern: cyrb(/\b(?:на\s+палке|палка|кочерга|мешалка|мотыга|ручка|коробчатый|мкпп|мт|механика|механическ)\b/i), value: "manual" },
  { pattern: cyrb(/\b(?:автомат|тяпка|акпп|ат)\b/i), value: "automatic" },
  { pattern: cyrb(/\b(?:варик|вариатор|вибратор|cvt)\b/i), value: "cvt" },
];

/** Drivetrain aliases */
const drivetrainAliases: Array<{ pattern: RegExp; value: "fwd" | "rwd" | "4wd" }> = [
  { pattern: cyrb(/\b(?:передок|передн)\b/i), value: "fwd" },
  { pattern: cyrb(/\b(?:задок|задн)\b/i), value: "rwd" },
  { pattern: cyrb(/\b(?:вэдовая|вдовая|вэдэшка|4\s*везде|вд|4\s*вд|4\s*wd|awd|полн(?:ый|ая)?\s*привод)\b/i), value: "4wd" },
];

/** Trim / equipment level aliases */
const trimAliases: Array<{ pattern: RegExp; value: "base" | "top"; extras?: Partial<SlangSignals> }> = [
  // Base / poor equipment
  {
    pattern: cyrb(/\b(?:весла|вёсла|на\s+в[её]слах|мясорубк|рукопашн)\b/i),
    value: "base",
    extras: { manualWindows: true },
  },
  { pattern: cyrb(/\b(?:деревянн(?:ая|ый)|деревянн(?:ый)?\s+салон|овощной\s+салон|пустая\s+машин|пустая\s+комплектац|мыльница)\b/i), value: "base" },
  // Top / rich equipment
  { pattern: cyrb(/\b(?:фарш|полный\s+фарш|со\s+всеми\s+пирогами|кожа[\s-]рожа|жирн(?:ая|ый|ое)?(?:\s+комплектац)?)\b/i), value: "top" },
];

/** Sunroof aliases */
const sunroofAliases: RegExp = cyrb(/\b(?:люкатая|с\s+люком|с\s+люк(?:ом)?)\b/i);

/** Climate / AC aliases */
const climateAliases: RegExp = cyrb(/\b(?:клима|климат|кондей|кондёр|конд[её]р)\b/i);

/** Fuel type aliases */
const fuelAliases: Array<{ pattern: RegExp; value: "diesel" | "gasoline" | "hybrid" | "ev" }> = [
  { pattern: cyrb(/\b(?:саляра|дизель|дт)\b/i), value: "diesel" },
  { pattern: cyrb(/\b(?:зажигалка|бенз(?:ин)?)\b/i), value: "gasoline" },
  { pattern: cyrb(/\b(?:гибрид|гибра|гибридка)\b/i), value: "hybrid" },
  { pattern: cyrb(/\b(?:электричка|электро|ev)\b/i), value: "ev" },
];

/** Turbo alias */
const turboAliases: RegExp = cyrb(/\b(?:турбовая|турбо|турбир)\b/i);

/** Body type aliases */
const bodyAliases: Array<{ pattern: RegExp; value: string }> = [
  { pattern: cyrb(/\b(?:сарай|универсал)\b/i), value: "wagon" },
  { pattern: cyrb(/\b(?:микрик|микроб(?:ус)?|басик|балабаска|минивэн|минивен)\b/i), value: "minivan" },
  { pattern: cyrb(/\b(?:паркетник|кроссовер)\b/i), value: "crossover" },
  { pattern: cyrb(/\b(?:джип|козёл|козел|внедорожник)\b/i), value: "suv" },
  { pattern: cyrb(/\b(?:купарь|купе)\b/i), value: "coupe" },
  { pattern: cyrb(/\b(?:кабр|кабриолет)\b/i), value: "cabrio" },
  { pattern: cyrb(/\b(?:буханка)\b/i), value: "van" },
  { pattern: cyrb(/\b(?:седан)\b/i), value: "sedan" },
  { pattern: cyrb(/\b(?:хэтчбек|хетчбек|хэтч|хетч)\b/i), value: "hatchback" },
];

/** Condition aliases */
const conditionAliases: Array<{ pattern: RegExp; value: "poor" | "decent" }> = [
  { pattern: cyrb(/\b(?:корч|корча|корыто|ведро(?:\s+с\s+гайками)?|дрова|ушатанн|ушат|убит(?:ая|ый)?|уставш|хламиди|трахом)\b/i), value: "poor" },
  { pattern: cyrb(/\b(?:живая|живой(?:\s+вариант)?)\b/i), value: "decent" },
];

/** Steering aliases */
const steeringAliases: Array<{ pattern: RegExp; value: "rhd" | "lhd" }> = [
  { pattern: cyrb(/\b(?:прав(?:ый|ая)?\s*руль|праворукая|правильная|косорукая)\b/i), value: "rhd" },
  { pattern: cyrb(/\b(?:европеец|лев(?:ый|ая)?\s*руль)\b/i), value: "lhd" },
];

/** Engine volume aliases (returns liters) */
const engineVolumeAliases: Array<{ pattern: RegExp; value: number }> = [
  { pattern: cyrb(/\b(?:полторашк[а-яё]*|полтора|1[.,]5\s*л|один\s+(?:и\s+)?пять)\b/i), value: 1.5 },
  { pattern: cyrb(/\b(?:двушк[а-яё]*|двалитр[а-яё]*|2[.,]0\s*л|2\s+литр)\b/i), value: 2.0 },
  { pattern: cyrb(/\b(?:трешк[а-яё]*|3[.,]0\s*л|3\s+литр)\b/i), value: 3.0 },
];

/** Ownership / use-case aliases */
const ownershipAliases = {
  personal: cyrb(/\b(?:для\s+себя|машина\s+для\s+себя)\b/i),
  resale: cyrb(/\b(?:под\s+перепродажу|для\s+перепродаж)\b/i),
  legalEntity: cyrb(/\b(?:на\s+юрлицо|на\s+фирму|на\s+компанию)\b/i),
};

/** Priority aliases */
const priorityAliases = {
  cheapest: cyrb(/\b(?:подешевле|дешман|по\s+низу\s+рынка)\b/i),
  betterCondition: cyrb(/\b(?:живую|не\s+дрова|не\s+ведро)\b/i),
};

/** Color slang aliases */
const colorAliases: Array<{ pattern: RegExp; value: string }> = [
  { pattern: cyrb(/\b(?:снежка|серебрянка)\b/i), value: "серебристый" },
  { pattern: cyrb(/\b(?:бутылка|бутылочн)\b/i), value: "тёмно-зелёный" },
  { pattern: cyrb(/\b(?:бесцветная)\b/i), value: "белый" },
];

/** Negative flags — risk indicators */
const negativeFlagPatterns: Array<{ pattern: RegExp; flag: string }> = [
  { pattern: cyrb(/\b(?:топляк)\b/i), flag: "flood_damage" },
  { pattern: cyrb(/\b(?:перевертыш)\b/i), flag: "rollover_history" },
  { pattern: cyrb(/\b(?:кривая)\b/i), flag: "geometry_or_docs_problem" },
  { pattern: cyrb(/\b(?:жучки)\b/i), flag: "rust_spots" },
  { pattern: cyrb(/\b(?:маслит)\b/i), flag: "oil_leak" },
  { pattern: cyrb(/\b(?:конструктор)\b/i), flag: "constructor_import" },
  { pattern: cyrb(/\b(?:распил)\b/i), flag: "cut_import" },
  { pattern: cyrb(/\b(?:половинк[а-яё]*)\b/i), flag: "half_cut" },
];

/** Seller claims — soft trust */
const sellerClaimPatterns: Array<{ pattern: RegExp; meaning: string }> = [
  { pattern: /(?:в\s+родне|кузов\s+в\s+родне)/i, meaning: "seller_claims_original_paint" },
  { pattern: /(?:мотор\s+масло\s+не\s+бер[её]т)/i, meaning: "seller_claims_no_oil_consumption" },
  { pattern: /(?:коробка\s+не\s+пинается)/i, meaning: "seller_claims_transmission_ok" },
  { pattern: /(?:работает\s+как\s+часы)/i, meaning: "seller_claims_perfect_condition" },
  { pattern: /(?:доедет\s+куда\s+угодно)/i, meaning: "seller_claims_reliable" },
  { pattern: /(?:я\s+хозяин|не\s+перекуп)/i, meaning: "seller_claims_owner" },
  { pattern: /(?:не\s+распил|не\s+надгрыз|не\s+надкус)/i, meaning: "seller_claims_legal_import" },
  { pattern: /(?:сквозной\s+коррозии\s+нет)/i, meaning: "seller_claims_no_deep_rust" },
];

/** No-Russia-mileage aliases */
const noRussiaMileagePattern: RegExp = cyrb(/\b(?:беспробежн(?:ая|ый|ое)?|беспробежк[а-яё]*|б\/п)\b/i);

/** Budget guidance phrases */
const budgetGuidancePattern: RegExp = /(?:засвети\s+стоимост|дай\s+вилку|сориентируй\s+по\s+бюджет|примерн(?:ый|ая|ое)?\s+бюджет|цен[а-яё]*\s+в\s+иенах\s+не\s+знаю)/i;

// ══════════════════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════════════════

/**
 * Normalize Russian auto-slang in the input text.
 * Replaces slang terms with canonical equivalents so downstream regex
 * patterns in the deterministic parser can match them.
 */
export function normalizeAutoSlang(text: string): string {
  let t = text;

  // Numeric slang normalization
  t = t
    .replace(/(?<![а-яА-Яa-zA-Z])двушк[а-яё]*/gi, "2.0 л")
    .replace(/(?<![а-яА-Яa-zA-Z])двалитр[а-яё]*/gi, "2.0 л")
    .replace(/(?<![а-яА-Яa-zA-Z])один\s+(?:и\s+)?пять(?![а-яА-Яa-zA-Z])/gi, "1.5")
    .replace(/(?<![а-яА-Яa-zA-Z])трешк[а-яё]*/gi, "3.0 л");

  // Transmission slang → canonical
  t = t.replace(/(?<![а-яА-Яa-zA-Z])(?:на\s+палке|палка|кочерга|мешалка|мотыга)(?![а-яА-Яa-zA-Z])/gi, "механика");
  t = t.replace(/(?<![а-яА-Яa-zA-Z])тяпка(?![а-яА-Яa-zA-Z])/gi, "автомат");
  t = t.replace(/(?<![а-яА-Яa-zA-Z])(?:варик|вибратор)(?![а-яА-Яa-zA-Z])/gi, "вариатор");

  // Drivetrain slang → canonical
  t = t.replace(/(?<![а-яА-Яa-zA-Z])(?:передок)(?![а-яА-Яa-zA-Z])/gi, "передний привод");
  t = t.replace(/(?<![а-яА-Яa-zA-Z])(?:задок)(?![а-яА-Яa-zA-Z])/gi, "задний привод");
  t = t.replace(/(?<![а-яА-Яa-zA-Z])(?:вэдовая|вдовая|вэдэшка)(?![а-яА-Яa-zA-Z])/gi, "полный привод");

  // Fuel slang → canonical
  t = t.replace(/(?<![а-яА-Яa-zA-Z])саляра(?![а-яА-Яa-zA-Z])/gi, "дизель");
  t = t.replace(/(?<![а-яА-Яa-zA-Z])зажигалка(?![а-яА-Яa-zA-Z])/gi, "бензин");
  t = t.replace(/(?<![а-яА-Яa-zA-Z])(?:гибра|гибридка)(?![а-яА-Яa-zA-Z])/gi, "гибрид");
  t = t.replace(/(?<![а-яА-Яa-zA-Z])электричка(?![а-яА-Яa-zA-Z])/gi, "электро");

  // Steering slang → canonical
  t = t.replace(/(?<![а-яА-Яa-zA-Z])(?:праворукая|правильная|косорукая)(?![а-яА-Яa-zA-Z])/gi, "правый руль");
  t = t.replace(/(?<![а-яА-Яa-zA-Z])европеец(?![а-яА-Яa-zA-Z])/gi, "левый руль");

  // Origin → canonical for model detection
  t = t.replace(/(?<![а-яА-Яa-zA-Z])японка(?![а-яА-Яa-zA-Z])/gi, "японский автомобиль");

  return t;
}

/**
 * Extract structured slang signals from text.
 * Returns a partial SlangSignals with only detected fields filled in.
 */
export function extractSlangSignals(text: string): Partial<SlangSignals> {
  const low = text.toLowerCase().replace(/ё/g, "е");
  const signals: Partial<SlangSignals> = {};

  // Transmission
  for (const { pattern, value } of transmissionAliases) {
    if (pattern.test(low)) {
      signals.transmission = value;
      break;
    }
  }

  // Drivetrain
  for (const { pattern, value } of drivetrainAliases) {
    if (pattern.test(low)) {
      signals.drivetrain = value;
      break;
    }
  }

  // Trim level
  for (const { pattern, value, extras } of trimAliases) {
    if (pattern.test(low)) {
      signals.trimLevel = value;
      if (extras?.manualWindows) signals.manualWindows = true;
      break;
    }
  }

  // Sunroof
  if (sunroofAliases.test(low)) {
    signals.hasSunroof = true;
  }

  // Climate
  if (climateAliases.test(low)) {
    signals.hasClimate = true;
  }

  // Fuel type
  for (const { pattern, value } of fuelAliases) {
    if (pattern.test(low)) {
      signals.fuelType = value;
      break;
    }
  }

  // Turbo
  if (turboAliases.test(low)) {
    signals.turbo = true;
  }

  // Body
  for (const { pattern, value } of bodyAliases) {
    if (pattern.test(low)) {
      signals.body = value;
      break;
    }
  }

  // Condition
  for (const { pattern, value } of conditionAliases) {
    if (pattern.test(low)) {
      signals.condition = value;
      break;
    }
  }

  // Steering
  for (const { pattern, value } of steeringAliases) {
    if (pattern.test(low)) {
      signals.steering = value;
      break;
    }
  }

  // Engine volume
  for (const { pattern, value } of engineVolumeAliases) {
    if (pattern.test(low)) {
      signals.engineVolume = value;
      break;
    }
  }

  // Ownership / use-case
  if (ownershipAliases.personal.test(low)) {
    signals.useCase = "personal";
    signals.isForResale = false;
    signals.isLegalEntity = false;
  } else if (ownershipAliases.resale.test(low)) {
    signals.useCase = "resale";
    signals.isForResale = true;
  } else if (ownershipAliases.legalEntity.test(low)) {
    signals.useCase = "legal_entity";
    signals.isLegalEntity = true;
  }

  // Priority
  if (priorityAliases.cheapest.test(low)) {
    signals.priority = "cheapest";
  } else if (priorityAliases.betterCondition.test(low)) {
    signals.priority = "better_condition";
  }

  // Color
  for (const { pattern, value } of colorAliases) {
    if (pattern.test(low)) {
      signals.color = value;
      break;
    }
  }

  // No-Russia mileage
  if (noRussiaMileagePattern.test(low)) {
    signals.noRussiaMileage = true;
  }

  // Budget guidance
  if (budgetGuidancePattern.test(low)) {
    signals.budgetGuidance = true;
  }

  // Negative flags
  const negFlags: string[] = [];
  for (const { pattern, flag } of negativeFlagPatterns) {
    if (pattern.test(low)) {
      negFlags.push(flag);
    }
  }
  // Also check for negation: "не топляк", "не распил" → user is EXCLUDING these
  // These are user preferences, not negative facts about a car they're buying
  if (negFlags.length > 0) {
    signals.negativeFlags = negFlags;
  }

  // Seller claims
  const claims: SellerClaim[] = [];
  for (const { pattern, meaning } of sellerClaimPatterns) {
    const m = low.match(pattern);
    if (m) {
      claims.push({
        original: m[0],
        meaning,
        trust: "soft_claim",
      });
    }
  }
  if (claims.length > 0) {
    signals.sellerClaims = claims;
  }

  return signals;
}

/**
 * Detect exclusion patterns: "не дрова", "не распил", "не топляк"
 * Returns list of excluded negative flags (things the user does NOT want).
 */
export function extractExcludedNegativeFlags(text: string): string[] {
  const low = text.toLowerCase().replace(/ё/g, "е");
  const excluded: string[] = [];

  const exclusionPatterns: Array<{ pattern: RegExp; flag: string }> = [
    { pattern: /не\s+(?:топляк)/i, flag: "flood_damage" },
    { pattern: /не\s+(?:перевертыш)/i, flag: "rollover_history" },
    { pattern: /не\s+(?:распил)/i, flag: "cut_import" },
    { pattern: /не\s+(?:конструктор)/i, flag: "constructor_import" },
    { pattern: /не\s+(?:дрова|ведро|ушат|корч)/i, flag: "poor_condition" },
  ];

  for (const { pattern, flag } of exclusionPatterns) {
    if (pattern.test(low)) {
      excluded.push(flag);
    }
  }
  return excluded;
}

/**
 * Extract seller claim signals from text.
 * Returns only soft_claim items — things a seller says that should not
 * be treated as facts in bot responses.
 */
export function extractSellerClaimSignals(text: string): SellerClaim[] {
  const low = text.toLowerCase().replace(/ё/g, "е");
  const claims: SellerClaim[] = [];

  for (const { pattern, meaning } of sellerClaimPatterns) {
    const m = low.match(pattern);
    if (m) {
      claims.push({
        original: m[0],
        meaning,
        trust: "soft_claim",
      });
    }
  }
  return claims;
}

/**
 * Detect if user is requesting approximate budget guidance.
 */
export function extractApproxBudgetIntent(text: string): boolean {
  const low = text.toLowerCase().replace(/ё/g, "е");
  return budgetGuidancePattern.test(low);
}

/**
 * Normalize numeric slang in Russian text.
 * Extends the basic normalization already in extractStateUpdate.
 */
export function normalizeNumericSlang(text: string): string {
  let t = text;
  t = t.replace(/(?<![а-яА-Яa-zA-Z])двушк[а-яё]*/gi, "2.0 л");
  t = t.replace(/(?<![а-яА-Яa-zA-Z])двалитр[а-яё]*/gi, "2.0 л");
  t = t.replace(/(?<![а-яА-Яa-zA-Z])один\s+(?:и\s+)?пять(?![а-яА-Яa-zA-Z])/gi, "1.5");
  t = t.replace(/(?<![а-яА-Яa-zA-Z])трешк[а-яё]*/gi, "3.0 л");
  return t;
}
