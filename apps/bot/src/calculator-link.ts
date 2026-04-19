/**
 * Phase 7.6.5 — build a pre-filled link to the web `/calculator` page from
 * the bot's conversation state.
 *
 * Deliberately kept as a small, pure module so the append step in
 * `getAIResponse` is a three-line edit and the behavior can be tested in
 * isolation. It does NOT import from `bot.ts` and has no side effects.
 *
 * Param names and encoding match the web page contract exactly
 * (`apps/web/lib/calculator-url.ts`): `type`, `volume`, `age`, `fuel`,
 * `van`, `lowJpy`, `highJpy`, `resale`, `legal`. A partial URL with only
 * some of these is valid — the web form will hydrate matching fields and
 * fall back to defaults for the rest.
 */

/**
 * Narrow subset of `ConversationState` this helper needs. We keep the
 * input shape explicit so bot.ts only passes relevant bits and tests can
 * build fixtures without importing the full bot state machine.
 */
export interface CalculatorLinkInput {
  activeIntent?: string | null;
  stage?: string | null;

  /**
   * Hint for the web page's vehicleType enum (`car|jeep|moto`).
   * `special`/`special_vehicle` suppresses the link entirely — those flows
   * are operator-only and we don't want to imply a self-service path.
   * Unknown / `restricted` / `null` → `"car"` (safe default on the page).
   */
  vehicleTypeHint?: "car" | "jeep" | "moto" | "restricted" | "special" | "special_vehicle" | null;

  volumeCm3?: number | null;
  year?: number | null;
  ageWindow?: "passable" | "non_passable" | null;
  nonPassableType?: "under_3_years" | "over_5_years" | null;

  /** Bot-side fuel enum. Mapped to the web enum by this helper. */
  fuelType?: "gasoline" | "hybrid" | "diesel" | "ev" | "phev" | null;

  /**
   * Auction-price bounds in JPY. When the bot only knows a single price
   * (explicit customer JPY), pass it as both low and high.
   */
  auctionPriceJPYLow?: number | null;
  auctionPriceJPYHigh?: number | null;

  isForResale?: boolean | null;
  isLegalEntity?: boolean | null;

  /** Free-form body string; used for VAN detection (matches buildCalcParamsFromState). */
  bodyText?: string | null;
}

/**
 * Resolve the origin for the calculator URL. Mirrors `apps/web/lib/seo.ts`
 * SITE_URL precedence (NEXT_PUBLIC_SITE_URL → SITE_URL → loud placeholder)
 * so a misconfigured prod bot emits a visibly-broken URL instead of one
 * pointing at example.com.
 */
function resolveBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    "https://set-site-url.invalid";
  return raw.trim().replace(/\/+$/, "");
}

/**
 * Bot state has the year — recover age in whole years. For age-window
 * only, use the same anchors as `buildCalcParamsFromState` so the web
 * page shows a number consistent with what the bot computed internally.
 */
function computeAgeYears(input: CalculatorLinkInput, now: Date = new Date()): number | null {
  if (typeof input.year === "number" && input.year > 1900) {
    const age = now.getFullYear() - input.year;
    return age >= 0 && age <= 40 ? age : null;
  }
  if (input.ageWindow === "passable") return 4;
  if (input.ageWindow === "non_passable") {
    if (input.nonPassableType === "under_3_years") return 1;
    if (input.nonPassableType === "over_5_years") return 7;
  }
  return null;
}

/**
 * Best-effort VAN detection from the free-form body string; same markers
 * `buildCalcParamsFromState` uses. Returns null when the body is absent
 * (so we don't overwrite a web default by guessing).
 */
function detectVan(body: string | null | undefined): boolean | null {
  if (!body) return null;
  const l = body.toLowerCase();
  if (
    l.includes("van") ||
    l.includes("минивэн") ||
    l.includes("минивен") ||
    l.includes("микроавтобус") ||
    l.includes("фургон")
  ) {
    return true;
  }
  return null;
}

const FUEL_MAP: Record<NonNullable<CalculatorLinkInput["fuelType"]>, "ice" | "hybrid" | "electric" | "diesel"> = {
  gasoline: "ice",
  diesel: "diesel",
  hybrid: "hybrid",
  phev: "hybrid",
  ev: "electric",
};

/**
 * Defaults for params the bot hasn't learned yet. Must match the web
 * form's `DEFAULTS` constant (apps/web/components/Calculator/TurnkeyCalculator.tsx)
 * so unknowns render as the same neutral baseline the form shows on a
 * cold open. This is required because the web decoder
 * (`apps/web/lib/calculator-url.ts#decodeCalculatorState`) is strict —
 * any missing key short-circuits to defaults, which would drop every
 * prefilled value. Emitting a full URL with sensible unknowns keeps the
 * prefill promise.
 */
const WEB_DEFAULTS = {
  type: "car" as const,
  volume: 2000,
  age: 4,
  fuel: "ice" as const,
  van: false,
  lowJpy: 1_500_000,
  highJpy: 2_200_000,
  resale: false,
  legal: false,
};

/**
 * Build a pre-filled calculator URL for the current conversation, or
 * `null` when the conversation is not calculator-related.
 *
 * Gating (spec §7.6.5 — "calculator-related conversations"):
 *   - `activeIntent === "price_calc"`, OR
 *   - `stage === "ready_to_calculate"` (auto-calc flow),
 *   - AND vehicleTypeHint is not `special*` (operator-only).
 *
 * When gated-in, ALL nine web-contract keys are emitted so the web form
 * decodes the URL successfully and hydrates every field; unknowns use
 * the web's own default values (see `WEB_DEFAULTS`).
 */
export function buildCalculatorLink(input: CalculatorLinkInput, baseUrl?: string): string | null {
  const calcRelevant =
    input.activeIntent === "price_calc" || input.stage === "ready_to_calculate";
  if (!calcRelevant) return null;

  if (input.vehicleTypeHint === "special" || input.vehicleTypeHint === "special_vehicle") {
    return null;
  }

  const origin = (baseUrl ?? resolveBaseUrl()).replace(/\/+$/, "");
  const sp = new URLSearchParams();

  // type — web accepts only car|jeep|moto; everything else collapses to car.
  const type: "car" | "jeep" | "moto" =
    input.vehicleTypeHint === "jeep" || input.vehicleTypeHint === "moto"
      ? input.vehicleTypeHint
      : WEB_DEFAULTS.type;

  // fuel — map bot enum to web enum; unknown → web default.
  const mappedFuel = input.fuelType ? FUEL_MAP[input.fuelType] : undefined;
  const fuel = mappedFuel ?? WEB_DEFAULTS.fuel;

  // volume — electric must be 0 (web schema refine); otherwise clamp-ish.
  let volume: number;
  if (fuel === "electric") {
    volume = 0;
  } else if (typeof input.volumeCm3 === "number" && input.volumeCm3 >= 0 && input.volumeCm3 <= 10_000) {
    volume = Math.round(input.volumeCm3);
  } else {
    volume = WEB_DEFAULTS.volume;
  }

  // age — year wins over window; final fallback to web default.
  const age = computeAgeYears(input) ?? WEB_DEFAULTS.age;

  // van — only true when the body text signals it; otherwise false.
  const van = detectVan(input.bodyText) === true;

  // price — use the bot's known bounds when present; otherwise web defaults.
  // Enforce lowJpy <= highJpy (web schema refine); asymmetric knowns are
  // symmetrized by mirroring the known bound.
  let lowJpy =
    typeof input.auctionPriceJPYLow === "number" && input.auctionPriceJPYLow >= 0
      ? Math.round(input.auctionPriceJPYLow)
      : null;
  let highJpy =
    typeof input.auctionPriceJPYHigh === "number" && input.auctionPriceJPYHigh >= 0
      ? Math.round(input.auctionPriceJPYHigh)
      : null;
  if (lowJpy == null && highJpy == null) {
    lowJpy = WEB_DEFAULTS.lowJpy;
    highJpy = WEB_DEFAULTS.highJpy;
  } else if (lowJpy == null) {
    lowJpy = highJpy as number;
  } else if (highJpy == null) {
    highJpy = lowJpy;
  }
  // At this point both are numbers — narrow via locals to satisfy strict null checks.
  const finalLow: number = lowJpy;
  let finalHigh: number = highJpy as number;
  if (finalHigh < finalLow) finalHigh = finalLow;

  const resale = input.isForResale ?? WEB_DEFAULTS.resale;
  const legal = input.isLegalEntity ?? WEB_DEFAULTS.legal;

  // Emit in the same order as encodeCalculatorState in the web helper
  // (type, volume, age, fuel, van, lowJpy, highJpy, resale, legal) so a
  // URL diff stays stable and readable across the two sides.
  sp.set("type", type);
  sp.set("volume", String(volume));
  sp.set("age", String(age));
  sp.set("fuel", fuel);
  sp.set("van", van ? "1" : "0");
  sp.set("lowJpy", String(finalLow));
  sp.set("highJpy", String(finalHigh));
  sp.set("resale", resale ? "1" : "0");
  sp.set("legal", legal ? "1" : "0");

  return `${origin}/calculator?${sp.toString()}`;
}
