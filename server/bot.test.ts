/**
 * Regression tests for follow-up slot extraction and pending-question logic.
 *
 * Run with: BOT_TEST_MODE=1 npx tsx server/bot.test.ts
 *
 * Tests the exact dialogue from the bug report:
 * Turn 1: "можешь посчитать везела, не проходного, передний привод, самый простой, оценка R тоже можно"
 * Turn 2: "До трех лет. полторашка, машина для себя. Бюджет не знаю, засвети стоимости"
 */

import {
  _test_extractStateUpdate as extractStateUpdate,
  _test_applyStateUpdate as applyStateUpdate,
  _test_buildSafeFallbackReply as buildSafeFallbackReply,
  _test_planReply as planReply,
  _test_getMissingCalcCriticalFields as getMissingCalcCriticalFields,
  _test_hasAllCalcCriticalFields as hasAllCalcCriticalFields,
  _test_DEFAULT_CONVERSATION_STATE as DEFAULT_CONVERSATION_STATE,
  type _test_ConversationState as ConversationState,
} from "./bot.js";

import {
  extractSlangSignals,
  normalizeAutoSlang,
  type SellerClaim,
} from "./slang.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual === expected) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// ─── Turn 1 ──────────────────────────────────────────────
console.log("\n═══ Turn 1: Initial request ═══");
const turn1Msg = "можешь посчитать везела, не проходного, передний привод, самый простой, оценка R тоже можно";

const turn1Update = extractStateUpdate(turn1Msg, { ...DEFAULT_CONVERSATION_STATE });
const stateAfterTurn1 = applyStateUpdate(
  { ...DEFAULT_CONVERSATION_STATE },
  turn1Update,
  "regex",
);

assertEqual(stateAfterTurn1.model, "Vezel", "Turn 1: model = Vezel");
assertEqual(stateAfterTurn1.make, "Honda", "Turn 1: make = Honda");
assertEqual(stateAfterTurn1.ageWindow, "non_passable", "Turn 1: ageWindow = non_passable");
assertEqual(stateAfterTurn1.nonPassableType, null, "Turn 1: nonPassableType = null (needs clarification)");
assertEqual(stateAfterTurn1.drivetrain, "fwd", "Turn 1: drivetrain = fwd");
assertEqual(stateAfterTurn1.trimLevel, "base", "Turn 1: trimLevel = base");
assert(
  stateAfterTurn1.auctionGradesAllowed.includes("R"),
  "Turn 1: auctionGradesAllowed includes R",
);
assertEqual(stateAfterTurn1.activeIntent, "price_calc", "Turn 1: activeIntent = price_calc");

// Verify Turn 1 reply asks about nonPassableType (and other missing fields)
const turn1Plan = planReply(stateAfterTurn1, turn1Msg);
const turn1Reply = await buildSafeFallbackReply(stateAfterTurn1, turn1Plan);
console.log(`\n  Turn 1 reply: "${turn1Reply}"`);
assert(turn1Reply.includes("понял"), "Turn 1 reply: confirms understood info");
assert(
  turn1Reply.includes("до 3 лет") || turn1Reply.includes("старше 5 лет"),
  "Turn 1 reply: asks about nonPassableType",
);

// ─── Turn 2 ──────────────────────────────────────────────
console.log("\n═══ Turn 2: Follow-up answers ═══");
const turn2Msg = "До трех лет. полторашка, машина для себя. Бюджет не знаю, засвети стоимости";

const turn2Update = extractStateUpdate(turn2Msg, stateAfterTurn1);
const stateAfterTurn2 = applyStateUpdate(
  stateAfterTurn1,
  turn2Update,
  "regex",
);

// Verify slot extraction
assertEqual(stateAfterTurn2.nonPassableType, "under_3_years", "Turn 2: nonPassableType = under_3_years");
assertEqual(stateAfterTurn2.volumeCm3, 1500, "Turn 2: volumeCm3 = 1500 (полторашка → 1.5л → 1500)");
assertEqual(stateAfterTurn2.isForResale, false, "Turn 2: isForResale = false (для себя)");
assertEqual(stateAfterTurn2.isLegalEntity, false, "Turn 2: isLegalEntity = false (для себя)");
assertEqual(stateAfterTurn2.budgetText, "approximate_guidance", "Turn 2: budgetText = approximate_guidance");

// Verify model is preserved from Turn 1
assertEqual(stateAfterTurn2.model, "Vezel", "Turn 2: model still Vezel");
assertEqual(stateAfterTurn2.make, "Honda", "Turn 2: make still Honda");
assertEqual(stateAfterTurn2.ageWindow, "non_passable", "Turn 2: ageWindow still non_passable");
assertEqual(stateAfterTurn2.drivetrain, "fwd", "Turn 2: drivetrain still fwd");
assertEqual(stateAfterTurn2.trimLevel, "base", "Turn 2: trimLevel still base");

// Verify Turn 2 reply does NOT re-ask for filled slots
const turn2Plan = planReply(stateAfterTurn2, turn2Msg);
const turn2Reply = await buildSafeFallbackReply(stateAfterTurn2, turn2Plan);
console.log(`\n  Turn 2 reply: "${turn2Reply}"`);

assert(!turn2Reply.includes("до 3 лет или старше 5 лет"), "Turn 2 reply: does NOT re-ask about nonPassableType");
assert(!turn2Reply.includes("какой объём двигателя"), "Turn 2 reply: does NOT re-ask about engine volume");
assert(
  !turn2Reply.includes("физлицо, юрлицо или под перепродажу") &&
  !turn2Reply.includes("физлицо или юрлицо"),
  "Turn 2 reply: does NOT re-ask about ownership",
);
assert(
  turn2Reply.includes("среднерыночн") || turn2Reply.includes("рассчитаю") || turn2Reply.includes("диапазон") || turn2Reply.includes("бюджет") || turn2Reply.includes("сориентировать") || turn2Reply.includes("рынку"),
  "Turn 2 reply: provides budget guidance instead of asking for exact price",
);

// ─── Additional unit tests for Russian numeric normalization ───
console.log("\n═══ Russian Numeric Normalization Tests ═══");

// "до трёх лет" (with ё)
{
  const prevState: ConversationState = {
    ...DEFAULT_CONVERSATION_STATE,
    ageWindow: "non_passable",
    model: "Vezel",
    make: "Honda",
    activeIntent: "price_calc",
  };
  const update = extractStateUpdate("до трёх лет", prevState);
  assertEqual(update.set.nonPassableType, "under_3_years", "Normalization: 'до трёх лет' → under_3_years");
}

// "до 3-х лет"
{
  const prevState: ConversationState = {
    ...DEFAULT_CONVERSATION_STATE,
    ageWindow: "non_passable",
    model: "Vezel",
    make: "Honda",
    activeIntent: "price_calc",
  };
  const update = extractStateUpdate("до 3-х лет", prevState);
  assertEqual(update.set.nonPassableType, "under_3_years", "Normalization: 'до 3-х лет' → under_3_years");
}

// "трехлетка"
{
  const prevState: ConversationState = {
    ...DEFAULT_CONVERSATION_STATE,
    model: "Vezel",
    make: "Honda",
    activeIntent: "price_calc",
  };
  const update = extractStateUpdate("трехлетка", prevState);
  assertEqual(update.set.nonPassableType, "under_3_years", "Normalization: 'трехлетка' → under_3_years");
  assertEqual(update.set.ageWindow, "non_passable", "Normalization: 'трехлетка' → ageWindow = non_passable");
}

// "полторашка" as volume
{
  const update = extractStateUpdate("полторашка", { ...DEFAULT_CONVERSATION_STATE });
  assertEqual(update.set.volumeCm3, 1500, "Volume: 'полторашка' → 1500 cm³");
}

// "полтора литра" as volume
{
  const update = extractStateUpdate("полтора литра", { ...DEFAULT_CONVERSATION_STATE });
  assertEqual(update.set.volumeCm3, 1500, "Volume: 'полтора литра' → 1500 cm³");
}

// "1.5" as volume (fallback)
{
  const update = extractStateUpdate("1.5 л", { ...DEFAULT_CONVERSATION_STATE });
  assertEqual(update.set.volumeCm3, 1500, "Volume: '1.5 л' → 1500 cm³");
}

// "от 5 лет" standalone
{
  const prevState: ConversationState = {
    ...DEFAULT_CONVERSATION_STATE,
    ageWindow: "non_passable",
    model: "Vezel",
    make: "Honda",
    activeIntent: "price_calc",
  };
  const update = extractStateUpdate("от 5 лет", prevState);
  assertEqual(update.set.nonPassableType, "over_5_years", "Age: 'от 5 лет' → over_5_years");
}

// "старше 5 лет"
{
  const prevState: ConversationState = {
    ...DEFAULT_CONVERSATION_STATE,
    ageWindow: "non_passable",
    model: "Vezel",
    make: "Honda",
    activeIntent: "price_calc",
  };
  const update = extractStateUpdate("старше 5 лет", prevState);
  assertEqual(update.set.nonPassableType, "over_5_years", "Age: 'старше 5 лет' → over_5_years");
}

// "5+ лет" standalone
{
  const prevState: ConversationState = {
    ...DEFAULT_CONVERSATION_STATE,
    ageWindow: "non_passable",
    model: "Vezel",
    make: "Honda",
    activeIntent: "price_calc",
  };
  const update = extractStateUpdate("5+ лет", prevState);
  assertEqual(update.set.nonPassableType, "over_5_years", "Age: '5+ лет' → over_5_years");
}

// "для себя" ownership
{
  const update = extractStateUpdate("машина для себя", { ...DEFAULT_CONVERSATION_STATE });
  assertEqual(update.set.isForResale, false, "Ownership: 'машина для себя' → isForResale = false");
  assertEqual(update.set.isLegalEntity, false, "Ownership: 'машина для себя' → isLegalEntity = false");
}

// Budget unknown phrases
{
  const update = extractStateUpdate("бюджет не знаю", { ...DEFAULT_CONVERSATION_STATE });
  assertEqual(update.set.budgetText, "approximate_guidance", "Budget: 'бюджет не знаю' → approximate_guidance");
}
{
  const update = extractStateUpdate("засвети стоимости", { ...DEFAULT_CONVERSATION_STATE });
  assertEqual(update.set.budgetText, "approximate_guidance", "Budget: 'засвети стоимости' → approximate_guidance");
}
{
  const update = extractStateUpdate("дай примерный бюджет", { ...DEFAULT_CONVERSATION_STATE });
  assertEqual(update.set.budgetText, "approximate_guidance", "Budget: 'дай примерный бюджет' → approximate_guidance");
}

// "до 3 лет" should NOT be matched as budgetText
{
  const update = extractStateUpdate("до 3 лет", { ...DEFAULT_CONVERSATION_STATE });
  assert(
    update.set.budgetText !== "до 3 лет" && update.set.budgetText !== "до 3",
    "Budget guard: 'до 3 лет' is NOT parsed as budget",
  );
}

// ═══════════════════════════════════════════════════════════
// SLANG NORMALIZATION REGRESSION TESTS
// ═══════════════════════════════════════════════════════════

// ─── Test A: "везел, не проходной, передок, самая простая, r можно" ───
console.log("\n═══ Slang Test A: Full slang phrase ═══");
{
  const msg = "везел, не проходной, передок, самая простая, r можно";
  const update = extractStateUpdate(msg, { ...DEFAULT_CONVERSATION_STATE });
  const state = applyStateUpdate({ ...DEFAULT_CONVERSATION_STATE }, update, "regex");

  assertEqual(state.model, "Vezel", "A: model = Vezel");
  assertEqual(state.make, "Honda", "A: make = Honda");
  assertEqual(state.ageWindow, "non_passable", "A: ageWindow = non_passable");
  assertEqual(state.drivetrain, "fwd", "A: drivetrain = fwd (передок)");
  assertEqual(state.trimLevel, "base", "A: trimLevel = base (самая простая)");
  assert(state.auctionGradesAllowed.includes("R"), "A: R grade allowed");
}

// ─── Test B: "до трех лет, полторашка, для себя, бюджет не знаю, засвети стоимости" ───
console.log("\n═══ Slang Test B: Age + volume + ownership + budget guidance ═══");
{
  const prevState: ConversationState = {
    ...DEFAULT_CONVERSATION_STATE,
    model: "Vezel",
    make: "Honda",
    ageWindow: "non_passable",
    activeIntent: "price_calc",
  };
  const msg = "до трех лет, полторашка, для себя, бюджет не знаю, засвети стоимости";
  const update = extractStateUpdate(msg, prevState);
  const state = applyStateUpdate(prevState, update, "regex");

  assertEqual(state.nonPassableType, "under_3_years", "B: nonPassableType = under_3_years");
  assertEqual(state.volumeCm3, 1500, "B: volumeCm3 = 1500 (полторашка)");
  assertEqual(state.isForResale, false, "B: isForResale = false (для себя)");
  assertEqual(state.isLegalEntity, false, "B: isLegalEntity = false (для себя)");
  assertEqual(state.budgetText, "approximate_guidance", "B: budgetText = approximate_guidance");

  // Verify the reply
  const plan = planReply(state, msg);
  const reply = await buildSafeFallbackReply(state, plan);
  console.log(`  Reply B: "${reply}"`);
  assert(reply.includes("понял"), "B reply: confirms understood info");
  assert(reply.includes("1500") || reply.includes("объём"), "B reply: mentions volume");
  assert(reply.includes("для себя") || reply.includes("физлицо"), "B reply: mentions ownership");
}

// ─── Test C: "нужна не дрова, живая, не топляк, не распил" ───
console.log("\n═══ Slang Test C: Better condition + excluded negative flags ═══");
{
  const msg = "нужна не дрова, живая, не топляк, не распил";
  const update = extractStateUpdate(msg, { ...DEFAULT_CONVERSATION_STATE });
  const state = applyStateUpdate({ ...DEFAULT_CONVERSATION_STATE }, update, "regex");

  assertEqual(state.condition, "decent", "C: condition = decent (живая)");
  assert(state.excludedNegativeFlags.includes("poor_condition"), "C: excluded poor_condition (не дрова)");
  assert(state.excludedNegativeFlags.includes("flood_damage"), "C: excluded flood_damage (не топляк)");
  assert(state.excludedNegativeFlags.includes("cut_import"), "C: excluded cut_import (не распил)");

  const plan = planReply(state, msg);
  const reply = await buildSafeFallbackReply(state, plan);
  console.log(`  Reply C: "${reply}"`);
  assert(reply.includes("живое состояние") || reply.includes("живая"), "C reply: mentions good condition");
}

// ─── Test D: "ищу беспробежку, на палке, передок, сарай" ───
console.log("\n═══ Slang Test D: No-Russia mileage + MT + FWD + wagon ═══");
{
  const msg = "ищу беспробежку, на палке, передок, сарай";
  const update = extractStateUpdate(msg, { ...DEFAULT_CONVERSATION_STATE });
  const state = applyStateUpdate({ ...DEFAULT_CONVERSATION_STATE }, update, "regex");

  assertEqual(state.noRussiaMileage, true, "D: noRussiaMileage = true (беспробежку)");
  assertEqual(state.transmission, "manual", "D: transmission = manual (на палке)");
  assertEqual(state.drivetrain, "fwd", "D: drivetrain = fwd (передок)");
  assertEqual(state.body, "wagon", "D: body = wagon (сарай)");

  const plan = planReply(state, msg);
  const reply = await buildSafeFallbackReply(state, plan);
  console.log(`  Reply D: "${reply}"`);
  assert(reply.includes("без пробега по РФ") || reply.includes("беспробежн"), "D reply: mentions no-Russia mileage");
  assert(reply.includes("механика") || reply.includes("МТ"), "D reply: mentions manual transmission");
  assert(reply.includes("wagon") || reply.includes("кузов"), "D reply: mentions wagon body");
}

// ─── Test E: "варик, клима, люкатая, жирная комплектация" ───
console.log("\n═══ Slang Test E: CVT + climate + sunroof + top trim ═══");
{
  const msg = "варик, клима, люкатая, жирная комплектация";
  const update = extractStateUpdate(msg, { ...DEFAULT_CONVERSATION_STATE });
  const state = applyStateUpdate({ ...DEFAULT_CONVERSATION_STATE }, update, "regex");

  assertEqual(state.transmission, "cvt", "E: transmission = cvt (варик)");
  assertEqual(state.hasClimate, true, "E: hasClimate = true (клима)");
  assertEqual(state.hasSunroof, true, "E: hasSunroof = true (люкатая)");
  assertEqual(state.trimLevel, "top", "E: trimLevel = top (жирная комплектация)");

  const plan = planReply(state, msg);
  const reply = await buildSafeFallbackReply(state, plan);
  console.log(`  Reply E: "${reply}"`);
  assert(reply.includes("вариатор"), "E reply: mentions CVT");
  assert(reply.includes("климат") || reply.includes("клима"), "E reply: mentions climate");
  assert(reply.includes("люк"), "E reply: mentions sunroof");
  assert(reply.includes("топовая") || reply.includes("максимальн"), "E reply: mentions top trim");
}

// ─── Test F: Seller claims (NOT hard facts) ───
console.log("\n═══ Slang Test F: Seller claims as soft trust ═══");
{
  const msg = "продавец пишет: кузов в родне, мотор масло не берет, коробка не пинается";
  const update = extractStateUpdate(msg, { ...DEFAULT_CONVERSATION_STATE });
  const state = applyStateUpdate({ ...DEFAULT_CONVERSATION_STATE }, update, "regex");

  assert(state.sellerClaims.length >= 3, "F: at least 3 seller claims detected");

  const claimMeanings = state.sellerClaims.map(c => c.meaning);
  assert(claimMeanings.includes("seller_claims_original_paint"), "F: seller claim: original paint");
  assert(claimMeanings.includes("seller_claims_no_oil_consumption"), "F: seller claim: no oil consumption");
  assert(claimMeanings.includes("seller_claims_transmission_ok"), "F: seller claim: transmission ok");

  // All claims must be soft_claim trust level
  for (const claim of state.sellerClaims) {
    assertEqual(claim.trust, "soft_claim", `F: claim '${claim.meaning}' trust = soft_claim`);
  }

  // Reply should NOT treat claims as hard facts
  const plan = planReply(state, msg);
  const reply = await buildSafeFallbackReply(state, plan);
  console.log(`  Reply F: "${reply}"`);
  assert(reply.includes("продавец заявляет"), "F reply: uses cautious 'продавец заявляет' language");
}

// ─── Slang: Transmission variants ───
console.log("\n═══ Slang: Transmission variants ═══");
{
  const testCases: Array<[string, string]> = [
    ["на палке", "manual"],
    ["кочерга", "manual"],
    ["мешалка", "manual"],
    ["тяпка", "automatic"],
    ["варик", "cvt"],
    ["вибратор", "cvt"],
  ];
  for (const [input, expected] of testCases) {
    const update = extractStateUpdate(input, { ...DEFAULT_CONVERSATION_STATE });
    assertEqual(update.set.transmission, expected, `Transmission: '${input}' → ${expected}`);
  }
}

// ─── Slang: Drivetrain variants ───
console.log("\n═══ Slang: Drivetrain variants ═══");
{
  const testCases: Array<[string, string]> = [
    ["передок", "fwd"],
    ["задок", "rwd"],
    ["вэдовая", "4wd"],
    ["вэдэшка", "4wd"],
  ];
  for (const [input, expected] of testCases) {
    const update = extractStateUpdate(input, { ...DEFAULT_CONVERSATION_STATE });
    assertEqual(update.set.drivetrain, expected, `Drivetrain: '${input}' → ${expected}`);
  }
}

// ─── Slang: Fuel type variants ───
console.log("\n═══ Slang: Fuel type variants ═══");
{
  const testCases: Array<[string, string]> = [
    ["саляра", "diesel"],
    ["зажигалка", "gasoline"],
    ["гибра", "hybrid"],
    ["гибридка", "hybrid"],
    ["электричка", "ev"],
  ];
  for (const [input, expected] of testCases) {
    const update = extractStateUpdate(input, { ...DEFAULT_CONVERSATION_STATE });
    assertEqual(update.set.fuelType, expected, `Fuel: '${input}' → ${expected}`);
  }
}

// ─── Slang: Body type variants ───
console.log("\n═══ Slang: Body type variants ═══");
{
  const testCases: Array<[string, string]> = [
    ["сарай", "wagon"],
    ["микрик", "minivan"],
    ["паркетник", "crossover"],
    ["джип", "suv"],
    ["купарь", "coupe"],
    ["буханка", "van"],
  ];
  for (const [input, expected] of testCases) {
    const update = extractStateUpdate(input, { ...DEFAULT_CONVERSATION_STATE });
    assertEqual(update.set.body, expected, `Body: '${input}' → ${expected}`);
  }
}

// ─── Slang: Condition variants ───
console.log("\n═══ Slang: Condition variants ═══");
{
  const testCases: Array<[string, string]> = [
    ["ведро с гайками", "poor"],
    ["ушатанная", "poor"],
    ["живая", "decent"],
    ["живой вариант", "decent"],
  ];
  for (const [input, expected] of testCases) {
    const update = extractStateUpdate(input, { ...DEFAULT_CONVERSATION_STATE });
    assertEqual(update.set.condition, expected, `Condition: '${input}' → ${expected}`);
  }
}

// ─── Slang: Steering variants ───
console.log("\n═══ Slang: Steering variants ═══");
{
  const testCases: Array<[string, string]> = [
    ["праворукая", "rhd"],
    ["правильная", "rhd"],
    ["косорукая", "rhd"],
    ["европеец", "lhd"],
  ];
  for (const [input, expected] of testCases) {
    const update = extractStateUpdate(input, { ...DEFAULT_CONVERSATION_STATE });
    assertEqual(update.set.steering, expected, `Steering: '${input}' → ${expected}`);
  }
}

// ─── Slang: Trim / equipment ───
console.log("\n═══ Slang: Trim / equipment ═══");
{
  // Base trim with manual windows
  const update1 = extractStateUpdate("весла", { ...DEFAULT_CONVERSATION_STATE });
  assertEqual(update1.set.trimLevel, "base", "Trim: 'весла' → base");
  assertEqual(update1.set.manualWindows, true, "Trim: 'весла' → manualWindows = true");

  // Top trim
  const update2 = extractStateUpdate("полный фарш", { ...DEFAULT_CONVERSATION_STATE });
  assertEqual(update2.set.trimLevel, "top", "Trim: 'полный фарш' → top");

  // Sunroof
  const update3 = extractStateUpdate("люкатая", { ...DEFAULT_CONVERSATION_STATE });
  assertEqual(update3.set.hasSunroof, true, "Trim: 'люкатая' → hasSunroof = true");

  // Climate
  const update4 = extractStateUpdate("клима", { ...DEFAULT_CONVERSATION_STATE });
  assertEqual(update4.set.hasClimate, true, "Trim: 'клима' → hasClimate = true");
}

// ─── Slang: Engine volume normalization ───
console.log("\n═══ Slang: Engine volume normalization ═══");
{
  const update1 = extractStateUpdate("двушка", { ...DEFAULT_CONVERSATION_STATE });
  assertEqual(update1.set.volumeCm3, 2000, "Volume: 'двушка' → 2000 cm³");

  const update2 = extractStateUpdate("двалитра", { ...DEFAULT_CONVERSATION_STATE });
  assertEqual(update2.set.volumeCm3, 2000, "Volume: 'двалитра' → 2000 cm³");
}

// ─── Slang: Ownership / use-case ───
console.log("\n═══ Slang: Ownership / use-case ═══");
{
  const update1 = extractStateUpdate("под перепродажу", { ...DEFAULT_CONVERSATION_STATE });
  assertEqual(update1.set.isForResale, true, "Ownership: 'под перепродажу' → isForResale = true");

  const update2 = extractStateUpdate("на юрлицо", { ...DEFAULT_CONVERSATION_STATE });
  assertEqual(update2.set.isLegalEntity, true, "Ownership: 'на юрлицо' → isLegalEntity = true");

  const update3 = extractStateUpdate("на фирму", { ...DEFAULT_CONVERSATION_STATE });
  assertEqual(update3.set.isLegalEntity, true, "Ownership: 'на фирму' → isLegalEntity = true");
}

// ─── Slang: Priority ───
console.log("\n═══ Slang: Priority ═══");
{
  const update1 = extractStateUpdate("дешман", { ...DEFAULT_CONVERSATION_STATE });
  assertEqual(update1.set.priority, "cheapest", "Priority: 'дешман' → cheapest");

  const update2 = extractStateUpdate("живую хочу, не ведро", { ...DEFAULT_CONVERSATION_STATE });
  assertEqual(update2.set.priority, "best_condition", "Priority: 'не ведро' → best_condition");
}

// ─── Slang: No-Russia mileage ───
console.log("\n═══ Slang: No-Russia mileage ═══");
{
  const update1 = extractStateUpdate("беспробежная", { ...DEFAULT_CONVERSATION_STATE });
  assertEqual(update1.set.noRussiaMileage, true, "Mileage: 'беспробежная' → noRussiaMileage = true");

  const update2 = extractStateUpdate("беспробежку ищу", { ...DEFAULT_CONVERSATION_STATE });
  assertEqual(update2.set.noRussiaMileage, true, "Mileage: 'беспробежку' → noRussiaMileage = true");
}

// ─── Slang: Negative flags (risk indicators) ───
console.log("\n═══ Slang: Negative flags ═══");
{
  const update = extractStateUpdate("не топляк, не распил, не конструктор", { ...DEFAULT_CONVERSATION_STATE });
  assert(
    (update.set.excludedNegativeFlags ?? []).includes("flood_damage"),
    "NegFlags: 'не топляк' → excluded flood_damage",
  );
  assert(
    (update.set.excludedNegativeFlags ?? []).includes("cut_import"),
    "NegFlags: 'не распил' → excluded cut_import",
  );
  assert(
    (update.set.excludedNegativeFlags ?? []).includes("constructor_import"),
    "NegFlags: 'не конструктор' → excluded constructor_import",
  );
}

// ─── Slang: Turbo detection ───
console.log("\n═══ Slang: Turbo detection ═══");
{
  const update = extractStateUpdate("турбовая", { ...DEFAULT_CONVERSATION_STATE });
  assertEqual(update.set.turbo, true, "Turbo: 'турбовая' → turbo = true");
}

// ─── Slang: Color aliases ───
console.log("\n═══ Slang: Color aliases ═══");
{
  const update1 = extractStateUpdate("снежка", { ...DEFAULT_CONVERSATION_STATE });
  assertEqual(update1.set.color, "серебристый", "Color: 'снежка' → серебристый");

  const update2 = extractStateUpdate("бесцветная", { ...DEFAULT_CONVERSATION_STATE });
  assertEqual(update2.set.color, "белый", "Color: 'бесцветная' → белый");
}

// ─── Slang: Budget guidance phrases ───
console.log("\n═══ Slang: Budget guidance phrases ═══");
{
  const phrases = [
    "дай вилку",
    "сориентируй по бюджету",
  ];
  for (const phrase of phrases) {
    const update = extractStateUpdate(phrase, { ...DEFAULT_CONVERSATION_STATE });
    assertEqual(update.set.budgetText, "approximate_guidance", `Budget: '${phrase}' → approximate_guidance`);
  }
}

// ─── Slang: Combined complex phrase (like real user) ───
console.log("\n═══ Slang: Complex combined phrases ═══");
{
  // Real user-like message combining multiple slang terms
  const msg = "везел, передок, на веслах, для себя, полторашка, R можно, засвети бюджет";
  const update = extractStateUpdate(msg, { ...DEFAULT_CONVERSATION_STATE });
  const state = applyStateUpdate({ ...DEFAULT_CONVERSATION_STATE }, update, "regex");

  assertEqual(state.model, "Vezel", "Complex: model = Vezel");
  assertEqual(state.make, "Honda", "Complex: make = Honda");
  assertEqual(state.drivetrain, "fwd", "Complex: drivetrain = fwd (передок)");
  assertEqual(state.trimLevel, "base", "Complex: trimLevel = base (на веслах)");
  assertEqual(state.manualWindows, true, "Complex: manualWindows = true (на веслах)");
  assertEqual(state.isForResale, false, "Complex: isForResale = false (для себя)");
  assertEqual(state.isLegalEntity, false, "Complex: isLegalEntity = false (для себя)");
  assertEqual(state.volumeCm3, 1500, "Complex: volumeCm3 = 1500 (полторашка)");
  assert(state.auctionGradesAllowed.includes("R"), "Complex: R grade allowed");
  assertEqual(state.budgetText, "approximate_guidance", "Complex: budgetText = approximate_guidance");
}

// ═══════════════════════════════════════════════════════════
// EXPANDED SLANG REGRESSION TESTS (production-critical coverage)
// ═══════════════════════════════════════════════════════════

// ─── Drivetrain: expanded aliases ───
console.log("\n═══ Expanded Slang: Drivetrain ═══");
{
  const testCases: Array<[string, string]> = [
    ["вд", "4wd"],
    ["4вд", "4wd"],
    ["4wd", "4wd"],
    ["4х4", "4wd"],
    ["4x4", "4wd"],
    ["полноприводная", "4wd"],
    ["переднеприводная", "fwd"],
    ["заднеприводная", "rwd"],
  ];
  for (const [input, expected] of testCases) {
    const update = extractStateUpdate(input, { ...DEFAULT_CONVERSATION_STATE });
    assertEqual(update.set.drivetrain, expected, `Drivetrain: '${input}' → ${expected}`);
  }
}

// ─── Transmission: expanded aliases ───
console.log("\n═══ Expanded Slang: Transmission ═══");
{
  const testCases: Array<[string, string]> = [
    ["на палке", "manual"],
    ["палка", "manual"],
    ["мкпп", "manual"],
    ["дёргалка", "manual"],
    ["ручная коробка", "manual"],
    ["тяпка", "automatic"],
    ["автомат", "automatic"],
    ["акпп", "automatic"],
    ["коробка-автомат", "automatic"],
    ["робот", "automatic"],
    ["ркпп", "automatic"],
    ["варик", "cvt"],
    ["вариатор", "cvt"],
  ];
  for (const [input, expected] of testCases) {
    const update = extractStateUpdate(input, { ...DEFAULT_CONVERSATION_STATE });
    assertEqual(update.set.transmission, expected, `Transmission: '${input}' → ${expected}`);
  }
}

// ─── Trim/Equipment: expanded aliases ───
console.log("\n═══ Expanded Slang: Trim/Equipment ═══");
{
  // Base trim
  const baseCases = [
    "весла", "пустая комплектация", "деревянная", "голая", "лысая",
    "бомжпакет", "минималка", "без наворотов",
  ];
  for (const input of baseCases) {
    const update = extractStateUpdate(input, { ...DEFAULT_CONVERSATION_STATE });
    assertEqual(update.set.trimLevel, "base", `Trim base: '${input}' → base`);
  }

  // Top trim
  const topCases = [
    "фарш", "полный фарш", "жирная комплектация", "навороченная",
    "упакованная", "люксовая", "топовая комплектация", "максималка",
    "нафаршированная", "всё включено",
  ];
  for (const input of topCases) {
    const update = extractStateUpdate(input, { ...DEFAULT_CONVERSATION_STATE });
    assertEqual(update.set.trimLevel, "top", `Trim top: '${input}' → top`);
  }
}

// ─── Engine volume: expanded aliases ───
console.log("\n═══ Expanded Slang: Engine Volume ═══");
{
  const testCases: Array<[string, number]> = [
    ["полторашка", 1500],
    ["двушка", 2000],
    ["двалитра", 2000],
    ["трешка", 3000],
    ["литрушка", 1000],
    ["1.5 л", 1500],
    ["2.0 л", 2000],
    ["3.0 л", 3000],
    ["2.4 л", 2400],
    ["2.5 л", 2500],
    ["3.5 л", 3500],
    ["4.0 л", 4000],
  ];
  for (const [input, expected] of testCases) {
    const update = extractStateUpdate(input, { ...DEFAULT_CONVERSATION_STATE });
    assertEqual(update.set.volumeCm3, expected, `Volume: '${input}' → ${expected} cm³`);
  }
}

// ─── Body type: expanded aliases ───
console.log("\n═══ Expanded Slang: Body Type ═══");
{
  const testCases: Array<[string, string]> = [
    ["сарай", "wagon"],
    ["паркетник", "crossover"],
    ["микрик", "minivan"],
    ["лифтбек", "liftback"],
    ["рамник", "suv"],
    ["купарь", "coupe"],
    ["кабрик", "cabrio"],
    ["буханка", "van"],
    ["каблук", "van"],
    ["пикап", "pickup"],
    ["хэтч", "hatchback"],
    ["бочка", "sedan"],
  ];
  for (const [input, expected] of testCases) {
    const update = extractStateUpdate(input, { ...DEFAULT_CONVERSATION_STATE });
    assertEqual(update.set.body, expected, `Body: '${input}' → ${expected}`);
  }
}

// ─── Condition: expanded aliases ───
console.log("\n═══ Expanded Slang: Condition ═══");
{
  const poorCases = [
    "ведро", "корч", "дрова", "ушатанная", "убитая", "гнилая",
    "помойка", "труп", "раздолбанная",
  ];
  for (const input of poorCases) {
    const update = extractStateUpdate(input, { ...DEFAULT_CONVERSATION_STATE });
    assertEqual(update.set.condition, "poor", `Condition poor: '${input}' → poor`);
  }

  const decentCases = [
    "живая", "живой вариант", "конфетка", "свежая",
    "в идеале", "на ходу", "ухоженная",
  ];
  for (const input of decentCases) {
    const update = extractStateUpdate(input, { ...DEFAULT_CONVERSATION_STATE });
    assertEqual(update.set.condition, "decent", `Condition decent: '${input}' → decent`);
  }
}

// ─── Seller claims: expanded ───
console.log("\n═══ Expanded Slang: Seller Claims ═══");
{
  // Claims that always trigger (no seller context needed)
  const alwaysClaims: Array<[string, string]> = [
    ["кузов в родне", "seller_claims_original_paint"],
    ["родная краска", "seller_claims_original_paint"],
    ["масло не жрёт", "seller_claims_no_oil_consumption"],
    ["масло не ест", "seller_claims_no_oil_consumption"],
    ["коробка не пинается", "seller_claims_transmission_ok"],
    ["коробка без нареканий", "seller_claims_transmission_ok"],
    ["работает как часы", "seller_claims_perfect_condition"],
    ["как часики", "seller_claims_perfect_condition"],
    ["не скручен", "seller_claims_original_mileage"],
    ["пробег родной", "seller_claims_original_mileage"],
    ["без подкрас", "seller_claims_no_repaint"],
    ["не битая", "seller_claims_no_accident"],
    ["без дтп", "seller_claims_no_accident"],
    ["гаражное хранение", "seller_claims_garage_kept"],
  ];
  for (const [input, expectedMeaning] of alwaysClaims) {
    const update = extractStateUpdate(`продавец говорит: ${input}`, { ...DEFAULT_CONVERSATION_STATE });
    const found = (update.set.sellerClaims ?? []).some((c: SellerClaim) => c.meaning === expectedMeaning);
    assert(found, `Seller claim: '${input}' → ${expectedMeaning}`);
    // All must be soft_claim
    for (const c of (update.set.sellerClaims ?? []) as SellerClaim[]) {
      if (c.meaning === expectedMeaning) {
        assertEqual(c.trust, "soft_claim", `Seller claim '${input}' trust = soft_claim`);
      }
    }
  }
}

// ─── Reseller/market language ───
console.log("\n═══ Expanded Slang: Reseller/Market Language ═══");
{
  const phrases = [
    "перекуп",
    "перепуки",
    "покупан",
    "торг у капота",
    "торг при осмотре",
    "барыга",
  ];
  for (const phrase of phrases) {
    const signals = extractSlangSignals(phrase);
    assertEqual(signals.resellerContext, true, `Reseller: '${phrase}' → resellerContext = true`);
  }
}

// ─── Ownership: expanded ───
console.log("\n═══ Expanded Slang: Ownership ═══");
{
  const personalCases = ["для себя", "себе ищу", "сам буду ездить"];
  for (const input of personalCases) {
    const update = extractStateUpdate(input, { ...DEFAULT_CONVERSATION_STATE });
    assertEqual(update.set.isForResale, false, `Ownership personal: '${input}' → isForResale = false`);
    assertEqual(update.set.isLegalEntity, false, `Ownership personal: '${input}' → isLegalEntity = false`);
  }

  const resaleCases = ["под перепродажу", "на перепродажу", "для перекупа"];
  for (const input of resaleCases) {
    const update = extractStateUpdate(input, { ...DEFAULT_CONVERSATION_STATE });
    assertEqual(update.set.isForResale, true, `Ownership resale: '${input}' → isForResale = true`);
  }

  const legalCases = ["на фирму", "на юрлицо", "на ооо", "на ип", "для юрлица"];
  for (const input of legalCases) {
    const update = extractStateUpdate(input, { ...DEFAULT_CONVERSATION_STATE });
    assertEqual(update.set.isLegalEntity, true, `Ownership legal: '${input}' → isLegalEntity = true`);
  }
}

// ─── Budget intent: expanded ───
console.log("\n═══ Expanded Slang: Budget Intent ═══");
{
  const phrases = [
    "дай вилку",
    "засвети бюджет",
    "цены в иенах не знаю",
    "сколько стоит",
    "сколько будет стоить",
    "что по ценам",
    "во что обойдётся",
    "назови цену",
    "прикинь бюджет",
    "почём нынче",
    "бюджет не знаю",
    "не знаю бюджет",
  ];
  for (const phrase of phrases) {
    const update = extractStateUpdate(phrase, { ...DEFAULT_CONVERSATION_STATE });
    assertEqual(update.set.budgetText, "approximate_guidance", `Budget: '${phrase}' → approximate_guidance`);
  }
}

// ─── Negative flags: expanded ───
console.log("\n═══ Expanded Slang: Negative Flags ═══");
{
  // Positive detection (car HAS these problems)
  const flagCases: Array<[string, string]> = [
    ["топляк", "flood_damage"],
    ["утопленник", "flood_damage"],
    ["перевертыш", "rollover_history"],
    ["жучки", "rust_spots"],
    ["цветёт", "rust_spots"],
    ["масложор", "oil_leak"],
    ["скрученный пробег", "odometer_tampered"],
    ["двойник", "cloned_vin"],
    ["в залоге", "lien_or_loan"],
    ["в аресте", "seized"],
    ["запрет рег", "registration_ban"],
  ];
  for (const [input, expected] of flagCases) {
    const signals = extractSlangSignals(input);
    assert(
      (signals.negativeFlags ?? []).includes(expected),
      `NegFlag: '${input}' → ${expected}`,
    );
  }

  // Exclusion detection (user does NOT want these)
  const excludeCases: Array<[string, string]> = [
    ["не топляк", "flood_damage"],
    ["не утопленник", "flood_damage"],
    ["не перевертыш", "rollover_history"],
    ["не распил", "cut_import"],
    ["не конструктор", "constructor_import"],
    ["не ведро", "poor_condition"],
    ["не убитую", "poor_condition"],
    ["не битая", "not_crashed"],
    ["не кредитную", "lien_or_loan"],
    ["без ограничений", "registration_clean"],
    ["не скрученный", "odometer_not_tampered"],
  ];
  for (const [input, expected] of excludeCases) {
    const update = extractStateUpdate(input, { ...DEFAULT_CONVERSATION_STATE });
    assert(
      (update.set.excludedNegativeFlags ?? []).includes(expected),
      `ExclFlag: '${input}' → excluded ${expected}`,
    );
  }
}

// ─── Steering: expanded ───
console.log("\n═══ Expanded Slang: Steering ═══");
{
  const testCases: Array<[string, string]> = [
    ["праворукая", "rhd"],
    ["правильная", "rhd"],
    ["праворульная", "rhd"],
    ["европеец", "lhd"],
    ["леворульная", "lhd"],
    ["европейка", "lhd"],
  ];
  for (const [input, expected] of testCases) {
    const update = extractStateUpdate(input, { ...DEFAULT_CONVERSATION_STATE });
    assertEqual(update.set.steering, expected, `Steering: '${input}' → ${expected}`);
  }
}

// ─── Color: expanded ───
console.log("\n═══ Expanded Slang: Color ═══");
{
  const colorCases: Array<[string, string]> = [
    ["снежка", "серебристый"],
    ["серебрянка", "серебристый"],
    ["бутылка", "тёмно-зелёный"],
    ["мокрый асфальт", "тёмно-серый"],
    ["баклажан", "тёмно-фиолетовый"],
    ["вишня", "тёмно-красный"],
    ["шампань", "бежевый"],
  ];
  for (const [input, expected] of colorCases) {
    const update = extractStateUpdate(input, { ...DEFAULT_CONVERSATION_STATE });
    assertEqual(update.set.color, expected, `Color: '${input}' → ${expected}`);
  }
}

// ─── Fuel: expanded ───
console.log("\n═══ Expanded Slang: Fuel Type ═══");
{
  const testCases: Array<[string, string]> = [
    ["саляра", "diesel"],
    ["солярка", "diesel"],
    ["дизелёк", "diesel"],
    ["зажигалка", "gasoline"],
    ["бензинка", "gasoline"],
    ["гибра", "hybrid"],
    ["гибридная", "hybrid"],
    ["электричка", "ev"],
    ["электромобиль", "ev"],
  ];
  for (const [input, expected] of testCases) {
    const update = extractStateUpdate(input, { ...DEFAULT_CONVERSATION_STATE });
    assertEqual(update.set.fuelType, expected, `Fuel: '${input}' → ${expected}`);
  }
}

// ─── Priority: expanded ───
console.log("\n═══ Expanded Slang: Priority ═══");
{
  const cheapCases = ["подешевле", "дешман", "по низу рынка", "бюджетную", "самую дешёвую", "за копейки"];
  for (const input of cheapCases) {
    const update = extractStateUpdate(input, { ...DEFAULT_CONVERSATION_STATE });
    assertEqual(update.set.priority, "cheapest", `Priority cheap: '${input}' → cheapest`);
  }

  const condCases = ["не ведро", "не убитую", "получше состояние", "в хорошем состоянии"];
  for (const input of condCases) {
    const update = extractStateUpdate(input, { ...DEFAULT_CONVERSATION_STATE });
    assertEqual(update.set.priority, "best_condition", `Priority condition: '${input}' → best_condition`);
  }
}

// ─── No-Russia mileage: expanded ───
console.log("\n═══ Expanded Slang: No-Russia Mileage ═══");
{
  const cases = ["беспробежная", "беспробежку", "б/п", "свежепригнанная", "без пробега по рф"];
  for (const input of cases) {
    const update = extractStateUpdate(input, { ...DEFAULT_CONVERSATION_STATE });
    assertEqual(update.set.noRussiaMileage, true, `Mileage: '${input}' → noRussiaMileage = true`);
  }
}

// ─── Turbo: expanded ───
console.log("\n═══ Expanded Slang: Turbo ═══");
{
  const cases = ["турбовая", "турбо", "с наддувом", "турбированная"];
  for (const input of cases) {
    const update = extractStateUpdate(input, { ...DEFAULT_CONVERSATION_STATE });
    assertEqual(update.set.turbo, true, `Turbo: '${input}' → turbo = true`);
  }
}

// ─── normalizeAutoSlang output ───
console.log("\n═══ Expanded Slang: normalizeAutoSlang text replacement ═══");
{
  const testCases: Array<[string, RegExp]> = [
    ["передок", /передний привод/i],
    ["задок", /задний привод/i],
    ["вэдовая", /полный привод/i],
    ["4вд", /полный привод/i],
    ["4х4", /полный привод/i],
    ["палка", /механика/i],
    ["дёргалка", /механика/i],
    ["тяпка", /автомат/i],
    ["варик", /вариатор/i],
    ["перепуки", /перекуп/i],
    ["покупан", /покупатель/i],
    ["барыга", /перекуп/i],
    ["солярка", /дизель/i],
    ["сарай", /универсал/i],
    ["паркетник", /кроссовер/i],
    ["козёл", /внедорожник/i],
    ["купарь", /купе/i],
    ["каблук", /фургон/i],
    ["микрик", /минивэн/i],
    ["литрушка", /1\.0 л/i],
    ["трёшка", /3\.0 л/i],
    ["четвёрка", /4\.0 л/i],
    ["праворульная", /правый руль/i],
    ["европейка", /левый руль/i],
  ];
  for (const [input, expected] of testCases) {
    const result = normalizeAutoSlang(input);
    assert(expected.test(result), `normalizeAutoSlang('${input}') → matches ${expected} (got: '${result}')`);
  }
}

// ─── Complex real-world phrases ───
console.log("\n═══ Expanded Slang: Complex Real-World Phrases ═══");
{
  // "ищу паркетник, двушку, на автомате, полноприводную, фарш, для себя, засвети бюджет"
  const msg1 = "ищу паркетник, двушку, на автомате, полноприводную, фарш, для себя, засвети бюджет";
  const update1 = extractStateUpdate(msg1, { ...DEFAULT_CONVERSATION_STATE });
  const state1 = applyStateUpdate({ ...DEFAULT_CONVERSATION_STATE }, update1, "regex");
  assertEqual(state1.body, "crossover", "Real1: body = crossover");
  assertEqual(state1.volumeCm3, 2000, "Real1: volumeCm3 = 2000");
  assertEqual(state1.transmission, "automatic", "Real1: transmission = automatic");
  assertEqual(state1.drivetrain, "4wd", "Real1: drivetrain = 4wd");
  assertEqual(state1.trimLevel, "top", "Real1: trimLevel = top");
  assertEqual(state1.isForResale, false, "Real1: isForResale = false");
  assertEqual(state1.budgetText, "approximate_guidance", "Real1: budgetText = approximate_guidance");

  // "не ведро, не топляк, не битая, живую, беспробежку, на палке, сарай"
  const msg2 = "не ведро, не топляк, не битая, живую, беспробежку, на палке, сарай";
  const update2 = extractStateUpdate(msg2, { ...DEFAULT_CONVERSATION_STATE });
  const state2 = applyStateUpdate({ ...DEFAULT_CONVERSATION_STATE }, update2, "regex");
  assert(state2.excludedNegativeFlags.includes("poor_condition"), "Real2: excluded poor_condition");
  assert(state2.excludedNegativeFlags.includes("flood_damage"), "Real2: excluded flood_damage");
  assert(state2.excludedNegativeFlags.includes("not_crashed"), "Real2: excluded not_crashed");
  assertEqual(state2.priority, "best_condition", "Real2: priority = best_condition (живую)");
  assertEqual(state2.noRussiaMileage, true, "Real2: noRussiaMileage = true");
  assertEqual(state2.transmission, "manual", "Real2: transmission = manual");
  assertEqual(state2.body, "wagon", "Real2: body = wagon");

  // "хочу недорого, 4вд, полторашку, на вариаторе, для перекупа, рамник"
  const msg3 = "хочу недорого, 4вд, полторашку, на вариаторе, для перекупа, рамник";
  const update3 = extractStateUpdate(msg3, { ...DEFAULT_CONVERSATION_STATE });
  const state3 = applyStateUpdate({ ...DEFAULT_CONVERSATION_STATE }, update3, "regex");
  assertEqual(state3.priority, "cheapest", "Real3: priority = cheapest");
  assertEqual(state3.drivetrain, "4wd", "Real3: drivetrain = 4wd");
  assertEqual(state3.volumeCm3, 1500, "Real3: volumeCm3 = 1500");
  assertEqual(state3.transmission, "cvt", "Real3: transmission = cvt");
  assertEqual(state3.isForResale, true, "Real3: isForResale = true");
  assertEqual(state3.body, "suv", "Real3: body = suv (рамник)");

  // "продавец говорит: не бита не крашена, пробег родной, гаражное хранение"
  const msg4 = "продавец говорит: не бита не крашена, пробег родной, гаражное хранение";
  const update4 = extractStateUpdate(msg4, { ...DEFAULT_CONVERSATION_STATE });
  const claims = (update4.set.sellerClaims ?? []) as SellerClaim[];
  const meanings = claims.map((c: SellerClaim) => c.meaning);
  assert(meanings.includes("seller_claims_no_accident"), "Real4: claim no_accident");
  assert(meanings.includes("seller_claims_original_mileage"), "Real4: claim original_mileage");
  assert(meanings.includes("seller_claims_garage_kept"), "Real4: claim garage_kept");
  for (const c of claims) {
    assertEqual(c.trust, "soft_claim", `Real4: claim '${c.meaning}' trust = soft_claim`);
  }
}

// ═══════════════════════════════════════════════════════════
// SELLER ↔ BOT SIMULATION TESTS
// ═══════════════════════════════════════════════════════════
// Two entities: "Seller" (customer asking about a car) and "Bot" (Alexey responding).
// The seller sends messages; the bot processes state + builds deterministic replies.
// We verify: no re-asking, correct state tracking, proper stage transitions.

console.log("\n\n═══════════════════════════════════════════════");
console.log("  SELLER ↔ BOT FULL CONVERSATION SIMULATIONS");
console.log("═══════════════════════════════════════════════\n");

/**
 * Run a full conversation simulation and validate each turn.
 * Returns the final state after all turns.
 */
async function simulateConversation(
  name: string,
  turns: Array<{
    seller: string;
    checks: (state: ConversationState, reply: string, turnNum: number) => void;
  }>,
): Promise<ConversationState> {
  console.log(`\n──── Simulation: ${name} ────`);
  let state: ConversationState = {
    ...DEFAULT_CONVERSATION_STATE,
    auctionGradesAllowed: [],
    needsClarification: [],
    slotMeta: {},
    sellerClaims: [],
    excludedNegativeFlags: [],
  };

  for (let i = 0; i < turns.length; i++) {
    const turn = turns[i];
    const turnNum = i + 1;
    console.log(`  Turn ${turnNum} — Seller: "${turn.seller}"`);

    const update = extractStateUpdate(turn.seller, state);
    state = applyStateUpdate(state, update, "regex");

    const plan = planReply(state, turn.seller);
    const reply = await buildSafeFallbackReply(state, plan);
    console.log(`  Turn ${turnNum} — Bot: "${reply}"`);

    turn.checks(state, reply, turnNum);
  }

  return state;
}

// ─── Simulation 1: Honda Vezel full flow (exact problem from bug report) ───
await simulateConversation("Honda Vezel — problem scenario from bug report", [
  {
    seller: "можешь посчитать везела, не проходного, передний привод, самый простой, оценка R тоже можно",
    checks: (state, reply, t) => {
      assertEqual(state.model, "Vezel", `Sim1 T${t}: model = Vezel`);
      assertEqual(state.make, "Honda", `Sim1 T${t}: make = Honda`);
      assertEqual(state.ageWindow, "non_passable", `Sim1 T${t}: ageWindow = non_passable`);
      assertEqual(state.drivetrain, "fwd", `Sim1 T${t}: drivetrain = fwd`);
      assertEqual(state.trimLevel, "base", `Sim1 T${t}: trimLevel = base`);
      assertEqual(state.nonPassableType, null, `Sim1 T${t}: nonPassableType = null`);
      assertEqual(state.activeIntent, "price_calc", `Sim1 T${t}: intent = price_calc`);
      // Must ask ONLY ONE question
      const questionCount = (reply.match(/Уточни/g) || []).length;
      assert(questionCount <= 1, `Sim1 T${t}: at most 1 clarification block`);
      assert(reply.includes("до 3 лет") || reply.includes("старше 5 лет"), `Sim1 T${t}: asks about nonPassableType`);
      // Must NOT re-ask about drivetrain, trimLevel, etc.
      assert(!reply.includes("какой привод"), `Sim1 T${t}: does NOT re-ask drivetrain`);
      assert(!reply.includes("какая комплектация"), `Sim1 T${t}: does NOT re-ask trimLevel`);
    },
  },
  {
    seller: "до трех лет. Бюджета не знаю, предлагай. машина для себя",
    checks: (state, reply, t) => {
      assertEqual(state.nonPassableType, "under_3_years", `Sim1 T${t}: nonPassableType = under_3_years`);
      assertEqual(state.budgetDeclined, true, `Sim1 T${t}: budgetDeclined = true`);
      assertEqual(state.budgetText, "approximate_guidance", `Sim1 T${t}: budgetText = approximate_guidance`);
      assertEqual(state.isForResale, false, `Sim1 T${t}: isForResale = false`);
      assertEqual(state.isLegalEntity, false, `Sim1 T${t}: isLegalEntity = false`);
      // Must NOT re-ask about age, budget, or ownership
      assert(!reply.includes("до 3 лет или старше"), `Sim1 T${t}: does NOT re-ask nonPassableType`);
      assert(!reply.includes("какой бюджет"), `Sim1 T${t}: does NOT re-ask budget`);
      assert(!reply.includes("физлицо, юрлицо"), `Sim1 T${t}: does NOT re-ask ownership`);
      // Should ask about volume (the only missing calc field)
      assert(reply.includes("объём") || reply.includes("объем"), `Sim1 T${t}: asks about engine volume`);
    },
  },
  {
    seller: "полторашка",
    checks: (state, reply, t) => {
      assertEqual(state.volumeCm3, 1500, `Sim1 T${t}: volumeCm3 = 1500`);
      // All calc params should now be filled
      assertEqual(state.stage, "ready_to_calculate", `Sim1 T${t}: stage = ready_to_calculate`);
      // Should indicate calculation, not ask more questions
      assert(!reply.includes("Уточни"), `Sim1 T${t}: no more clarification needed`);
    },
  },
]);

// ─── Simulation 2: Bare numbers for volume ───
await simulateConversation("Bare number volume parsing", [
  {
    seller: "посчитай приус, проходной, для себя",
    checks: (state, reply, t) => {
      assertEqual(state.model, "Prius", `Sim2 T${t}: model = Prius`);
      assertEqual(state.ageWindow, "passable", `Sim2 T${t}: ageWindow = passable`);
      assertEqual(state.isForResale, false, `Sim2 T${t}: isForResale = false`);
      assertEqual(state.isLegalEntity, false, `Sim2 T${t}: isLegalEntity = false`);
      // Should ask about volume first (drivetrain, budget, etc. also missing but volume is priority)
      assert(reply.includes("объём") || reply.includes("объем"), `Sim2 T${t}: asks about volume`);
    },
  },
  {
    seller: "1.5",
    checks: (state, reply, t) => {
      assertEqual(state.volumeCm3, 1500, `Sim2 T${t}: volumeCm3 = 1500 from bare "1.5"`);
      // Model preserved
      assertEqual(state.model, "Prius", `Sim2 T${t}: model still Prius`);
    },
  },
]);

// ─── Simulation 3: Bare number volume as "1500" ───
await simulateConversation("Bare number volume 1500", [
  {
    seller: "посчитай фит, непроходной, до 3 лет, для себя",
    checks: (state, reply, t) => {
      assertEqual(state.model, "Fit", `Sim3 T${t}: model = Fit`);
      assertEqual(state.nonPassableType, "under_3_years", `Sim3 T${t}: nonPassableType = under_3_years`);
      assert(reply.includes("объём") || reply.includes("объем"), `Sim3 T${t}: asks about volume`);
    },
  },
  {
    seller: "1500",
    checks: (state, reply, t) => {
      assertEqual(state.volumeCm3, 1500, `Sim3 T${t}: volumeCm3 = 1500 from bare "1500"`);
    },
  },
]);

// ─── Simulation 4: Volume with units ───
await simulateConversation("Volume with various units", [
  {
    seller: "посчитай харек, непроходной, старше 5 лет, для себя",
    checks: (state, reply, t) => {
      assertEqual(state.model, "Harrier", `Sim4 T${t}: model = Harrier`);
      assertEqual(state.nonPassableType, "over_5_years", `Sim4 T${t}: nonPassableType = over_5_years`);
      assert(reply.includes("объём") || reply.includes("объем"), `Sim4 T${t}: asks about volume`);
    },
  },
  {
    seller: "2.0 литра",
    checks: (state, reply, t) => {
      assertEqual(state.volumeCm3, 2000, `Sim4 T${t}: volumeCm3 = 2000 from "2.0 литра"`);
    },
  },
]);

// ─── Simulation 5: Negation handling ───
console.log("\n═══ Negation Guard Tests ═══");
{
  const prevState: ConversationState = {
    ...DEFAULT_CONVERSATION_STATE,
    ageWindow: "non_passable",
    model: "Vezel",
    make: "Honda",
    activeIntent: "price_calc",
    auctionGradesAllowed: [],
    needsClarification: [],
    slotMeta: {},
    sellerClaims: [],
    excludedNegativeFlags: [],
  };

  // "не старый" should NOT set over_5_years
  const update1 = extractStateUpdate("не старый", prevState);
  assertEqual(update1.set.nonPassableType ?? null, null, "Negation: 'не старый' does NOT set over_5_years");

  // "не свежий" should NOT set under_3_years
  const update2 = extractStateUpdate("не свежий", prevState);
  assertEqual(update2.set.nonPassableType ?? null, null, "Negation: 'не свежий' does NOT set under_3_years");

  // "помоложе" should set under_3_years
  const update3 = extractStateUpdate("помоложе", prevState);
  assertEqual(update3.set.nonPassableType, "under_3_years", "Synonym: 'помоложе' → under_3_years");

  // "старый фонд" should still set over_5_years
  const update4 = extractStateUpdate("старый фонд", prevState);
  assertEqual(update4.set.nonPassableType, "over_5_years", "Positive: 'старый фонд' → over_5_years");

  // "старше 5 лет" should still work
  const update5 = extractStateUpdate("старше 5 лет", prevState);
  assertEqual(update5.set.nonPassableType, "over_5_years", "Positive: 'старше 5 лет' → over_5_years");

  // "свежий" should still set under_3_years
  const update6 = extractStateUpdate("свежий", prevState);
  assertEqual(update6.set.nonPassableType, "under_3_years", "Positive: 'свежий' → under_3_years");
}

// ─── Simulation 6: Standalone negation (no prior ageWindow) ───
console.log("\n═══ Standalone Negation Guard Tests ═══");
{
  const freshState: ConversationState = {
    ...DEFAULT_CONVERSATION_STATE,
    auctionGradesAllowed: [],
    needsClarification: [],
    slotMeta: {},
    sellerClaims: [],
    excludedNegativeFlags: [],
  };

  // "не старый" without prior ageWindow should NOT set non_passable
  const u1 = extractStateUpdate("не старый", freshState);
  assertEqual(u1.set.ageWindow ?? null, null, "Standalone negation: 'не старый' does NOT set ageWindow");
  assertEqual(u1.set.nonPassableType ?? null, null, "Standalone negation: 'не старый' does NOT set nonPassableType");

  // "не свежий" without prior ageWindow should NOT set non_passable
  const u2 = extractStateUpdate("не свежий", freshState);
  assertEqual(u2.set.ageWindow ?? null, null, "Standalone negation: 'не свежий' does NOT set ageWindow");

  // "помоложе" without prior ageWindow should set under_3_years
  const u3 = extractStateUpdate("помоложе", freshState);
  assertEqual(u3.set.ageWindow, "non_passable", "Standalone: 'помоложе' → ageWindow = non_passable");
  assertEqual(u3.set.nonPassableType, "under_3_years", "Standalone: 'помоложе' → nonPassableType = under_3_years");
}

// ─── Simulation 7: Volume with "кубов"/"кубиков" ───
console.log("\n═══ Volume Unit Variants ═══");
{
  const freshState: ConversationState = {
    ...DEFAULT_CONVERSATION_STATE,
    auctionGradesAllowed: [],
    needsClarification: [],
    slotMeta: {},
    sellerClaims: [],
    excludedNegativeFlags: [],
  };

  const u1 = extractStateUpdate("1500 кубов", freshState);
  assertEqual(u1.set.volumeCm3, 1500, "Volume: '1500 кубов' → 1500");

  const u2 = extractStateUpdate("1500 кубиков", freshState);
  assertEqual(u2.set.volumeCm3, 1500, "Volume: '1500 кубиков' → 1500");

  const u3 = extractStateUpdate("объемом 1.5", freshState);
  assertEqual(u3.set.volumeCm3, 1500, "Volume: 'объемом 1.5' → 1500");

  const u4 = extractStateUpdate("объем 2.0 литра", freshState);
  assertEqual(u4.set.volumeCm3, 2000, "Volume: 'объем 2.0 литра' → 2000");

  const u5 = extractStateUpdate("двигатель 1.8", freshState);
  assertEqual(u5.set.volumeCm3, 1800, "Volume: 'двигатель 1.8' → 1800");

  const u6 = extractStateUpdate("движок 2.4", freshState);
  assertEqual(u6.set.volumeCm3, 2400, "Volume: 'движок 2.4' → 2400");
}

// ─── Simulation 8: Full conversation — user changes mind ───
await simulateConversation("User changes age preference mid-conversation", [
  {
    seller: "посчитай везела, непроходного, до 3 лет, передний привод, для себя",
    checks: (state, _reply, t) => {
      assertEqual(state.nonPassableType, "under_3_years", `Sim8 T${t}: nonPassableType = under_3_years`);
      assertEqual(state.ageWindow, "non_passable", `Sim8 T${t}: ageWindow = non_passable`);
    },
  },
  {
    seller: "нет, давай старше пяти лет",
    checks: (state, _reply, t) => {
      assertEqual(state.nonPassableType, "over_5_years", `Sim8 T${t}: nonPassableType changed to over_5_years`);
      assertEqual(state.ageWindow, "non_passable", `Sim8 T${t}: ageWindow still non_passable`);
    },
  },
]);

// ─── Simulation 9: Budget variations ───
console.log("\n═══ Budget Variation Tests ═══");
{
  const budgetPhrases = [
    "бюджет не знаю",
    "не знаю бюджет",
    "засвети стоимости",
    "дай примерный бюджет",
    "сколько стоит",
    "предлагай",
    "сориентируй",
    "дай вилку",
    "не знаю цену",
    "дай стоимость",
    "покажи цены",
  ];
  for (const phrase of budgetPhrases) {
    const update = extractStateUpdate(phrase, { ...DEFAULT_CONVERSATION_STATE, auctionGradesAllowed: [], needsClarification: [], slotMeta: {}, sellerClaims: [], excludedNegativeFlags: [] });
    assert(
      update.set.budgetDeclined === true || update.set.budgetText === "approximate_guidance",
      `Budget: '${phrase}' → budgetDeclined/approximate_guidance`,
    );
  }
}

// ─── Simulation 10: Intent stickiness ───
await simulateConversation("Intent stays price_calc after adding filters", [
  {
    seller: "посчитай везела",
    checks: (state, _reply, t) => {
      assertEqual(state.activeIntent, "price_calc", `Sim10 T${t}: intent = price_calc`);
    },
  },
  {
    seller: "непроходной, передний привод, самый простой",
    checks: (state, _reply, t) => {
      assertEqual(state.activeIntent, "price_calc", `Sim10 T${t}: intent stays price_calc (sticky)`);
      assertEqual(state.drivetrain, "fwd", `Sim10 T${t}: drivetrain = fwd`);
      assertEqual(state.trimLevel, "base", `Sim10 T${t}: trimLevel = base`);
    },
  },
  {
    seller: "оценка R тоже можно",
    checks: (state, _reply, t) => {
      assertEqual(state.activeIntent, "price_calc", `Sim10 T${t}: intent still price_calc`);
      assert(state.auctionGradesAllowed.includes("R"), `Sim10 T${t}: R grade allowed`);
    },
  },
]);

// ─── Simulation 11: Complete flow to ready_to_calculate ───
await simulateConversation("Complete flow reaches ready_to_calculate", [
  {
    seller: "посчитай филдера, проходной, полторашка, для себя, бюджет 500 тысяч йен",
    checks: (state, reply, t) => {
      assertEqual(state.model, "Corolla Fielder", `Sim11 T${t}: model = Corolla Fielder`);
      assertEqual(state.ageWindow, "passable", `Sim11 T${t}: ageWindow = passable`);
      assertEqual(state.volumeCm3, 1500, `Sim11 T${t}: volumeCm3 = 1500`);
      assertEqual(state.isForResale, false, `Sim11 T${t}: isForResale = false`);
      assertEqual(state.isLegalEntity, false, `Sim11 T${t}: isLegalEntity = false`);
      assertEqual(state.auctionPriceJPY, 500000, `Sim11 T${t}: auctionPriceJPY = 500000`);
      assertEqual(state.stage, "ready_to_calculate", `Sim11 T${t}: stage = ready_to_calculate`);
      assert(!reply.includes("Уточни"), `Sim11 T${t}: no clarification needed`);
    },
  },
]);

// ─── Simulation 12: Bot confirms known slots progressively ───
await simulateConversation("Progressive slot filling — each turn adds info", [
  {
    seller: "посчитай приус",
    checks: (state, reply, t) => {
      assertEqual(state.model, "Prius", `Sim12 T${t}: model = Prius`);
      // Should ask something
      assert(reply.includes("Уточни") || reply.includes("понял"), `Sim12 T${t}: reply has content`);
    },
  },
  {
    seller: "проходной",
    checks: (state, reply, t) => {
      assertEqual(state.ageWindow, "passable", `Sim12 T${t}: ageWindow = passable`);
      // Should not re-ask about age
      assert(!reply.includes("проходной или непроходной"), `Sim12 T${t}: does NOT re-ask age`);
    },
  },
  {
    seller: "1.5 литра",
    checks: (state, reply, t) => {
      assertEqual(state.volumeCm3, 1500, `Sim12 T${t}: volumeCm3 = 1500`);
      // Reply should confirm volume in known parts but not ASK about it again
      assert(!reply.includes("какой объём"), `Sim12 T${t}: does NOT re-ask volume`);
    },
  },
  {
    seller: "для себя",
    checks: (state, reply, t) => {
      assertEqual(state.isForResale, false, `Sim12 T${t}: isForResale = false`);
      assertEqual(state.isLegalEntity, false, `Sim12 T${t}: isLegalEntity = false`);
      assert(!reply.includes("физлицо или юрлицо"), `Sim12 T${t}: does NOT re-ask ownership`);
      // All calc-critical fields are now present — should auto-calculate (range mode)
      assertEqual(state.stage, "ready_to_calculate", `Sim12 T${t}: stage = ready_to_calculate`);
      assert(!reply.includes("какой бюджет"), `Sim12 T${t}: does NOT ask budget`);
      assert(
        reply.includes("рассчитаю") || reply.includes("Расчёт") || reply.includes("стоимост") || reply.includes("среднерыночн"),
        `Sim12 T${t}: proceeds to calculate`,
      );
    },
  },
]);

// ─── Simulation 13: Model switch resets dependent slots ───
await simulateConversation("Model switch resets dependent slots", [
  {
    seller: "посчитай приус, проходной, 1.5 литра, для себя",
    checks: (state, _reply, t) => {
      assertEqual(state.model, "Prius", `Sim13 T${t}: model = Prius`);
      assertEqual(state.volumeCm3, 1500, `Sim13 T${t}: volumeCm3 = 1500`);
      assertEqual(state.ageWindow, "passable", `Sim13 T${t}: ageWindow = passable`);
    },
  },
  {
    seller: "а нет, давай лучше харек",
    checks: (state, _reply, t) => {
      assertEqual(state.model, "Harrier", `Sim13 T${t}: model switched to Harrier`);
      // Dependent slots should be reset
      assertEqual(state.volumeCm3, null, `Sim13 T${t}: volumeCm3 reset`);
      assertEqual(state.ageWindow, null, `Sim13 T${t}: ageWindow reset`);
      // isForResale should be preserved (global)
      assertEqual(state.isForResale, false, `Sim13 T${t}: isForResale preserved`);
    },
  },
]);

// ─── Simulation 14: "дай стоимость" triggers price_calc (bug: bot loop) ───
// Regression test: "дай стоимость Toyota Probox ..." should set activeIntent=price_calc
// and correctly ask for missing calc-critical fields, not loop on "Сейчас рассчитаю..."
await simulateConversation("Budget guidance triggers price_calc intent", [
  {
    seller: "дай стоимость пробокс 2015 полный привод физлицо",
    checks: (state, reply, t) => {
      assertEqual(state.model, "Probox", `Sim14 T${t}: model = Probox`);
      assertEqual(state.make, "Toyota", `Sim14 T${t}: make = Toyota`);
      assertEqual(state.year, 2015, `Sim14 T${t}: year = 2015`);
      assertEqual(state.drivetrain, "4wd", `Sim14 T${t}: drivetrain = 4wd`);
      assertEqual(state.isLegalEntity, false, `Sim14 T${t}: isLegalEntity = false`);
      assertEqual(state.isForResale, false, `Sim14 T${t}: isForResale = false (физлицо implies personal)`);
      assertEqual(state.budgetText, "approximate_guidance", `Sim14 T${t}: budgetText = approximate_guidance`);
      assertEqual(state.activeIntent, "price_calc", `Sim14 T${t}: activeIntent = price_calc (not car_search)`);
      // volumeCm3 is still missing — bot should ask, NOT promise calculation
      assertEqual(state.volumeCm3, null, `Sim14 T${t}: volumeCm3 = null (not provided)`);
      assert(!reply.includes("Сейчас рассчитаю"), `Sim14 T${t}: does NOT promise calculation yet`);
      assert(reply.includes("объём") || reply.includes("объем"), `Sim14 T${t}: asks about engine volume`);
    },
  },
  {
    seller: "1.5 литра",
    checks: (state, reply, t) => {
      assertEqual(state.volumeCm3, 1500, `Sim14 T${t}: volumeCm3 = 1500`);
      assertEqual(state.stage, "ready_to_calculate", `Sim14 T${t}: stage = ready_to_calculate`);
      // Now all fields are filled — bot should calculate or say it will
      assert(
        reply.includes("рассчитаю") || reply.includes("Расчёт") || reply.includes("стоимост"),
        `Sim14 T${t}: proceeds to calculate`,
      );
      // Intent must stay price_calc
      assertEqual(state.activeIntent, "price_calc", `Sim14 T${t}: intent stays price_calc`);
    },
  },
  {
    // After calculation promise, user adds filters — bot should not break
    seller: "пробег до 150 тысяч, с хорошей аукционной оценкой",
    checks: (state, _reply, t) => {
      // Intent must remain price_calc, not downgrade
      assertEqual(state.activeIntent, "price_calc", `Sim14 T${t}: intent stays price_calc after adding filters`);
      // Model must be preserved
      assertEqual(state.model, "Probox", `Sim14 T${t}: model preserved`);
      assertEqual(state.make, "Toyota", `Sim14 T${t}: make preserved`);
      // Mileage should be captured
      assert(state.mileageText != null, `Sim14 T${t}: mileage captured`);
    },
  },
]);

// ─── Simulation 15: Budget guidance with different model (universality check) ───
await simulateConversation("Budget guidance universal — Camry variant", [
  {
    seller: "сколько стоит камри 2020 физлицо",
    checks: (state, reply, t) => {
      assertEqual(state.model, "Camry", `Sim15 T${t}: model = Camry`);
      assertEqual(state.activeIntent, "price_calc", `Sim15 T${t}: intent = price_calc`);
      assertEqual(state.isLegalEntity, false, `Sim15 T${t}: isLegalEntity = false`);
      assertEqual(state.isForResale, false, `Sim15 T${t}: isForResale = false`);
      assertEqual(state.budgetText, "approximate_guidance", `Sim15 T${t}: budgetText = approximate_guidance`);
      // Missing volumeCm3 — should ask
      assert(!reply.includes("Сейчас рассчитаю"), `Sim15 T${t}: does NOT promise calc yet`);
      assert(reply.includes("объём") || reply.includes("объем"), `Sim15 T${t}: asks about volume`);
    },
  },
  {
    seller: "2.5 литра",
    checks: (state, reply, t) => {
      assertEqual(state.volumeCm3, 2500, `Sim15 T${t}: volumeCm3 = 2500`);
      assertEqual(state.stage, "ready_to_calculate", `Sim15 T${t}: stage = ready_to_calculate`);
      assert(
        reply.includes("рассчитаю") || reply.includes("Расчёт") || reply.includes("стоимост"),
        `Sim15 T${t}: proceeds to calculate`,
      );
    },
  },
]);

// ─── Simulation 16: Probox multi-turn bug reproduction ───
// Exact scenario from the bug report: Probox 2015 AWD → "какая средняя стоимость" → "незнаю"
// The bot must NOT promise calculation until all calc-critical fields are filled.
await simulateConversation("Probox multi-turn — средняя стоимость + незнаю (bug reproduction)", [
  {
    seller: "пробокс 2015 полный привод",
    checks: (state, reply, t) => {
      assertEqual(state.model, "Probox", `Sim16 T${t}: model = Probox`);
      assertEqual(state.make, "Toyota", `Sim16 T${t}: make = Toyota`);
      assertEqual(state.year, 2015, `Sim16 T${t}: year = 2015`);
      assertEqual(state.drivetrain, "4wd", `Sim16 T${t}: drivetrain = 4wd`);
      assertEqual(state.ageWindow, "non_passable", `Sim16 T${t}: ageWindow = non_passable`);
      assertEqual(state.nonPassableType, "over_5_years", `Sim16 T${t}: nonPassableType = over_5_years`);
      // Should NOT yet be in budget guidance mode
      assertEqual(state.budgetDeclined, false, `Sim16 T${t}: budgetDeclined = false`);
    },
  },
  {
    // "какая средняя стоимость" should trigger budget guidance, NOT trimLevel=mid
    seller: "какая средняя стоимость",
    checks: (state, reply, t) => {
      assertEqual(state.budgetDeclined, true, `Sim16 T${t}: budgetDeclined = true (средняя стоимость = price inquiry)`);
      assertEqual(state.budgetText, "approximate_guidance", `Sim16 T${t}: budgetText = approximate_guidance`);
      assertEqual(state.activeIntent, "price_calc", `Sim16 T${t}: activeIntent = price_calc`);
      // "средняя стоимость" should NOT set trimLevel
      assertEqual(state.trimLevel, null, `Sim16 T${t}: trimLevel = null (not средняя комплектация)`);
      // Must NOT promise calculation — volumeCm3 and ownership are still missing
      assert(!reply.includes("Сейчас рассчитаю"), `Sim16 T${t}: does NOT promise calculation`);
      // Must ask for the next missing field
      assert(
        reply.includes("объём") || reply.includes("объем") ||
        reply.includes("физлицо") || reply.includes("оформлени"),
        `Sim16 T${t}: asks about missing calc-critical field`,
      );
    },
  },
  {
    seller: "объём 1.5 для себя",
    checks: (state, reply, t) => {
      assertEqual(state.volumeCm3, 1500, `Sim16 T${t}: volumeCm3 = 1500`);
      assertEqual(state.isForResale, false, `Sim16 T${t}: isForResale = false`);
      assertEqual(state.isLegalEntity, false, `Sim16 T${t}: isLegalEntity = false`);
      assertEqual(state.stage, "ready_to_calculate", `Sim16 T${t}: stage = ready_to_calculate`);
      // NOW all fields are filled — bot should calculate
      assert(
        reply.includes("рассчитаю") || reply.includes("Расчёт") || reply.includes("стоимост"),
        `Sim16 T${t}: proceeds to calculate`,
      );
    },
  },
]);

// ─── Simulation 17: All calc-critical fields present → auto-calculates in range mode ───
await simulateConversation("All calc fields present → auto-calculates range (no budget question)", [
  {
    seller: "посчитай камри 2021 для себя",
    checks: (state, reply, t) => {
      assertEqual(state.model, "Camry", `Sim17 T${t}: model = Camry`);
      assertEqual(state.isForResale, false, `Sim17 T${t}: isForResale = false`);
      assertEqual(state.isLegalEntity, false, `Sim17 T${t}: isLegalEntity = false`);
      assertEqual(state.activeIntent, "price_calc", `Sim17 T${t}: activeIntent = price_calc`);
    },
  },
  {
    seller: "2.5 литра",
    checks: (state, reply, t) => {
      assertEqual(state.volumeCm3, 2500, `Sim17 T${t}: volumeCm3 = 2500`);
      // All calc-critical fields are now present — should auto-calculate (range mode)
      assertEqual(state.stage, "ready_to_calculate", `Sim17 T${t}: stage = ready_to_calculate`);
      assert(
        reply.includes("рассчитаю") || reply.includes("Расчёт") || reply.includes("стоимост") || reply.includes("среднерыночн"),
        `Sim17 T${t}: proceeds to calculate`,
      );
      // Must NOT ask about budget
      assert(!reply.includes("какой бюджет"), `Sim17 T${t}: does NOT ask budget`);
    },
  },
]);

// ─── Simulation 18: "средняя комплектация" must still set trimLevel ───
await simulateConversation("средняя комплектация sets trimLevel (not budget guidance)", [
  {
    seller: "пробокс 2015 средняя комплектация",
    checks: (state, _reply, t) => {
      assertEqual(state.model, "Probox", `Sim18 T${t}: model = Probox`);
      assertEqual(state.trimLevel, "mid", `Sim18 T${t}: trimLevel = mid`);
      // "средняя комплектация" is NOT a price inquiry
      assertEqual(state.budgetDeclined, false, `Sim18 T${t}: budgetDeclined = false`);
    },
  },
]);

// ══════════════════════════════════════════════════════════
// NEW PATTERN-BASED SMOKE TESTS (Sim19+)
// These test BEHAVIOR PATTERNS, not specific car models.
// ══════════════════════════════════════════════════════════

// ─── Sim19: "Собрал всё → посчитал" (any model — RAV4 via slang) ───
// User gives all required params in a few turns using slang.
// Bot must reach ready_to_calculate without extra questions.
await simulateConversation("Pattern A: All params → ready_to_calculate (RAV4)", [
  {
    seller: "посчитай рав4 2018 2.0 литра, непроходной, для себя, бюджет не знаю",
    checks: (state, reply, t) => {
      assertEqual(state.make, "Toyota", `Sim19 T${t}: make = Toyota`);
      assertEqual(state.model, "RAV4", `Sim19 T${t}: model = RAV4`);
      assertEqual(state.year, 2018, `Sim19 T${t}: year = 2018`);
      assertEqual(state.volumeCm3, 2000, `Sim19 T${t}: volumeCm3 = 2000`);
      assertEqual(state.ageWindow, "non_passable", `Sim19 T${t}: ageWindow = non_passable`);
      assertEqual(state.nonPassableType, "over_5_years", `Sim19 T${t}: nonPassableType = over_5_years`);
      assertEqual(state.isForResale, false, `Sim19 T${t}: isForResale = false`);
      assertEqual(state.isLegalEntity, false, `Sim19 T${t}: isLegalEntity = false`);
      assertEqual(state.budgetDeclined, true, `Sim19 T${t}: budgetDeclined = true`);
      assertEqual(state.activeIntent, "price_calc", `Sim19 T${t}: intent = price_calc`);
      // All fields present → stage = ready_to_calculate
      assertEqual(state.stage, "ready_to_calculate", `Sim19 T${t}: stage = ready_to_calculate`);
      // hasAllCalcCriticalFields should be true
      assert(hasAllCalcCriticalFields(state), `Sim19 T${t}: hasAllCalcCriticalFields = true`);
      // No clarification questions — ready to calculate
      assert(!reply.includes("Уточни"), `Sim19 T${t}: no clarification needed`);
    },
  },
]);

// ─── Sim20: "Не хватает объёма" — missing volumeCm3 ───
// Bot must NOT promise calculation, must ask about volume.
await simulateConversation("Pattern B: Missing volume → asks, not promises (Forester)", [
  {
    seller: "считай форик 2022 для себя, бюджет не знаю",
    checks: (state, reply, t) => {
      assertEqual(state.make, "Subaru", `Sim20 T${t}: make = Subaru`);
      assertEqual(state.model, "Forester", `Sim20 T${t}: model = Forester`);
      assertEqual(state.year, 2022, `Sim20 T${t}: year = 2022`);
      assertEqual(state.isForResale, false, `Sim20 T${t}: isForResale = false`);
      assertEqual(state.isLegalEntity, false, `Sim20 T${t}: isLegalEntity = false`);
      assertEqual(state.budgetDeclined, true, `Sim20 T${t}: budgetDeclined = true`);
      // volumeCm3 is missing
      assertEqual(state.volumeCm3, null, `Sim20 T${t}: volumeCm3 = null`);
      // Stage must NOT be ready_to_calculate
      assert(state.stage !== "ready_to_calculate", `Sim20 T${t}: stage != ready_to_calculate`);
      assert(!hasAllCalcCriticalFields(state), `Sim20 T${t}: hasAllCalcCriticalFields = false`);
      // Must NOT promise calculation
      assert(!reply.includes("Сейчас рассчитаю"), `Sim20 T${t}: does NOT promise calculation`);
      assert(!reply.includes("Все данные есть"), `Sim20 T${t}: does NOT say all data is ready`);
      // Must ask about volume
      assert(reply.includes("объём") || reply.includes("объем"), `Sim20 T${t}: asks about volume`);
    },
  },
  {
    seller: "2.5 литра",
    checks: (state, reply, t) => {
      assertEqual(state.volumeCm3, 2500, `Sim20 T${t}: volumeCm3 = 2500`);
      assertEqual(state.stage, "ready_to_calculate", `Sim20 T${t}: stage = ready_to_calculate`);
      assert(hasAllCalcCriticalFields(state), `Sim20 T${t}: hasAllCalcCriticalFields = true`);
      // Now should calculate
      assert(
        reply.includes("рассчитаю") || reply.includes("Расчёт") || reply.includes("посчитаю") || reply.includes("стоимост"),
        `Sim20 T${t}: proceeds to calculate`,
      );
    },
  },
]);

// ─── Sim21: All non-budget fields present → auto-calculates range ───
// Tests that after providing ownership, bot auto-calculates instead of asking for budget.
await simulateConversation("Pattern C: ownership completes calc fields → auto-range calc", [
  {
    seller: "посчитай Toyota Crown 2019 3.5 литра юрлицо",
    checks: (state, reply, t) => {
      assertEqual(state.model, "Crown", `Sim21 T${t}: model = Crown`);
      assertEqual(state.year, 2019, `Sim21 T${t}: year = 2019`);
      assertEqual(state.volumeCm3, 3500, `Sim21 T${t}: volumeCm3 = 3500`);
      assertEqual(state.isLegalEntity, true, `Sim21 T${t}: isLegalEntity = true`);
      // isForResale is unknown for юрлицо — should ask
      assertEqual(state.stage, "collecting_calc_params", `Sim21 T${t}: stage = collecting_calc_params`);
    },
  },
  {
    // юрлицо doesn't imply "для себя" — bot should have asked, user answers
    seller: "не для перепродажи",
    checks: (state, reply, t) => {
      assertEqual(state.isForResale, false, `Sim21 T${t}: isForResale = false`);
      // All calc-critical fields are now present — should auto-calculate (range mode)
      assertEqual(state.stage, "ready_to_calculate", `Sim21 T${t}: stage = ready_to_calculate`);
      assert(hasAllCalcCriticalFields(state), `Sim21 T${t}: hasAllCalcCriticalFields = true`);
      assert(
        reply.includes("рассчитаю") || reply.includes("Расчёт") || reply.includes("стоимост") || reply.includes("среднерыночн"),
        `Sim21 T${t}: proceeds to calculate`,
      );
      // Must NOT ask about budget
      assert(!reply.includes("какой бюджет"), `Sim21 T${t}: does NOT ask budget`);
    },
  },
]);

// ─── Sim22: Jargon-heavy description (Camry) ───
// "надо камри 2.5, свежая, лет до 5, до сотки пробега, для себя, посчитай по нормальной цене"
await simulateConversation("Pattern D: Jargon-heavy description parsed correctly", [
  {
    seller: "надо камри 2.5, старше 5 лет, до сотки пробега, для себя, посчитай по нормальной цене",
    checks: (state, reply, t) => {
      assertEqual(state.model, "Camry", `Sim22 T${t}: model = Camry`);
      assertEqual(state.make, "Toyota", `Sim22 T${t}: make = Toyota`);
      assertEqual(state.volumeCm3, 2500, `Sim22 T${t}: volumeCm3 = 2500`);
      assertEqual(state.isForResale, false, `Sim22 T${t}: isForResale = false`);
      assertEqual(state.isLegalEntity, false, `Sim22 T${t}: isLegalEntity = false`);
      assertEqual(state.activeIntent, "price_calc", `Sim22 T${t}: activeIntent = price_calc`);
      // "старше 5 лет" → non_passable, over_5_years
      assertEqual(state.ageWindow, "non_passable", `Sim22 T${t}: ageWindow = non_passable`);
      assertEqual(state.nonPassableType, "over_5_years", `Sim22 T${t}: nonPassableType = over_5_years`);
      // "до сотки пробега" → mileage parsed
      assert(state.mileageText != null, `Sim22 T${t}: mileageText captured`);
      // "посчитай по нормальной цене" → budgetGuidance
      assertEqual(state.budgetDeclined, true, `Sim22 T${t}: budgetDeclined = true`);
      assertEqual(state.budgetText, "approximate_guidance", `Sim22 T${t}: budgetText = approximate_guidance`);
      // All fields filled → ready_to_calculate
      assertEqual(state.stage, "ready_to_calculate", `Sim22 T${t}: stage = ready_to_calculate`);
      assert(hasAllCalcCriticalFields(state), `Sim22 T${t}: hasAllCalcCriticalFields = true`);
    },
  },
]);

// ─── Sim23: Missing ownership → bot asks, doesn't promise ───
await simulateConversation("Pattern E: Missing ownership → asks, never promises calc", [
  {
    seller: "сколько стоит Subaru Forester 2020 2.0 литра",
    checks: (state, reply, t) => {
      assertEqual(state.model, "Forester", `Sim23 T${t}: model = Forester`);
      assertEqual(state.make, "Subaru", `Sim23 T${t}: make = Subaru`);
      assertEqual(state.year, 2020, `Sim23 T${t}: year = 2020`);
      assertEqual(state.volumeCm3, 2000, `Sim23 T${t}: volumeCm3 = 2000`);
      assertEqual(state.budgetDeclined, true, `Sim23 T${t}: budgetDeclined = true`);
      // isForResale and isLegalEntity are unknown
      assertEqual(state.isForResale, null, `Sim23 T${t}: isForResale = null`);
      assertEqual(state.isLegalEntity, null, `Sim23 T${t}: isLegalEntity = null`);
      // NOT ready to calculate
      assert(!hasAllCalcCriticalFields(state), `Sim23 T${t}: hasAllCalcCriticalFields = false`);
      assert(state.stage !== "ready_to_calculate", `Sim23 T${t}: stage != ready_to_calculate`);
      // Must NOT promise calculation
      assert(!reply.includes("Сейчас рассчитаю"), `Sim23 T${t}: does NOT promise calculation`);
      // Must ask about ownership
      assert(
        reply.includes("физлицо") || reply.includes("юрлицо") || reply.includes("перепродаж") || reply.includes("оформлени"),
        `Sim23 T${t}: asks about ownership`,
      );
    },
  },
  {
    seller: "для себя",
    checks: (state, reply, t) => {
      assertEqual(state.isForResale, false, `Sim23 T${t}: isForResale = false`);
      assertEqual(state.isLegalEntity, false, `Sim23 T${t}: isLegalEntity = false`);
      assertEqual(state.stage, "ready_to_calculate", `Sim23 T${t}: stage = ready_to_calculate`);
      assert(hasAllCalcCriticalFields(state), `Sim23 T${t}: hasAllCalcCriticalFields = true`);
      // Should calculate now
      assert(
        reply.includes("рассчитаю") || reply.includes("Расчёт") || reply.includes("стоимост") || reply.includes("посчитаю"),
        `Sim23 T${t}: proceeds to calculate`,
      );
    },
  },
]);

// ─── Sim24: "в семью" / "под перепродажу" ownership slang ───
await simulateConversation("Pattern F: Ownership slang — в семью / под перепродажу", [
  {
    seller: "посчитай Nissan Serena 2021 2.0 литра в семью, бюджет не знаю",
    checks: (state, reply, t) => {
      assertEqual(state.model, "Serena", `Sim24 T${t}: model = Serena`);
      assertEqual(state.isForResale, false, `Sim24 T${t}: isForResale = false (в семью = для себя)`);
      assertEqual(state.isLegalEntity, false, `Sim24 T${t}: isLegalEntity = false (в семью = физлицо)`);
      assertEqual(state.stage, "ready_to_calculate", `Sim24 T${t}: stage = ready_to_calculate`);
    },
  },
]);

// ─── Sim25: "считай" (bare verb) triggers price_calc ───
await simulateConversation("Pattern G: считай triggers price_calc intent", [
  {
    seller: "харек 2020 полторашка для себя бюджет не знаю считай",
    checks: (state, reply, t) => {
      assertEqual(state.model, "Harrier", `Sim25 T${t}: model = Harrier`);
      assertEqual(state.activeIntent, "price_calc", `Sim25 T${t}: intent = price_calc`);
      assertEqual(state.volumeCm3, 1500, `Sim25 T${t}: volumeCm3 = 1500`);
      assertEqual(state.stage, "ready_to_calculate", `Sim25 T${t}: stage = ready_to_calculate`);
    },
  },
]);

// ─── Sim26: getMissingCalcCriticalFields unit tests ───
console.log("\n═══ Unit tests: getMissingCalcCriticalFields ═══");
{
  // Empty state: everything is missing
  const emptyState: ConversationState = {
    ...DEFAULT_CONVERSATION_STATE,
    auctionGradesAllowed: [],
    needsClarification: [],
    slotMeta: {},
    sellerClaims: [],
    excludedNegativeFlags: [],
    activeIntent: "price_calc",
  };
  const emptyMissing = getMissingCalcCriticalFields(emptyState);
  assert(emptyMissing.length > 0, "Empty state has missing fields");
  assert(emptyMissing.some(m => m.field === "model"), "Missing: model");
  assert(emptyMissing.some(m => m.field === "yearOrAge"), "Missing: yearOrAge");
  assert(emptyMissing.some(m => m.field === "volumeCm3"), "Missing: volumeCm3");
  assert(emptyMissing.some(m => m.field === "ownership"), "Missing: ownership");
  // priceOrBudget is no longer calc-critical — bot auto-calculates range mode

  // Full state: nothing missing
  const fullState: ConversationState = {
    ...DEFAULT_CONVERSATION_STATE,
    auctionGradesAllowed: [],
    needsClarification: [],
    slotMeta: {},
    sellerClaims: [],
    excludedNegativeFlags: [],
    activeIntent: "price_calc",
    model: "RAV4",
    make: "Toyota",
    year: 2021,
    ageWindow: "passable",
    volumeCm3: 2000,
    isForResale: false,
    isLegalEntity: false,
    budgetDeclined: true,
    budgetText: "approximate_guidance",
  };
  const fullMissing = getMissingCalcCriticalFields(fullState);
  assertEqual(fullMissing.length, 0, "Full state: no missing fields");
  assert(hasAllCalcCriticalFields(fullState), "Full state: hasAllCalcCriticalFields = true");

  // Non-passable without type: requires nonPassableType
  const nonPassableState: ConversationState = {
    ...fullState,
    year: null,
    ageWindow: "non_passable",
    nonPassableType: null,
  };
  const npMissing = getMissingCalcCriticalFields(nonPassableState);
  assert(npMissing.some(m => m.field === "nonPassableType"), "Non-passable state: needs nonPassableType");
  assert(!hasAllCalcCriticalFields(nonPassableState), "Non-passable state: not ready");
}

// ─── Sim27: Extended budget slang — "прицениться", "посоветуй" ───
console.log("\n═══ Extended budget slang tests ═══");
{
  const base: ConversationState = {
    ...DEFAULT_CONVERSATION_STATE,
    auctionGradesAllowed: [],
    needsClarification: [],
    slotMeta: {},
    sellerClaims: [],
    excludedNegativeFlags: [],
    model: "RAV4",
    make: "Toyota",
    activeIntent: "car_search",
  };

  // "прицениться" should trigger budget guidance
  const update1 = extractStateUpdate("хочу прицениться", base);
  assertEqual(update1.set.budgetText, "approximate_guidance", "прицениться → budgetText = approximate_guidance");
  assertEqual(update1.set.budgetDeclined, true, "прицениться → budgetDeclined = true");
  assertEqual(update1.set.activeIntent, "price_calc", "прицениться → activeIntent = price_calc");

  // "посчитай по нормальной цене" should trigger budget guidance
  const update2 = extractStateUpdate("посчитай по нормальной цене", base);
  assertEqual(update2.set.budgetText, "approximate_guidance", "по нормальной цене → budgetText = approximate_guidance");
  assertEqual(update2.set.activeIntent, "price_calc", "по нормальной цене → activeIntent = price_calc");

  // Context-aware: "посоветуй" when pending question is about budget
  const withPending: ConversationState = {
    ...base,
    pendingQuestion: "Какой ориентир по бюджету или аукционной цене в йенах?",
  };
  const update3 = extractStateUpdate("посоветуй", withPending);
  assertEqual(update3.set.budgetDeclined, true, "посоветуй (budget pending) → budgetDeclined = true");
  assertEqual(update3.set.activeIntent, "price_calc", "посоветуй (budget pending) → price_calc");

  // "фиг знает" when pending question is about budget
  const update4 = extractStateUpdate("фиг знает", withPending);
  assertEqual(update4.set.budgetDeclined, true, "фиг знает (budget pending) → budgetDeclined = true");

  // "да хз" when pending question is about budget
  const update5 = extractStateUpdate("да хз", withPending);
  assertEqual(update5.set.budgetDeclined, true, "да хз (budget pending) → budgetDeclined = true");
}

// ─── Sim28: "до сотки пробега" mileage slang ───
console.log("\n═══ Mileage slang tests ═══");
{
  const base: ConversationState = {
    ...DEFAULT_CONVERSATION_STATE,
    auctionGradesAllowed: [],
    needsClarification: [],
    slotMeta: {},
    sellerClaims: [],
    excludedNegativeFlags: [],
  };

  const update1 = extractStateUpdate("до сотки пробега", base);
  assertEqual(update1.set.mileageText, "до 100 тыс. км", "до сотки пробега → mileageText");

  const update2 = extractStateUpdate("до 80к пробега", base);
  assertEqual(update2.set.mileageText, "до 80 тыс. км", "до 80к пробега → mileageText");
}

// ─── Summary ─────────────────────────────────────────────
console.log(`\n═══ Results: ${passed} passed, ${failed} failed ═══`);
if (failed > 0) {
  process.exit(1);
}
