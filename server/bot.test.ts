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
  _test_DEFAULT_CONVERSATION_STATE as DEFAULT_CONVERSATION_STATE,
  type _test_ConversationState as ConversationState,
} from "./bot.js";

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
const turn1Reply = buildSafeFallbackReply(stateAfterTurn1, turn1Plan);
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
const turn2Reply = buildSafeFallbackReply(stateAfterTurn2, turn2Plan);
console.log(`\n  Turn 2 reply: "${turn2Reply}"`);

assert(!turn2Reply.includes("до 3 лет или старше 5 лет"), "Turn 2 reply: does NOT re-ask about nonPassableType");
assert(!turn2Reply.includes("какой объём двигателя"), "Turn 2 reply: does NOT re-ask about engine volume");
assert(
  !turn2Reply.includes("физлицо, юрлицо или под перепродажу") &&
  !turn2Reply.includes("физлицо или юрлицо"),
  "Turn 2 reply: does NOT re-ask about ownership",
);
assert(
  turn2Reply.includes("сориентировать") || turn2Reply.includes("бюджет") || turn2Reply.includes("рынку"),
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
  const reply = buildSafeFallbackReply(state, plan);
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
  const reply = buildSafeFallbackReply(state, plan);
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
  const reply = buildSafeFallbackReply(state, plan);
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
  const reply = buildSafeFallbackReply(state, plan);
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
  const reply = buildSafeFallbackReply(state, plan);
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

// ─── Summary ─────────────────────────────────────────────
console.log(`\n═══ Results: ${passed} passed, ${failed} failed ═══`);
if (failed > 0) {
  process.exit(1);
}
